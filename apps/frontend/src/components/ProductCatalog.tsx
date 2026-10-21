"use client";

import { Product } from "@ringdog/shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch, ApiError } from "@/lib/apiClient";
import { isLoggedIn } from "@/lib/auth";
import { hasMore, mergeProducts } from "@/lib/paging";

import { BannerCarousel } from "./home/BannerCarousel";
import { CategoryIcons } from "./home/CategoryIcons";
import { ProductCard } from "./ProductCard";
import { TrendingWidget } from "./TrendingWidget";

const PAGE_SIZE = 24;

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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (pageNo: number): Promise<ProductsResponse> => {
      const path = q
        ? `/api/products/search?q=${encodeURIComponent(q)}&page=${pageNo}&limit=${PAGE_SIZE}`
        : `/api/products?page=${pageNo}&limit=${PAGE_SIZE}`;
      return apiFetch<ProductsResponse>(path);
    },
    [q],
  );

  // q가 바뀌면 처음부터 다시 불러온다. 늦게 도착한 이전 요청의 응답은 버린다.
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setProducts([]);
    setTotal(0);
    setPage(1);
    fetchPage(1)
      .then((data) => {
        if (id !== requestId.current) return;
        setProducts(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "상품을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [fetchPage]);

  async function handleLoadMore(): Promise<void> {
    const id = requestId.current;
    const next = page + 1;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchPage(next);
      if (id !== requestId.current) return;
      setProducts((prev) => mergeProducts(prev, data.items));
      setTotal(data.total);
      setPage(next);
    } catch (err) {
      if (id === requestId.current) {
        setError(err instanceof Error ? err.message : "상품을 불러오지 못했습니다.");
      }
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }

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

  const empty = !loading && !error && products.length === 0;

  return (
    <div>
      {!q && (
        <>
          <BannerCarousel />
          <CategoryIcons />
          <TrendingWidget />
        </>
      )}

      <section id="all-products" className="scroll-mt-4">
        {q ? (
          <h1 className="text-2xl font-bold text-stone-900">
            &apos;{q}&apos; 검색 결과{!loading && !error ? ` ${total.toLocaleString("ko-KR")}개` : ""}
          </h1>
        ) : (
          <h2 className="text-xl font-bold text-stone-900">
            전체 상품 <span className="text-base font-normal text-stone-500">{total.toLocaleString("ko-KR")}개</span>
          </h2>
        )}

        {cartMessage && (
          <p className="mt-4 rounded-lg bg-mint-50 px-4 py-3 text-[15px] text-mint-700">{cartMessage}</p>
        )}
        {loading && <p className="mt-4 text-stone-500">불러오는 중...</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}

        {empty && (
          <div className="mt-8 text-center">
            <p className="text-lg text-stone-700">검색 결과가 없습니다.</p>
            <Link href="/" className="mt-3 inline-block text-primary-600 hover:underline">
              홈으로 돌아가기
            </Link>
          </div>
        )}

        {products.length > 0 && (
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-8">
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

        {!loading && products.length > 0 && hasMore(products.length, total) && (
          <div className="mt-8 text-center">
            <button
              type="button"
              disabled={loadingMore}
              className="rounded border border-stone-300 bg-white px-10 py-3 text-base font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-default disabled:opacity-60"
              onClick={() => void handleLoadMore()}
            >
              {loadingMore ? "불러오는 중..." : "더보기"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
