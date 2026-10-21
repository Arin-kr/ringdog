"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";
import { formatWon } from "@/lib/displayMeta";
import { productImages } from "@/lib/productImage";

interface CartProduct {
  id: string;
  name: string;
  price: number;
  tags?: string[];
  imageUrl?: string | null;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: CartProduct;
}

interface CartResponse {
  items: CartItem[];
}

interface CheckoutResponse {
  order_id: string;
  status: string;
  total_amount: number;
}

export default function CartPage(): JSX.Element {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState("RINGDOG100");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  // state는 다음 렌더 전까지 갱신되지 않으므로 연타 차단은 ref로 즉시 판정한다.
  const checkingOutRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<CheckoutResponse | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const data = await apiFetch<CartResponse>("/api/cart", { auth: true });
        setItems(data.items);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "장바구니를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );

  async function handleRemove(itemId: string): Promise<void> {
    try {
      await apiFetch(`/api/cart/items/${itemId}`, { method: "DELETE", auth: true });
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "삭제에 실패했습니다.");
    }
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    // 결제 중 재클릭(연타)은 무시해 중복 주문을 막는다. 버튼은 enabled로 둬야
    // 브라우저가 click을 발생시키고 RUM이 Rage Click을 잡는다.
    if (checkingOutRef.current) return;
    checkingOutRef.current = true;
    setCheckingOut(true);
    setError(null);

    try {
      const result = await apiFetch<CheckoutResponse>("/api/orders/checkout", {
        method: "POST",
        auth: true,
        body: { coupon_code: couponCode || undefined },
      });
      setOrderResult(result);
      setItems([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "결제에 실패했습니다.");
    } finally {
      checkingOutRef.current = false;
      setCheckingOut(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-stone-900">장바구니</h1>

        {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}

        {orderResult && (
          <div className="mt-4 rounded-lg border border-mint-100 bg-mint-50 px-4 py-4 text-[15px] text-mint-700">
            <p className="font-bold">주문이 완료되었습니다.</p>
            <p className="mt-1">주문번호: {orderResult.order_id}</p>
            <p>결제 금액: {formatWon(orderResult.total_amount)}</p>
            <div className="mt-3 flex gap-4">
              <Link href="/orders" className="font-medium underline">
                주문 내역 보기
              </Link>
              <Link href="/" className="font-medium underline">
                쇼핑 계속하기
              </Link>
            </div>
          </div>
        )}

        {!loading && !orderResult && items.length === 0 && (
          <div className="mt-6 rounded-lg border border-stone-200 bg-white px-6 py-16 text-center text-stone-600">
            <p>장바구니가 비어 있습니다.</p>
            <Link href="/" className="mt-3 inline-block font-medium text-primary-600 underline">
              상품 보러가기
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px] md:items-start">
            <ul className="flex flex-col divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
              {items.map((item) => {
                const [image] = productImages({
                  id: item.product.id,
                  name: item.product.name,
                  tags: item.product.tags ?? [],
                  imageUrl: item.product.imageUrl ?? null,
                });
                return (
                  <li key={item.id} className="flex items-center gap-4 p-4">
                    <Link href={`/products/${item.product.id}`} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image}
                        alt={item.product.name}
                        className="h-20 w-20 rounded-lg bg-stone-100 object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${item.product.id}`}
                        className="line-clamp-2 text-[15px] text-stone-800 no-underline hover:underline"
                      >
                        {item.product.name}
                      </Link>
                      <div className="mt-1 text-sm text-stone-500">수량 {item.quantity}개</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-stone-900">
                        {formatWon(Number(item.product.price) * item.quantity)}
                      </div>
                      <button
                        type="button"
                        className="mt-1 text-sm text-stone-400 underline hover:text-red-600"
                        onClick={() => handleRemove(item.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="rounded-lg border border-stone-200 bg-white p-5 md:sticky md:top-24">
              <h2 className="text-base font-bold text-stone-900">결제 금액</h2>
              <dl className="mt-3 flex flex-col gap-2 text-[15px] text-stone-600">
                <div className="flex justify-between">
                  <dt>상품 금액</dt>
                  <dd>{formatWon(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>배송비</dt>
                  <dd>무료</dd>
                </div>
              </dl>
              <div className="mt-3 flex items-baseline justify-between border-t border-stone-200 pt-3">
                <span className="font-medium text-stone-800">총 결제 금액</span>
                <span className="text-xl font-bold text-primary-600">{formatWon(subtotal)}</span>
              </div>

              <form className="mt-5 flex flex-col gap-4" onSubmit={handleCheckout}>
                <label className="flex flex-col gap-1 text-sm text-stone-600">
                  데모 쿠폰 (RINGDOG100 입력 시 0원)
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="RINGDOG100"
                    className="rounded border border-stone-300 px-3 py-2 text-[15px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-primary-500 px-4 py-3 text-base font-bold text-white transition hover:bg-primary-600 aria-busy:opacity-50"
                  aria-busy={checkingOut}
                >
                  {checkingOut ? "결제 처리 중..." : "결제하기"}
                </button>
              </form>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
