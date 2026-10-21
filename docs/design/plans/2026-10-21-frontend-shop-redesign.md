# 프론트엔드 쇼핑몰형 디자인 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RingDog 프론트엔드 전 페이지를 쿠팡형 쇼핑몰 디자인(배너·카테고리·실사진·쿠팡형 상세)으로 바꾸되, 시나리오 ①·②의 k6 브라우저 경로와 RUM 액션 이름을 그대로 유지한다.

**Architecture:** 백엔드·DB는 건드리지 않는다. API에 없는 화면 값(할인율·별점·리뷰·사진 매핑·카테고리)은 `src/lib/`의 순수 함수로 만들고 vitest로 고정한다. 그 위에 공통 헤더 → 홈 → 상세 → 나머지 페이지 순으로 화면을 다시 짠다. 마지막 Task에서 데모 환경에 배포해 시연 경로를 확인한다.

**Tech Stack:** Next.js 15 App Router, React 18, Tailwind 3, TypeScript, vitest 2 (`npx --yes pnpm@9.15.0 --filter @ringdog/frontend run test`)

**Spec:** `docs/design/specs/2026-10-21-frontend-shop-redesign-design.md` (시안: `.superpowers/brainstorm/709-1792562883/content/home-direction.html` A안, `detail-page-v2.html`)

## Global Constraints

- 백엔드 API·DB 스키마·시드는 변경하지 않는다.
- 홈에서 문서 순서상 첫 `<button>`이면서 텍스트가 정확히 `장바구니`인 요소는 **전체 상품 그리드의 상품 카드 버튼**이어야 한다. 헤더의 장바구니는 `<a>` 링크, 인기상품 위젯 카드에는 장바구니 버튼이 없다.
- 장바구니 결제 폼은 `<main>` 안에 있고, `input[placeholder="RINGDOG100"]`(초기값 `RINGDOG100`)과 submit 버튼 **하나**(`결제하기` / `결제 처리 중...`)만 가진다. 결제 중에도 버튼은 enabled이고 `useRef`로 재진입을 막는다.
- 버튼 문구 `장바구니`, `결제하기`, `결제 처리 중...`은 그대로 둔다(RUM 액션 이름).
- 새 화면은 `/api/products/trending`을 추가로 호출하지 않는다(홈 `TrendingWidget`만 호출).
- URL 구조 `/`, `/products/[id]`, `/cart`, `/orders`, `/login`, `/signup`은 유지한다. 검색은 `/?q=`.
- 클릭 가능해 보이는 모든 요소는 실제로 동작한다. 동작하지 않는 장식은 커서·호버 효과를 주지 않는다(RUM dead click 방지).
- 색은 기존 `primary` 팔레트를 쓰고, 폰트는 `Noto Sans KR` 하나로 통일한다(`Jua` 제거). 글씨는 본문 14~15px 이상, 상세 상품명 22px, 상세 판매가 26px.
- 사진은 Unsplash License·Pexels License 사진만 `apps/frontend/public/images/` 아래에 커밋한다. 장당 약 100KB 이하, 외부 핫링크 금지, 출처는 `public/images/CREDITS.md`.
- `RumInit`, `lib/datadogRum.ts`, `next.config.js`의 Document-Policy 헤더는 건드리지 않는다.

## Review Focus

- 로그인하지 않은 사용자가 카드·상세의 장바구니를 누를 때: 지금처럼 "로그인이 필요합니다" 안내가 보이고 오류 없이 끝나야 한다.
- 검색·카테고리 결과가 0개일 때: "검색 결과가 없습니다" 안내와 홈으로 가는 링크만 보이고, "더보기"는 나오지 않아야 한다.
- 태그가 비었거나 알 수 없는 모양 태그인 상품(새로 등록된 상품 등): 사진·카테고리·화면 값이 깨지지 않고 기본값으로 나와야 한다.
- 인기상품 위젯이 장애 중 5초 넘게 늦을 때: 스켈레톤이 보이다가 숨겨지고, 아래 전체 상품 그리드는 그대로 보여야 한다.
- 마지막 페이지에서: "더보기"가 사라지고, 같은 상품이 두 번 나오지 않아야 한다.

---

### Task 1: 상품 사진 수집 + 사진 매핑

