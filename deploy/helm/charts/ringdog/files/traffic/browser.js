// 실제 Chromium으로 쇼핑 여정 → RUM 세션·Session Replay·인기상품 위젯 로딩·결제 화면 데이터 생성.
import { browser } from "k6/browser";
import http from "k6/http";
import { sleep } from "k6";

const BASE = __ENV.TARGET_URL;
const PASSWORD = "demo-traffic-pw";
const USERS = 2;
const COUPON_RATIO = Number(__ENV.COUPON_RATIO || 0);

export const options = {
  setupTimeout: "12m", // setup()이 ALB DNS 전파를 최대 10분 기다림 (기본 60s로는 부족)
  scenarios: {
    ui: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE_PER_MIN || 1),
      timeUnit: "1m",
      duration: "720h",
      preAllocatedVUs: 1,
      maxVUs: USERS,
      options: { browser: { type: "chromium" } },
    },
  },
};

const email = (i) => `demo-browser-${i}@ringdog.demo`;

function signup(i) {
  return http.post(`${BASE}/api/auth/signup`, JSON.stringify({ email: email(i), password: PASSWORD }), {
    headers: { "Content-Type": "application/json" },
  });
}

// apps/frontend/src/lib/auth.ts의 TOKEN_KEY
const TOKEN_KEY = "ringdog_token";

// 401이면 계정이 없는 것이므로 signup 1회 후 재로그인
function login(i) {
  const doLogin = () =>
    http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: email(i), password: PASSWORD }), {
      headers: { "Content-Type": "application/json" },
    });
  let res = doLogin();
  if (res.status === 401) {
    signup(i);
    res = doLogin();
  }
  if (res.status !== 200) throw new Error(`login ${email(i)} failed: ${res.status} ${res.body}`);
  return res.json("token");
}

const SETUP_DEADLINE_S = 600;
const RETRY_SLEEP_S = 10;

// ALB를 막 만든 직후엔 DNS가 아직 풀리지 않아 네트워크 에러(status 0)가 난다.
// HTTP 응답(201 생성 / 409 이미 존재 등)을 받을 때까지 재시도한다.
export function setup() {
  const start = Date.now();
  for (let i = 0; i < USERS; i++) {
    for (;;) {
      const res = signup(i);
      if (res.status !== 0 && !res.error) break;
      if ((Date.now() - start) / 1000 > SETUP_DEADLINE_S) {
        throw new Error(`setup: signup for ${email(i)} got no HTTP response for ${SETUP_DEADLINE_S}s (${res.error}) - is ${BASE} reachable?`);
      }
      console.warn(`setup: signup ${email(i)} network error (${res.error}); retrying in ${RETRY_SLEEP_S}s`);
      sleep(RETRY_SLEEP_S);
    }
  }
}

export default async function () {
  // 매 반복마다 새 context = 새 쿠키 = 새 RUM 세션
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // 폼 로그인은 하이드레이션 전 fill이 400을 내므로 http로 토큰을 받아, 페이지 스크립트보다 먼저 localStorage에 주입한다.
    // (goto 후 evaluate + 재이동은 RUM remote config fetch를 중단시켜 SDK가 시작되지 않음)
    const token = login((__VU - 1) % USERS);
    await context.addInitScript(`localStorage.setItem(${JSON.stringify(TOKEN_KEY)}, ${JSON.stringify(token)});`);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const addButton = page.locator('(//button[normalize-space()="장바구니"])[1]');
    await addButton.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(3000); // 인기상품 위젯 로딩이 Replay에 남도록 + 하이드레이션 대기
    await addButton.click();
    await page.waitForTimeout(2500); // 장바구니 요청 완료 대기 (0.52 browser에 waitForResponse 없음)

    await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
    const coupon = page.locator('input[placeholder="RINGDOG100"]');
    try {
      await coupon.waitFor({ state: "visible", timeout: 8000 });
    } catch (e) {
      // 장바구니가 비어 있으면(클릭이 하이드레이션 전에 유실) 한 번 더 담고 재시도
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await addButton.waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(3000);
      await addButton.click();
      await page.waitForTimeout(2500);
      await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
      await coupon.waitFor({ state: "visible", timeout: 15000 });
    }
    if (Math.random() >= COUPON_RATIO) {
      await coupon.fill("");
    }
    // 헤더 검색·챗 위젯 버튼과 구분: 쿠폰 입력이 있는 결제 form의 submit만
    const pay = page.locator('main form:has(input[placeholder="RINGDOG100"]) button[type="submit"]');
    await pay.click();
    // 시나리오 ① 장애 중 결제가 멈추면 연타하는 사용자 → RUM frustration(Rage Click).
    // Rage Click 조건: 같은 요소를 1초 안에 3회 이상 클릭. 그래서 첫 클릭 직후 간격 없이 3회 더 누른다.
    // 결제 중에도 버튼은 enabled(프런트 핸들러가 재진입만 막음)라 click 이벤트가 실제로 발생한다.
    // 정상 결제로 버튼이 사라지면(주문 완료 화면) 짧은 timeout + try/catch로 해당 클릭을 건너뜀
    for (let i = 0; i < 3; i++) {
      try {
        await pay.click({ force: true, timeout: 300 });
      } catch (e) {
        // 버튼이 없어짐 — rage click 생략
      }
    }
    await page.waitForTimeout(3000); // 마지막 뷰·액션(rage click)이 RUM intake로 flush되도록 대기
  } finally {
    await page.close();
    await context.close();
  }
}
