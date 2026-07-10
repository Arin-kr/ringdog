"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Product } from "@ringdog/shared";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

export default function ProductDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Product>(`/api/products/${params.id}`);
      setProduct(data);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "상품을 찾을 수 없습니다." : "상품을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  async function handleAddToCart(): Promise<void> {
    if (!isLoggedIn()) {
      setCartMessage("장바구니에 담으려면 로그인이 필요합니다.");
      return;
    }
    if (!product) {
      return;
    }

    try {
      await apiFetch("/api/cart/items", {
        method: "POST",
        auth: true,
        body: { product_id: product.id, quantity: 1 },
      });
      setCartMessage("장바구니에 담았습니다.");
    } catch (err) {
      setCartMessage(err instanceof ApiError ? err.message : "장바구니 추가에 실패했습니다.");
    }
  }

  return (
    <>
      <Header />
      <main className="product-detail-page">
        <p>
          <Link href="/">← 목록으로</Link>
        </p>

        {loading && <p>불러오는 중...</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && product && (
          <div className="product-detail">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="product-detail__image" />
            ) : (
              <div className="product-detail__image product-detail__image--placeholder" aria-hidden />
            )}

            <div className="product-detail__info">
              <h1>{product.name}</h1>
              <p className="product-detail__price">{formatPrice(product.price)}</p>

              {product.tags.length > 0 && (
                <ul className="product-detail__tags">
                  {product.tags.map((tag) => (
                    <li key={tag}>#{tag}</li>
                  ))}
                </ul>
              )}

              <p className="product-detail__description">{product.description}</p>
              <p className="muted">재고 {product.stock}개</p>

              {cartMessage && <p className="info-banner">{cartMessage}</p>}

              <button
                type="button"
                className="button"
                disabled={product.stock <= 0}
                onClick={handleAddToCart}
              >
                {product.stock > 0 ? "장바구니에 담기" : "품절"}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