**Files:**
- Create: `apps/frontend/public/images/products/<subject>-<n>.webp` (모양 15종 × 1~3장), `apps/frontend/public/images/banners/banner-{1,2,3}.webp`, `apps/frontend/public/images/CREDITS.md`
- Create: `apps/frontend/src/lib/hash.ts`, `apps/frontend/src/lib/productImage.ts`
- Test: `apps/frontend/src/lib/hash.test.ts`, `apps/frontend/src/lib/productImage.test.ts`

**Interfaces:**
- Produces:
  - `hashString(value: string): number`(32비트 양수, 결정적) — `src/lib/hash.ts`에 둔다. Task 2·3도 쓴다.
  - `SUBJECT_IMAGES: Record<string, string[]>` — 키는 모양 태그 15종(`에어팟, 고양이, 강아지, 곰돌이, 우주비행사, 자동차, 꽃, 별, 지구본, 카메라, 축구공, 책, 커피컵, 자전거, 로켓`), 값은 `/images/products/...` 경로.
  - `ALL_PRODUCT_IMAGES: string[]`
  - `productImages(p: { id: string; name: string; tags: string[]; imageUrl: string | null }, count?: number): string[]` — 기본 `count` 1, 항상 1개 이상 반환.
  - `BANNER_IMAGES: string[]`

- [ ] **Step 1: 사진 수집**
  - Unsplash·Pexels에서 모양별 키링 사진을 받는다. 키링 실물이 없으면 그 모양의 소품 사진을 쓴다.
  - 정사각형 600px 이하, 장당 약 100KB 이하 WebP로 줄인다.
  - `CREDITS.md`에 `파일 | 원본 URL | 작가 | 라이선스` 표를 쓴다.
  - WSL에서 받으면 `export SSL_CERT_FILE=~/certs/ca-bundle.pem`이 필요할 수 있다.
- [ ] **Step 2: 실패하는 테스트 작성**

```ts
describe("productImages", () => {
  it("uses imageUrl when present", () => {
    expect(productImages({ id: "a", name: "x", tags: ["가죽", "고양이"], imageUrl: "https://x/y.jpg" })).toEqual(["https://x/y.jpg"]);
  });
  it("picks from the subject pool by tag", () => {
    const [img] = productImages({ id: "a", name: "가죽 고양이 키링 #2", tags: ["가죽", "고양이"], imageUrl: null });
    expect(SUBJECT_IMAGES["고양이"]).toContain(img);
  });
  it("is deterministic per id", () => {
    const p = { id: "abc", name: "n", tags: ["별"], imageUrl: null };
    expect(productImages(p, 3)).toEqual(productImages(p, 3));
  });
  it("spreads bulk sale products across the whole pool", () => {
    // 대량 시드 상품은 모두 tags ["미니","별"], 이름 "세일 키링 #N"
    const imgs = new Set(Array.from({ length: 40 }, (_, i) =>
      productImages({ id: `bulk-${i}`, name: `세일 키링 #${60 + i}`, tags: ["미니", "별"], imageUrl: null })[0]));
    expect(imgs.size).toBeGreaterThanOrEqual(8);
  });
  it("falls back to the whole pool for unknown or empty tags", () => {
    expect(ALL_PRODUCT_IMAGES).toContain(productImages({ id: "z", name: "n", tags: [], imageUrl: null })[0]);
  });
  it("returns count distinct images when the pool allows", () => {
    expect(new Set(productImages({ id: "q", name: "n", tags: ["고양이"], imageUrl: null }, 4)).size).toBe(4);
  });
});
```

  `hashString`도 같은 입력 → 같은 값, 0 이상임을 테스트한다(`hash.test.ts`).
- [ ] **Step 3: 실패 확인** — `npx --yes pnpm@9.15.0 --filter @ringdog/frontend run test` → FAIL(모듈 없음)
- [ ] **Step 4: 구현**
  - 이름이 `세일 키링 #`으로 시작하면 전체 풀에서 고른다.
  - 그렇지 않으면 태그 중 `SUBJECT_IMAGES`에 있는 첫 태그의 풀에서 고른다. 없으면 전체 풀에서 고른다.
  - 시작 위치는 `hashString(id)`다. `count`가 풀보다 크면 전체 풀에서 이어서 채운다.
  - `SUBJECT_IMAGES`의 경로는 Step 1에서 실제로 받은 파일과 일치해야 한다.
