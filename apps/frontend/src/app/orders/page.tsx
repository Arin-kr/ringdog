"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Order, OrderStatus } from "@ringdog/shared";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";

interface OrdersResponse {
  items: Order[];
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "결제 대기",
  PAID: "결제 완료",
  SHIPPED: "배송 완료",
  CANCELLED: "취소됨",
};

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-mint-100 text-mint-700",
  SHIPPED: "bg-sky-100 text-sky-700",
  CANCELLED: "bg-stone-200 text-stone-500",
};

const CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING", "PAID"];

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default function OrdersPage(): JSX.Element {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<OrdersResponse>("/api/orders", { auth: true });
      setOrders(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "주문 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    void loadOrders();
  }, [router, loadOrders]);

  async function handleCancel(orderId: string): Promise<void> {
    setCancellingId(orderId);
    setError(null);
    try {
      const updated = await apiFetch<Order>(`/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        auth: true,
      });
      setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "주문 취소에 실패했습니다.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="font-heading text-2xl text-stone-800">주문 내역</h1>

        {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}

        {!loading && orders.length === 0 && !error && (
          <p className="mt-4 text-stone-600">
            아직 주문 내역이 없습니다.{" "}
            <Link href="/" className="font-medium text-primary-600 underline">
              상품 보러가기
            </Link>
          </p>
        )}

        {!loading && orders.length > 0 && (
          <ul className="mt-6 flex flex-col gap-4">
            {orders.map((order) => (
              <li key={order.id} className="rounded-2xl bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-stone-800">주문번호 {order.id.slice(0, 8)}</div>
                    <div className="text-sm text-stone-400">{formatDate(order.createdAt)}</div>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[order.status]}`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>

                <ul className="mt-3 flex flex-col gap-1 text-sm text-stone-600">
                  {order.items?.map((item) => (
                    <li key={item.id}>
                      {item.product?.name ?? "상품"} × {item.quantity}
                      <span className="text-stone-400"> ({formatPrice(item.unitPrice * item.quantity)})</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="font-bold text-stone-800">합계: {formatPrice(order.totalAmount)}</span>
                  {CANCELLABLE_STATUSES.includes(order.status) && (
                    <button
                      type="button"
                      disabled={cancellingId === order.id}
                      onClick={() => handleCancel(order.id)}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-200 disabled:opacity-50"
                    >
                      {cancellingId === order.id ? "취소 중..." : "주문 취소"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
