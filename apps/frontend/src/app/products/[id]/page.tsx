"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Product } from "@ringdog/shared";

import { Header } from "@/components/Header";
import { ProductGallery } from "@/components/product/ProductGallery";
import { SimilarProducts } from "@/components/product/SimilarProducts";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";
import { categoryForTags, categorySearchHref, subjectSearchHref } from "@/lib/categories";
import { displayMeta, formatWon, reviewsFor } from "@/lib/displayMeta";
import { productImages } from "@/lib/productImage";

function Stars({ rating }: { rating: number }): JSX.Element {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-amber-500">
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
    </span>
  );
}

export default function ProductDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQuantity(1);
    setCartMessage(null);
    setBusy(false);
    try {
      const data = await apiFetch<Product>(`/api/products/${params.id}`);
      setProduct(data);
    } catch (err) {
      setProduct(null);
      setError(err instanceof ApiError && err.status === 404 ? "상품을 찾을 수 없습니다." : "상품을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const view = useMemo(() => {
    if (!product) return null;
    return {
      meta: displayMeta(product.id, product.price),
      images: productImages(product, 4),
      reviews: reviewsFor(product.id, 3),
      cat: categoryForTags(product.tags),
    };
  }, [product]);

  async function addToCart(): Promise<boolean> {
    if (!isLoggedIn()) {
      setCartMessage("장바구니에 담으려면 로그인이 필요합니다.");
      return false;
    }
    if (!product) return false;
    setBusy(true);
    try {
      await apiFetch("/api/cart/items", {
        method: "POST",
        auth: true,
        body: { product_id: product.id, quantity },
      });
      setCartMessage("장바구니에 담았습니다.");
      return true;
    } catch (err) {
      setCartMessage(err instanceof ApiError ? err.message : "장바구니 추가에 실패했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleBuyNow(): Promise<void> {
    if (await addToCart()) router.push("/cart");
  }

  const soldOut = product ? product.stock <= 0 : false;
  const qtyBtn =
    "h-8 w-8 rounded border border-stone-300 text-base text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";
  const reviewCount = view ? view.meta.reviewCount.toLocaleString("ko-KR") : "";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 text-[15px] text-stone-800">
        {loading && <p className="text-stone-500">불러오는 중...</p>}
        {error && (
          <div>
            <p className="text-red-600">{error}</p>
            <p className="mt-2">
              <Link href="/" className="text-primary-600 hover:underline">
                홈으로
              </Link>
            </p>
          </div>
        )}

        {!loading && product && view && (
          <>
            <nav className="text-sm text-stone-500" aria-label="카테고리 경로">
              <Link href="/" className="hover:text-primary-600">
                홈
              </Link>
              {view.cat ? (
                <>
                  {" › "}
                  <Link href={categorySearchHref(view.cat.category)} className="hover:text-primary-600">
                    {view.cat.category.label}
                  </Link>
                  {" › "}
                  <Link href={subjectSearchHref(view.cat.subject)} className="hover:text-primary-600">
                    {view.cat.subject}
                  </Link>
                </>
              ) : (
                <> › 전체 상품</>
              )}
            </nav>

            <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-[0.8fr_1.3fr]">
              <ProductGallery images={view.images} alt={product.name} />

              <div>
                <h1 className="text-[22px] font-bold leading-snug text-stone-900">{product.name}</h1>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <Stars rating={view.meta.rating} />
                  <span className="text-stone-700">{view.meta.rating.toFixed(1)}</span>
                  <a href="#reviews" className="text-sky-700 hover:underline">
                    상품평 {reviewCount}개
                  </a>
                </div>

                <div className="mt-4">
                  {view.meta.discountRate > 0 && (
                    <div className="text-sm text-stone-400">
                      <span className="mr-1.5 text-[22px] font-extrabold text-primary-600">{view.meta.discountRate}%</span>
                      <span className="line-through">{formatWon(view.meta.originalPrice)}</span>
                    </div>
                  )}
                  <div className="text-[26px] font-extrabold text-stone-900">{formatWon(product.price)}</div>
                  <span className="mt-1.5 inline-block rounded bg-primary-600 px-2 py-0.5 text-[13px] text-white">
                    ⚡ 타임세일 · 오늘 자정까지
                  </span>
                </div>

                <dl className="mt-4 border-t border-stone-200 text-sm">
                  {[
                    ["배송", view.meta.shipping === "무료배송" ? "무료배송 · 2~3일 내 도착" : "내일 도착 예정"],
                    ["소재", product.tags[0] ?? "-"],
                    ["재고", soldOut ? "품절" : `${product.stock}개 남음`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex border-b border-stone-100 py-2">
                      <dt className="w-[70px] text-stone-500">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex items-center gap-2 text-[15px]">
                  <span className="mr-1">수량</span>
                  <button
                    type="button"
                    aria-label="수량 줄이기"
                    className={qtyBtn}
                    disabled={soldOut || quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    −
                  </button>
                  <span className="w-8 text-center" aria-live="polite">
                    {soldOut ? 0 : quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="수량 늘리기"
                    className={qtyBtn}
                    disabled={soldOut || quantity >= product.stock}
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  >
                    ＋
                  </button>
                </div>

                {cartMessage && <p className="mt-3 rounded-lg bg-mint-50 px-4 py-3 text-mint-700">{cartMessage}</p>}

                <div className="mt-4 flex gap-2">
                  {soldOut ? (
                    <button
                      type="button"
                      disabled
                      className="flex-1 rounded border border-stone-300 bg-stone-100 py-3 text-[15px] font-bold text-stone-400"
                    >
                      품절
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void addToCart()}
                        className="flex-1 rounded border border-primary-500 bg-white py-3 text-[15px] font-bold text-primary-600 transition hover:bg-primary-50 disabled:opacity-60"
                      >
                        장바구니 담기
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleBuyNow()}
                        className="flex-1 rounded border border-primary-600 bg-primary-600 py-3 text-[15px] font-bold text-white transition hover:bg-primary-700 disabled:opacity-60"
                      >
                        바로구매
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-10 flex border-y border-stone-200 border-b-2 border-b-stone-800 text-[15px]">
              <a href="#detail" className="flex-1 py-2.5 text-center font-bold text-stone-900 hover:bg-stone-50">
                상품상세
              </a>
              <a href="#reviews" className="flex-1 py-2.5 text-center text-stone-600 hover:bg-stone-50">
                상품평 ({reviewCount})
              </a>
              <a href="#shipping" className="flex-1 py-2.5 text-center text-stone-600 hover:bg-stone-50">
                배송·교환·반품
              </a>
            </div>

            <section id="detail" className="scroll-mt-20 py-6">
              <h2 className="text-lg font-bold text-stone-900">상품상세</h2>
              <p className="mt-3 leading-relaxed text-stone-700">{product.description}</p>
              {product.tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 text-sm text-stone-500">
                  {product.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-stone-100 px-3 py-1">
                      #{tag}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section id="reviews" className="scroll-mt-20 py-6">
              <h2 className="text-lg font-bold text-stone-900">상품평 ({reviewCount})</h2>
              <ul className="mt-2">
                {view.reviews.map((r, i) => (
                  <li key={i} className="border-b border-stone-100 py-3">
                    <Stars rating={r.rating} /> <span className="ml-1">{r.body}</span>
                    <div className="mt-1 text-sm text-stone-500">
                      {r.author} · {r.date}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section id="shipping" className="scroll-mt-20 py-6">
              <h2 className="text-lg font-bold text-stone-900">배송·교환·반품</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 leading-relaxed text-stone-700">
                <li>주문 후 영업일 기준 1~3일 내 출고됩니다.</li>
                <li>수령 후 7일 이내 교환·반품을 신청할 수 있습니다.</li>
                <li>단순 변심의 경우 왕복 배송비는 고객 부담입니다.</li>
              </ul>
            </section>

            <SimilarProducts subject={view.cat?.subject ?? null} currentId={product.id} />
          </>
        )}
      </main>
    </>
  );
}
