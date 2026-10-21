"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Order, OrderStatus } from "@ringdog/shared";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";
import { formatWon } from "@/lib/displayMeta";
import { productImages } from "@/lib/productImage";

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
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-stone-900">주문 내역</h1>

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
              <li key={order.id} className="rounded-lg border border-stone-200 bg-white">
                <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-4 py-3">
                  <div>
                    <div className="font-bold text-stone-900">{formatDate(order.createdAt)}</div>
                    <div className="text-sm text-stone-500">주문번호 {order.id.slice(0, 8)}</div>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded px-2.5 py-1 text-sm font-semibold ${STATUS_BADGE_CLASS[order.status]}`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>

                <ul className="flex flex-col divide-y divide-stone-100 px-4">
                  {order.items?.map((item) => {
                    const product = item.product as
                      | (NonNullable<typeof item.product> & { tags?: string[] })
                      | undefined;
                    const [image] = productImages({
                      id: item.productId,
                      name: product?.name ?? "",
                      tags: product?.tags ?? [],
                      imageUrl: product?.imageUrl ?? null,
                    });
                    return (
                      <li key={item.id} className="flex items-center gap-3 py-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image}
                          alt={product?.name ?? "상품"}
                          className="h-16 w-16 shrink-0 rounded-lg bg-stone-100 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[15px] text-stone-800">{product?.name ?? "상품"}</div>
                          <div className="text-sm text-stone-500">수량 {item.quantity}개</div>
                        </div>
                        <div className="font-medium text-stone-800">{formatWon(item.unitPrice * item.quantity)}</div>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
                  <span className="text-lg font-bold text-stone-900">합계: {formatWon(order.totalAmount)}</span>
                  {CANCELLABLE_STATUSES.includes(order.status) && (
                    <button
                      type="button"
                      disabled={cancellingId === order.id}
                      onClick={() => handleCancel(order.id)}
                      className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
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