- [ ] **Step 5: 통과 확인** — 같은 명령 → PASS
- [ ] **Step 6: Commit** — `git add apps/frontend/public/images apps/frontend/src/lib/hash* apps/frontend/src/lib/productImage*` / `feat(frontend): product photos and deterministic image mapping`

---

### Task 2: 화면용 가짜 값 (할인율·별점·리뷰·배송)

**Files:**
- Create: `apps/frontend/src/lib/displayMeta.ts`
- Test: `apps/frontend/src/lib/displayMeta.test.ts`

**Interfaces:**
- Consumes: `hashString` (Task 1)
- Produces:
  - `interface DisplayMeta { discountRate: number; originalPrice: number; rating: number; reviewCount: number; shipping: "무료배송" | "내일 도착" }`
  - `displayMeta(id: string, price: number): DisplayMeta`
  - `interface Review { author: string; rating: number; body: string; date: string }`
  - `reviewsFor(id: string, count?: number, today?: Date): Review[]` — 기본 `count` 3. `date`는 `YYYY.MM.DD`.
  - `formatWon(value: number): string` → `"8,400원"`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe("displayMeta", () => {
  it("is deterministic per id", () => expect(displayMeta("p1", 8400)).toEqual(displayMeta("p1", 8400)));
  it("keeps values in range over many ids", () => {
    for (let i = 0; i < 500; i++) {
      const m = displayMeta(`id-${i}`, 8400);
      expect([0, 5, 10, 15, 20, 25, 30, 40, 50]).toContain(m.discountRate);
      expect(m.rating).toBeGreaterThanOrEqual(4.0); expect(m.rating).toBeLessThanOrEqual(5.0);
      expect(m.reviewCount).toBeGreaterThanOrEqual(10); expect(m.reviewCount).toBeLessThanOrEqual(500);
      expect(m.originalPrice % 100).toBe(0);
      expect(m.originalPrice).toBeGreaterThanOrEqual(8400);
    }
  });
  it("original equals price when there is no discount", () => {
    const id = Array.from({ length: 500 }, (_, i) => `id-${i}`).find((x) => displayMeta(x, 8400).discountRate === 0)!;
    expect(displayMeta(id, 8400).originalPrice).toBe(8400);
  });
  it("derives original price from sale price", () => {
    const id = Array.from({ length: 500 }, (_, i) => `id-${i}`).find((x) => displayMeta(x, 7000).discountRate === 30)!;
    expect(displayMeta(id, 7000).originalPrice).toBe(10000);
  });
});
describe("reviewsFor", () => {
  it("returns masked authors and recent dates", () => {
    const r = reviewsFor("p1", 3, new Date("2026-10-21T00:00:00Z"));
    expect(r).toHaveLength(3);
    r.forEach((x) => { expect(x.author).toMatch(/^[a-z]{2,5}\*\*\*$/); expect(x.date >= "2026.09.21").toBe(true); });
  });
});
it("formatWon", () => expect(formatWon(8400)).toBe("8,400원"));
```

- [ ] **Step 2: 실패 확인** — 테스트 명령 → FAIL
- [ ] **Step 3: 구현**
  - 할인율은 위 9개 값 중 하나다. 약 20%는 0이 되게 분포를 잡는다.
  - 정가 = `Math.round(price / (1 - rate) / 100) * 100`.
  - 리뷰 문구는 한국어 템플릿 10개 이상, 별점은 4~5다.
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: Commit** — `feat(frontend): deterministic display meta for discount, rating, reviews`

---

### Task 3: 카테고리

**Files:**
- Create: `apps/frontend/src/lib/categories.ts`
- Test: `apps/frontend/src/lib/categories.test.ts`

**Interfaces:**
- Produces:
  - `interface Category { slug: string; label: string; subjects: string[]; image: string }`
  - `CATEGORIES: Category[]` — 시작안: 동물(고양이·강아지·곰돌이), 탈것(자동차·자전거), 우주(로켓·우주비행사·별·지구본), 일상(커피컵·책·카메라), 테크(에어팟), 스포츠(축구공), 꽃(꽃)
  - `categoryForTags(tags: string[]): { category: Category; subject: string } | null`
  - `categorySearchHref(category: Category): string` — `/?q=...`
  - `subjectSearchHref(subject: string): string` — `/?q=<subject>`

- [ ] **Step 1: 검색 API 확인(실환경)** — 데모 환경 ALB에서 실행한다.
  - `curl -s "http://<ALB>/api/products/search?q=<URL인코딩 '고양이 강아지 곰돌이'>&limit=50"`의 결과가 세 모양을 모두 포함하는지 본다.
  - 포함하면 `categorySearchHref`는 `subjects.join(" ")`이다.
  - 포함하지 않으면 여러 모양을 묶은 카테고리를 모양 단위로 나누고(카테고리 = 모양 1개), 결과를 Task 진행 기록에 남긴다.
- [ ] **Step 2: 실패하는 테스트 작성**

```ts
it("every subject tag maps to exactly one category", () => {
  const all = CATEGORIES.flatMap((c) => c.subjects);
  expect(new Set(all).size).toBe(all.length);
  expect(all.sort()).toEqual(Object.keys(SUBJECT_IMAGES).sort());
});
it("finds category from tags", () => expect(categoryForTags(["가죽", "고양이"])?.subject).toBe("고양이"));
it("returns null for unknown tags", () => expect(categoryForTags(["미니"])).toBeNull());
it("builds search hrefs", () => expect(subjectSearchHref("고양이")).toBe(`/?q=${encodeURIComponent("고양이")}`));
```

- [ ] **Step 3: 실패 확인 → Step 4: 구현 → Step 5: 통과 확인**
- [ ] **Step 6: Commit** — `feat(frontend): keyring categories from subject tags`

---

### Task 4: 공통 톤 + 헤더

**Files:**
- Modify: `apps/frontend/tailwind.config.ts`(그림자를 회색 계열로, `heading` 폰트 제거), `src/app/fonts.ts`(Jua 제거), `src/app/layout.tsx`, `src/app/globals.css`, `src/components/Header.tsx`
- Create: `src/components/Footer.tsx`(사업자 정보 흉내 없이 "RingDog 데모 쇼핑몰" 한 줄 + 링크 없음)
- Modify: `font-heading`을 쓰는 모든 곳(`grep -rn font-heading src`)

**Interfaces:**
- Consumes: `CATEGORIES`, `categorySearchHref` (Task 3)
- Produces: `<Header />`(props 없음)

- [ ] **Step 1: 헤더 구현**
  - 1줄: 로고 링크(`/`), 검색 폼(기존 `/?q=` 동작), `장바구니`·`주문내역` **링크**, 로그인 상태별 로그인·회원가입 링크 또는 로그아웃.
  - 2줄: "☰ 카테고리" 버튼(누르면 `CATEGORIES` 목록이 펼쳐지고 각 항목은 `categorySearchHref` 링크), `타임세일` → `/?q=세일`, `신상품` → `/#all-products`, 카테고리 바로가기 3~4개.
  - 헤더 안에 텍스트가 `장바구니`인 `<button>`이 없어야 한다.
