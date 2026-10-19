// 실제 Chromium으로 쇼핑 여정 → RUM 세션·Session Replay·인기상품 위젯 로딩·결제 화면 데이터 생성.
import { browser } from "k6/browser";
import http from "k6/http";

const BASE = __ENV.TARGET_URL;
const PASSWORD = "demo-traffic-pw";
const USERS = 2;
const COUPON_RATIO = Number(__ENV.COUPON_RATIO || 0);

export const options = {
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

export function setup() {
  for (let i = 0; i < USERS; i++) {
    http.post(`${BASE}/api/auth/signup`, JSON.stringify({ email: email(i), password: PASSWORD }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default async function () {
  // 매 반복마다 새 context = 새 쿠키 = 새 RUM 세션
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/login`);
    await page.locator('input[type="email"]').fill(email((__VU - 1) % USERS));
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000); // 클라이언트 라우팅(router.push)이라 navigation 이벤트가 없음

    await page.goto(`${BASE}/`);
    const addButton = page.locator('(//button[normalize-space()="장바구니"])[1]');
    await addButton.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(2000); // 인기상품 위젯 로딩이 Replay에 남도록
    await addButton.click();
    await page.waitForTimeout(1500);

    await page.goto(`${BASE}/cart`);
    const coupon = page.locator('input[placeholder="RINGDOG100"]');
    await coupon.waitFor({ state: "visible", timeout: 15000 });
    if (Math.random() >= COUPON_RATIO) {
      await coupon.fill("");
    }
    const pay = page.locator('button[type="submit"]');
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
    await page.waitForTimeout(3000);
  } finally {
    await page.close();
    await context.close();
  }
}
