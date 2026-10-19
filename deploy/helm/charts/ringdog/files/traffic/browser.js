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
    await page.waitForTimeout(3000);
    // 시나리오 ① 장애 중 결제가 늦으면 다시 누르는 사용자 → RUM frustration(rage click)
    // 결제 중에는 버튼이 disabled(checkingOut)이므로 force로 enabled 검사를 건너뛰어,
    // 결제가 멈춘 동안 비활성 버튼에 연타가 들어가게 한다 → RUM Rage Click 신호.
    // 첫 클릭 후 페이지가 이동했으면(정상 결제) 버튼이 사라지므로 짧은 timeout + try/catch로 건너뜀
    try {
      await pay.click({ force: true, timeout: 1000 });
      await pay.click({ force: true, timeout: 1000 });
    } catch (e) {
      // navigation으로 버튼이 없어짐 — rage click 생략
    }
    await page.waitForTimeout(3000);
  } finally {
    await page.close();
    await context.close();
  }
}