- [ ] **Step 2: 검증** — 테스트 명령 + `run typecheck` + `run lint` + `run build` 모두 성공. `grep -rn "font-heading\|jua" apps/frontend/src` 결과 0건.
- [ ] **Step 3: Commit** — `feat(frontend): shop-style header and shared tone`

---

### Task 5: 홈 (배너·카테고리·인기상품·전체 상품)

**Files:**
- Create: `src/components/home/BannerCarousel.tsx`, `src/components/home/CategoryIcons.tsx`, `src/lib/paging.ts`, `src/lib/paging.test.ts`
- Modify: `src/components/ProductCard.tsx`, `src/components/ProductCatalog.tsx`, `src/components/TrendingWidget.tsx`(마크업·스타일만), `src/app/page.tsx`
- Delete(사용처가 없어지면): `src/components/ProductIcon.tsx`, `src/components/icons/*`

**Interfaces:**
- Consumes: `productImages`, `BANNER_IMAGES` (T1), `displayMeta`, `formatWon` (T2), `CATEGORIES`, `categorySearchHref` (T3)
- Produces:
  - `mergeProducts<T extends { id: string }>(prev: T[], next: T[]): T[]` — id 중복 제거, 순서 유지
  - `hasMore(loaded: number, total: number): boolean`
  - `ProductCard` props: `{ id, name, price, imageUrl, tags, onAddToCart? }`(지금과 같음)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("mergeProducts drops duplicates and keeps order", () =>
  expect(mergeProducts([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]).map((p) => p.id)).toEqual(["a", "b", "c"]));
