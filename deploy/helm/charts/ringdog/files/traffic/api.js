// RingDog API 트래픽: 로그인 → 상품 목록 + 인기상품(홈 화면과 같은 호출) → 검색 → 장바구니 → (일부) 주문 → 주문 내역.
// 시나리오 ① 급증 프로필은 둘러보기 위주(CHECKOUT_RATIO 0.25), 시나리오 ②는 COUPON_RATIO 0.5.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.TARGET_URL;
const PASSWORD = "demo-traffic-pw";
const USERS = Number(__ENV.USERS || 5);
const CHECKOUT_RATIO = Number(__ENV.CHECKOUT_RATIO || 1);
const COUPON_RATIO = Number(__ENV.COUPON_RATIO || 0);
const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };
const QUERIES = ["고양이", "가죽", "별", "keyring"];

export const options = {
  scenarios: {
    shop: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE_PER_MIN || 30),
      timeUnit: "1m",
      duration: "720h",
      preAllocatedVUs: USERS,
      maxVUs: USERS, // VU 하나 = 사용자 하나 → 같은 장바구니를 동시에 건드리지 않음
    },
  },
};

const email = (i) => `demo-traffic-${i}@ringdog.demo`;

export function setup() {
  for (let i = 0; i < USERS; i++) {
    // 이미 있으면 409 — 무시
    http.post(`${BASE}/api/auth/signup`, JSON.stringify({ email: email(i), password: PASSWORD }), JSON_HEADERS);
  }
}

export default function () {
  const login = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: email((__VU - 1) % USERS), password: PASSWORD }),
    JSON_HEADERS,
  );
  if (!check(login, { "login 200": (r) => r.status === 200 })) return;
  const auth = { headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.json("token")}` } };

  const list = http.get(`${BASE}/api/products?limit=20`);
  http.get(`${BASE}/api/products/trending`, { tags: { name: "trending" } });
  const items = list.json("items") || [];
  http.get(`${BASE}/api/products/search?q=${encodeURIComponent(QUERIES[Math.floor(Math.random() * QUERIES.length)])}`);
  if (items.length === 0) return;

  const product = items[Math.floor(Math.random() * items.length)];
  http.post(`${BASE}/api/cart/items`, JSON.stringify({ product_id: product.id, quantity: 1 }), auth);

  if (Math.random() < CHECKOUT_RATIO) {
    const body = Math.random() < COUPON_RATIO ? { coupon_code: "RINGDOG100" } : {};
    const checkout = http.post(`${BASE}/api/orders/checkout`, JSON.stringify(body), auth);
    // 409 = 품절(정상적인 비즈니스 응답)
    check(checkout, { "checkout 201/409": (r) => r.status === 201 || r.status === 409 });
  }

  http.get(`${BASE}/api/orders`, auth);
}
