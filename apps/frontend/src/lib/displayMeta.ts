import { hashString } from "./hash";

/** 화면 표시용 가짜 값. id 기준으로 항상 같은 결과가 나온다. */
export interface DisplayMeta {
  discountRate: number;
  originalPrice: number;
  rating: number;
  reviewCount: number;
  shipping: "무료배송" | "내일 도착";
}

export interface Review {
  author: string;
  rating: number;
  body: string;
  date: string;
}

const DISCOUNT_RATES = [5, 10, 15, 20, 25, 30, 40, 50];
const REVIEW_AUTHORS = ["minsu", "jiwoo", "yuna", "sora", "dahee", "hana", "jisoo", "eunji"];
const REVIEW_BODIES = [
  "포장이 꼼꼼하고 색감도 사진과 똑같아요.",
  "선물용으로 샀는데 받는 분이 좋아하셨어요.",
  "가격 대비 마감이 훌륭합니다.",
  "생각보다 작아서 귀엽고 들고 다니기 좋아요.",
  "배송이 빨라서 만족스러웠습니다.",
  "재구매 의사 있어요. 주변에도 추천할게요.",
  "퀄리티가 생각보다 좋네요.",
  "색이 은은해서 어디에나 잘 어울려요.",
  "사진보다 실물이 더 예뻐요.",
  "냄새나 흠집 없이 깔끔하게 왔습니다.",
  "가볍고 튼튼해서 매일 쓰고 있어요.",
  "선물 포장까지 되어 있어서 편했어요.",
];

/** 상품 id와 판매가로 할인율·정가·별점·리뷰 수·배송 문구를 만든다. */
export function displayMeta(id: string, price: number): DisplayMeta {
  const discountHash = hashString(`${id}:discount`);
  const discountRate =
    discountHash % 100 < 20 ? 0 : DISCOUNT_RATES[Math.floor(discountHash / 100) % DISCOUNT_RATES.length];
  const originalPrice =
    discountRate === 0 ? price : Math.round(price / (1 - discountRate / 100) / 100) * 100;
  const rating = (40 + (hashString(`${id}:rating`) % 11)) / 10;
  const reviewCount = 10 + (hashString(`${id}:reviews`) % 491);
  const shipping = hashString(`${id}:shipping`) % 2 === 0 ? "무료배송" : "내일 도착";
  return { discountRate, originalPrice, rating, reviewCount, shipping };
}

/** 상품 id 기준의 가짜 리뷰. 작성자는 마스킹되고 날짜는 최근 30일 안에 든다. */
export function reviewsFor(id: string, count = 3, today: Date = new Date()): Review[] {
  // 시작 위치만 id 해시로 정하고 서로소 간격으로 건너뛰어 한 상품 안에서 작성자·본문이 겹치지 않게 한다.
  const authorStart = hashString(`${id}:review-authors`) % REVIEW_AUTHORS.length;
  const bodyStart = hashString(`${id}:review-bodies`) % REVIEW_BODIES.length;
  return Array.from({ length: count }, (_, i) => {
    const h = hashString(`${id}:review:${i}`);
    const author = `${REVIEW_AUTHORS[(authorStart + i * 3) % REVIEW_AUTHORS.length]}***`;
    const rating = 4 + ((h >>> 4) % 2);
    const body = REVIEW_BODIES[(bodyStart + i * 5) % REVIEW_BODIES.length];
    const daysAgo = (h >>> 12) % 30;
    const date = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return { author, rating, body, date: formatDate(date) };
  });
}

/** 8400 -> "8,400원" */
export function formatWon(value: number): string {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}
