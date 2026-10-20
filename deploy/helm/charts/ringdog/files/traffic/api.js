// RingDog API 트래픽: 로그인 → 상품 목록 + 인기상품(홈 화면과 같은 호출) → 검색 → 장바구니 → (일부) 주문 → 주문 내역.
// 시나리오 ① 급증 프로필은 둘러보기 위주(CHECKOUT_RATIO 0.25), 시나리오 ②는 COUPON_RATIO 0.5.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.TARGET_URL;
const PASSWORD = "demo-traffic-pw";
const USERS = Number(__ENV.USERS || 5);
const CHECKOUT_RATIO = Number(__ENV.CHECKOUT_RATIO || 1);
// 인덱스 없는 인기상품 쿼리는 1회에 RDS CPU 약 1.2초를 쓴다. 급증 때 매 반복 호출하면 DB가 포화되고
// 커넥션 풀까지 막혀 상품 목록도 멈추므로, 급증 프로필은 일부 반복에서만 부른다 (원인 ① 강도 조절).
const TRENDING_RATIO = Number(__ENV.TRENDING_RATIO || 1);
// 주문 내역도 orders(user_id)·order_items(order_id) 인덱스가 없어 매번 전체 스캔한다. 급증 때 매 반복 부르면
// 위젯을 꺼도 DB CPU가 내려가지 않아 1차 대처 장면이 안 나오므로, 급증 프로필은 가끔만 본다.
const ORDERS_RATIO = Number(__ENV.ORDERS_RATIO || 1);
const COUPON_RATIO = Number(__ENV.COUPON_RATIO || 0);
const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };
const QUERIES = ["고양이", "가죽", "별", "keyring"];

export const options = {
  setupTimeout: "12m", // setup()이 ALB DNS 전파를 최대 10분 기다림 (기본 60s로는 부족)
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

function signup(i) {
  return http.post(`${BASE}/api/auth/signup`, JSON.stringify({ email: email(i), password: PASSWORD }), JSON_HEADERS);
}

function login(i) {
  return http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: email(i), password: PASSWORD }), JSON_HEADERS);
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

export default function () {
  const idx = (__VU - 1) % USERS;
  let res = login(idx);
  if (res.status === 401) {
    // 안전망: 사용자가 아직 없을 수 있음 → 가입 1회 후 재로그인 (401일 때만)
    signup(idx);
    res = login(idx);
  }
  if (!check(res, { "login 200": (r) => r.status === 200 })) return;
  const auth = { headers: { "Content-Type": "application/json", Authorization: `Bearer ${res.json("token")}` } };

  const list = http.get(`${BASE}/api/products?limit=20`);
  if (Math.random() < TRENDING_RATIO) {
    http.get(`${BASE}/api/products/trending`, { tags: { name: "trending" } });
  }
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

  if (Math.random() < ORDERS_RATIO) {
    http.get(`${BASE}/api/orders`, auth);
  }
}
