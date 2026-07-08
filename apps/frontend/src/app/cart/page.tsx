"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";

interface CartProduct {
  id: string;
  name: string;
  price: number;
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

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

export default function CartPage(): JSX.Element {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState("RINGDOG100");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
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
      setCheckingOut(false);
    }
  }

  return (
    <>
      <Header />
      <main className="cart-page">
        <h1>장바구니</h1>

        {loading && <p>불러오는 중...</p>}
        {error && <p className="error-text">{error}</p>}

        {orderResult && (
          <div className="success-banner">
            <p>주문이 완료되었습니다. (주문번호: {orderResult.order_id})</p>
            <p>결제 금액: {formatPrice(orderResult.total_amount)}</p>
            <Link href="/">쇼핑 계속하기</Link>
          </div>
        )}

        {!loading && !orderResult && items.length === 0 && (
          <p>
            장바구니가 비어 있습니다. <Link href="/">상품 보러가기</Link>
          </p>
        )}

        {!loading && items.length > 0 && (
          <>
            <ul className="cart-list">
              {items.map((item) => (
                <li key={item.id} className="cart-list__item">
                  <span>
                    {item.product.name} × {item.quantity}
                  </span>
                  <span>{formatPrice(Number(item.product.price) * item.quantity)}</span>
                  <button type="button" className="link-button" onClick={() => handleRemove(item.id)}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>

            <p className="cart-total">합계: {formatPrice(subtotal)}</p>

            <form className="checkout-form" onSubmit={handleCheckout}>
              <label>
                데모 쿠폰 (RINGDOG100 입력 시 0원)
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="RINGDOG100"
                />
              </label>
              <button type="submit" className="button" disabled={checkingOut}>
                {checkingOut ? "결제 처리 중..." : "결제하기"}
              </button>
            </form>
          </>
        )}
      </main>
    </>
  );
}