it("hasMore", () => { expect(hasMore(24, 1200)).toBe(true); expect(hasMore(1200, 1200)).toBe(false); expect(hasMore(0, 0)).toBe(false); });
```

- [ ] **Step 2: 실패 확인 → Step 3: `paging.ts` 구현 → Step 4: 통과 확인**
- [ ] **Step 5: 화면 구현**(시안 A안, 글씨는 시안보다 크게)
  - **배너**: `BANNER_IMAGES` 3장을 5초마다 넘긴다. 점 버튼으로 직접 넘길 수 있다. 각 배너는 링크다(타임세일 → `/?q=세일` 등).
  - **원형 카테고리 아이콘**: `CATEGORIES`를 링크로 보여 준다.
  - **TrendingWidget**: 카드는 사진·순위·이름·가격만 보여 주는 상세 링크다. **장바구니 버튼 없음.** `loadTrending`·스켈레톤·[<][>] 로직은 그대로 둔다.
  - **전체 상품**: `id="all-products"` 섹션. 카드는 사진(`productImages`), 이름(2줄 말줄임), 할인율 + 판매가 + 정가 취소선, 별점·상품평 수, 배송 배지, `장바구니` 버튼으로 구성한다. 그리드 아래 "더보기"는 다음 `page`를 불러와 `mergeProducts`로 붙이고, `hasMore`가 false면 숨긴다.
  - **검색(`?q=`)**: 배너·아이콘·위젯을 숨기고 `'q' 검색 결과 N개`를 보여 준다. 0개면 안내와 홈 링크만 보여 준다.
  - **로그인 안내**: 기존 `handleAddToCart`의 로그인 확인과 안내 메시지는 유지한다.
- [ ] **Step 6: 검증**
  - test·typecheck·lint·build가 통과한다.
  - `next dev`로 홈을 띄워, 브라우저 개발자도구에서 `$x('(//button[normalize-space()="장바구니"])[1]')[0].closest('#all-products')`가 null이 아님을 확인한다.
- [ ] **Step 7: Commit** — `feat(frontend): shop-style home with banners, categories, load more`

---

### Task 6: 상품 상세

**Files:**
- Modify: `src/app/products/[id]/page.tsx`
- Create: `src/components/product/ProductGallery.tsx`, `src/components/product/SimilarProducts.tsx`

**Interfaces:**
- Consumes: `productImages`(count 4), `displayMeta`, `reviewsFor`, `formatWon`, `categoryForTags`, `subjectSearchHref`, `ProductCard` 스타일
- Produces: 없음

- [ ] **Step 1: 구현**(시안 `detail-page-v2.html`. 사진 열이 정보 열보다 좁다.)
  - **카테고리 경로**: 홈 › 카테고리 › 모양, 모두 링크. `categoryForTags`가 null이면 "홈 › 전체 상품".
  - **사진**: 썸네일을 누르면 대표 사진이 바뀐다(`ProductGallery`).
  - **정보 영역**
    - 상품명(22px)과 별점·상품평 수. 상품평 수를 누르면 `#reviews`로 스크롤한다.
    - 할인율·정가·판매가(26px)와 타임세일 표시.
    - 배송·소재(첫 태그)·재고(`stock`) 표.
    - 수량 −/＋는 1..`stock` 범위다.
    - `장바구니 담기`는 `quantity`를 전달해 POST한다.
    - `바로구매`는 담은 뒤 `/cart`로 이동한다.
    - 로그인하지 않았으면 두 버튼 모두 기존 로그인 안내를 보여 준다. 품절이면 `품절`로 disabled.
  - **탭**: 상품상세 / 상품평(N) / 배송·교환·반품. 같은 페이지 안의 앵커로 이동한다(`#detail`, `#reviews`, `#shipping`).
  - **리뷰**: `reviewsFor(id)` 3개.
  - **비슷한 상품**(`SimilarProducts`): `/api/products/search?q=<subject>&limit=6`에서 자기 자신을 뺀 최대 5개. 장바구니 버튼 없이 상세 링크만 둔다. subject가 없으면 섹션을 숨긴다.
