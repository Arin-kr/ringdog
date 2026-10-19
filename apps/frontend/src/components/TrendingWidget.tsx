"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductIcon } from "@/components/ProductIcon";
import { apiFetch } from "@/lib/apiClient";
import { loadTrending, TrendingResponse, TrendingState } from "@/lib/trending";

// 플래그가 꺼져 있으면 응답이 바로 오므로, 그 사이에는 스켈레톤을 그리지 않는다
// (꺼진 화면 = 기존 홈 화면, 빈 자리도 깜빡임도 없음).
const SKELETON_DELAY_MS = 300;

type WidgetState = TrendingState | { status: "loading" } | { status: "pending" };

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);
}

/**
 * 시나리오 ① "실시간 인기상품" 위젯. 플래그는 페이지 로드 때 한 번만 확인한다 —
 * 보고 있는 화면에서 갑자기 접혀 상품 목록이 밀려 올라가지 않게 하기 위해서다.
 * 상품 목록(ProductCatalog)은 이 위젯을 기다리지 않는다.
 */
export function TrendingWidget(): JSX.Element | null {
  const [state, setState] = useState<WidgetState>({ status: "pending" });

  useEffect(() => {
    let active = true;
    const skeletonTimer = setTimeout(() => {
      if (active) setState((s) => (s.status === "pending" ? { status: "loading" } : s));
    }, SKELETON_DELAY_MS);

    void loadTrending((path, init) => apiFetch<TrendingResponse>(path, init)).then((result) => {
      if (active) setState(result);
    });

    return () => {
      active = false;
      clearTimeout(skeletonTimer);
    };
  }, []);

  if (state.status === "pending" || state.status === "hidden") {
    return null;
  }

  if (state.status === "loading") {
    return <div aria-hidden className="mb-6 h-56 animate-pulse rounded-2xl bg-cream" />;
  }

  return (
    <section aria-label="실시간 인기상품" className="mb-6 h-56 rounded-2xl bg-white p-4 shadow-soft">
      <h2 className="font-heading text-lg text-stone-800">실시간 인기상품</h2>
      <ol className="mt-2 flex gap-3 overflow-x-auto">
        {state.items.map((item, index) => (
          <li key={item.id} className="w-24 shrink-0">
            <Link href={`/products/${item.id}`} className="text-inherit no-underline">
              <ProductIcon tags={item.tags} name={item.name} className="aspect-square w-full" />
              <div className="mt-1 truncate text-xs text-stone-700">
                {index + 1}. {item.name}
              </div>
              <div className="text-xs text-stone-500">{formatPrice(item.price)}</div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
