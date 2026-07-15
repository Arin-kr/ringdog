"use client";

import { Product } from "@ringdog/shared";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";

import { ProductCard } from "./ProductCard";

interface ProductsResponse {
  items: Product[];
  page: number;
  limit: number;
  total: number;
}

export function ProductCatalog(): JSX.Element {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const path = q
        ? `/api/products/search?q=${encodeURIComponent(q)}&limit=24`
        : "/api/products?limit=24";
      const data = await apiFetch<ProductsResponse>(path);
      setProducts(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function handleAddToCart(productId: string): Promise<void> {
    if (!isLoggedIn()) {
      setCartMessage("장바구니에 담으려면 로그인이 필요합니다.");
      return;
    }

    try {
      await apiFetch("/api/cart/items", {
        method: "POST",
        auth: true,
        body: { product_id: productId, quantity: 1 },
      });
      setCartMessage("장바구니에 담았습니다.");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "장바구니 추가에 실패했습니다.";
      setCartMessage(message);
    }
  }

  return (
    <section>
      <h1 className="font-heading text-2xl text-stone-800">{q ? `"${q}" 검색 결과` : "키링 상품"}</h1>
      <p className="mt-1 text-stone-500">{total}개 상품</p>

      {cartMessage && (
        <p className="mt-4 rounded-xl bg-mint-50 px-4 py-3 text-mint-700">{cartMessage}</p>
      )}
      {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              price={Number(product.price)}
              imageUrl={product.imageUrl}
              tags={product.tags}
              onAddToCart={() => handleAddToCart(product.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