- [ ] **Step 2: 검증** — test·typecheck·lint·build. 대량 시드 상품 하나와 기본 상품 하나의 상세를 `next dev`에서 연다. 콘솔 에러가 없고, 수량 경계(1, stock)가 지켜져야 한다.
- [ ] **Step 3: Commit** — `feat(frontend): shop-style product detail page`

---

### Task 7: 장바구니·주문내역·로그인·회원가입·에러 페이지

**Files:**
- Modify: `src/app/cart/page.tsx`, `src/app/orders/page.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`(스타일만), `src/components/ChatWidget.tsx`(톤만)

**Interfaces:**
- Consumes: `productImages`, `formatWon`

- [ ] **Step 1: 장바구니**
  - 왼쪽: 상품 목록(사진, 이름, 수량, 금액, 삭제).
  - 오른쪽: 결제 금액 요약 박스 + 결제 폼.
  - 결제 폼은 Global Constraints의 장바구니 조항을 그대로 지킨다: `<main>` 안, placeholder·초기값 `RINGDOG100`, submit 하나, 문구 `결제하기` / `결제 처리 중...`, 결제 중 enabled + `useRef` 가드. 기존 `handleCheckout` 로직은 바꾸지 않는다.
- [ ] **Step 2: 주문내역** — 주문 카드(주문일, 상태 배지, 상품 사진 썸네일, 금액, 기존 취소 기능).
- [ ] **Step 3: 로그인·회원가입·에러** — 가운데 폼 카드. 기존 동작과 필드 이름을 유지한다.
- [ ] **Step 4: 검증**
  - test·typecheck·lint·build가 통과한다.
  - `next dev`에서 로그인 → 홈에서 첫 `장바구니` → `/cart`에서 쿠폰칸 비우고 결제 → 주문내역에서 확인, 이 흐름이 오류 없이 끝나야 한다(로컬 백엔드 또는 데모 ALB를 API로 사용).
  - `document.querySelectorAll('main form:has(input[placeholder="RINGDOG100"]) button[type="submit"]').length === 1`.
- [ ] **Step 5: Commit** — `feat(frontend): shop-style cart, orders, auth and error pages`

---

### Task 8: 배포 + 시연 경로 확인

**Files:**
- Modify: `docs/demo/01-flash-sale-db/README.md`(진행 기록 한 줄), 설계 문서 변경이 있었다면 반영

- [ ] **Step 1: 배포** — 사용자에게 push 승인을 받은 뒤 진행한다. 데모 환경이 내려가 있으면 다음 demo-up 후에 한다.
  - `git push origin feat/demo-01-flash-sale:main feat/demo-01-flash-sale`
  - push로 실행된 cd가 성공하는지 확인한다.
- [ ] **Step 2: 화면 승인** — ALB 주소로 홈·상세·장바구니·주문내역·로그인·회원가입을 사용자가 직접 확인한다.
- [ ] **Step 3: k6 경로**
  - `kubectl -n ringdog logs deploy/traffic-browser --since=10m`에 selector timeout·strict mode 에러가 없어야 한다.
  - Datadog RUM(`env:demo`, HeadlessChrome)에 `장바구니`·`결제하기` 액션이 10분 안에 들어와야 한다.
- [ ] **Step 4: 장애 중 경로**
  - demo-control `inject` 후 6분 안에 결제 버튼 rage click이 RUM에 잡히고, 인기상품 위젯이 느리게 뜨거나 숨겨지는 것을 화면으로 확인한다.
  - 확인이 끝나면 demo-control `reset`.
- [ ] **Step 5: dead click** — RUM에서 배포 전후 30분의 `dead_click` 수와 대상 요소를 비교한다. 새 화면 요소가 원인인 dead click은 0이어야 한다.
- [ ] **Step 6: Commit** — `docs(demo-01): record frontend redesign verification`
