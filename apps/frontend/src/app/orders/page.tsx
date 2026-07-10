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
      <main className="orders-page">
        <h1>주문 내역</h1>

        {loading && <p>불러오는 중...</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && orders.length === 0 && !error && (
          <p>
            아직 주문 내역이 없습니다. <Link href="/">상품 보러가기</Link>
          </p>
        )}

        {!loading && orders.length > 0 && (
          <ul className="order-list">
            {orders.map((order) => (
              <li key={order.id} className="order-card">
                <div className="order-card__header">
                  <div>
                    <div className="order-card__id">주문번호 {order.id.slice(0, 8)}</div>
                    <div className="muted">{formatDate(order.createdAt)}</div>
                  </div>
                  <span className={`order-status order-status--${order.status.toLowerCase()}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>

                <ul className="order-card__items">
                  {order.items?.map((item) => (
                    <li key={item.id}>
                      {item.product?.name ?? "상품"} × {item.quantity}
                      <span className="muted"> ({formatPrice(item.unitPrice * item.quantity)})</span>
                    </li>
                  ))}
                </ul>

                <div className="order-card__footer">
                  <span className="order-card__total">합계: {formatPrice(order.totalAmount)}</span>
                  {CANCELLABLE_STATUSES.includes(order.status) && (
                    <button
                      type="button"
                      className="button button--small"
                      disabled={cancellingId === order.id}
                      onClick={() => handleCancel(order.id)}
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
