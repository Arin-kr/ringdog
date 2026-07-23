"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Product } from "@ringdog/shared";

import { Header } from "@/components/Header";
import { ProductIcon } from "@/components/ProductIcon";
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
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p>
          <Link href="/" className="text-sm text-stone-500 hover:text-primary-600">
            ← 목록으로
          </Link>
        </p>

        {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}

        {!loading && product && (
          <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-[minmax(0,280px)_1fr]">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="aspect-square w-full rounded-2xl object-cover" />
            ) : (
              <ProductIcon tags={product.tags} name={product.name} className="aspect-square w-full" />
            )}

            <div>
              <h1 className="font-heading text-2xl text-stone-800">{product.name}</h1>
              <p className="mt-2 text-xl font-bold text-primary-600">{formatPrice(product.price)}</p>

              {product.tags.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2 text-sm text-stone-500">
                  {product.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-stone-100 px-3 py-1">
                      #{tag}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-4 leading-relaxed text-stone-600">{product.description}</p>
              <p className="mt-2 text-sm text-stone-400">재고 {product.stock}개</p>

              {cartMessage && (
                <p className="mt-4 rounded-xl bg-mint-50 px-4 py-3 text-mint-700">{cartMessage}</p>
              )}

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={handleAddToCart}
                className="mt-4 rounded-full bg-primary-500 px-5 py-2.5 font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
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
