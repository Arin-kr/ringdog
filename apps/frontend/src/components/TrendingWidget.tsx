"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
import { carouselEdges, carouselStep } from "@/lib/carousel";
import { formatWon } from "@/lib/displayMeta";
import { productImages } from "@/lib/productImage";
import { loadTrending, TrendingResponse, TrendingState } from "@/lib/trending";

// 플래그가 꺼져 있으면 응답이 바로 오므로, 그 사이에는 스켈레톤을 그리지 않는다
// (꺼진 화면 = 기존 홈 화면, 빈 자리도 깜빡임도 없음).
const SKELETON_DELAY_MS = 300;
const SKELETON_CARDS = 6;

type WidgetState = TrendingState | { status: "loading" } | { status: "pending" };

const CARD = "w-36 shrink-0";
const ARROW =
  "flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-base text-stone-600 transition hover:bg-stone-50 disabled:cursor-default disabled:opacity-40";

/**
 * 시나리오 ① "실시간 인기상품" 위젯. 플래그는 페이지 로드 때 한 번만 확인한다 —
 * 보고 있는 화면에서 갑자기 접혀 상품 목록이 밀려 올라가지 않게 하기 위해서다.
 * 상품 목록(ProductCatalog)은 이 위젯을 기다리지 않는다.
 *
 * 높이는 고정값 대신 내용에 맞춘다. 스켈레톤이 같은 머리글·카드 구조를 그려서
 * 로딩 → 표시 때 높이가 같고(목록이 밀리지 않음) 세로 스크롤도 생기지 않는다.
 * 가로로 넘치는 카드는 스크롤바 대신 [<] [>] 버튼으로 넘긴다 (터치 스와이프는 그대로 됨).
 * 카드는 순위·사진·이름·가격만 보여 주는 상세 링크다(장바구니 버튼 없음).
 */
export function TrendingWidget(): JSX.Element | null {
  const [state, setState] = useState<WidgetState>({ status: "pending" });
  const listRef = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ canPrev: false, canNext: false });

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

  const updateEdges = useCallback(() => {
    const list = listRef.current;
    if (list) setEdges(carouselEdges(list));
  }, []);

  // 카드가 그려진 뒤와 화면 폭이 바뀔 때 버튼 상태를 다시 계산한다.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(list);
    return () => observer.disconnect();
  }, [state, updateEdges]);

  const scrollByStep = (direction: -1 | 1): void => {
    const list = listRef.current;
    if (list) list.scrollBy({ left: direction * carouselStep(list.clientWidth), behavior: "smooth" });
  };

  if (state.status === "pending" || state.status === "hidden") {
    return null;
  }

  const loading = state.status === "loading";
  const showArrows = !loading && (edges.canPrev || edges.canNext);

  return (
    <section aria-label="실시간 인기상품" aria-busy={loading} className="mb-8">
      <div className="flex h-8 items-center justify-between">
        <h2 className="text-xl font-bold text-stone-900">실시간 인기상품</h2>
        {showArrows && (
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="이전 인기상품"
              className={ARROW}
              disabled={!edges.canPrev}
              onClick={() => scrollByStep(-1)}
            >
              &lt;
            </button>
            <button
              type="button"
              aria-label="다음 인기상품"
              className={ARROW}
              disabled={!edges.canNext}
              onClick={() => scrollByStep(1)}
            >
              &gt;
            </button>
          </div>
        )}
      </div>
      <ol
        ref={listRef}
        onScroll={updateEdges}
        className="no-scrollbar mt-3 flex snap-x gap-4 overflow-x-auto overflow-y-hidden"
      >
        {loading
          ? Array.from({ length: SKELETON_CARDS }, (_, i) => (
              <li key={i} aria-hidden className={CARD}>
                <div className="aspect-square w-full animate-pulse rounded-lg bg-stone-100" />
                <div className="mt-1 h-6 animate-pulse rounded bg-stone-100" />
                <div className="mt-1 h-6 w-2/3 animate-pulse rounded bg-stone-100" />
              </li>
            ))
          : state.items.map((item, index) => (
              <li key={item.id} className={`${CARD} snap-start`}>
                <Link href={`/products/${item.id}`} className="block text-inherit no-underline">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImages(item)[0]}
                      alt={item.name}
                      className="aspect-square w-full rounded-lg bg-stone-100 object-cover"
                    />
                    <span className="absolute left-0 top-0 rounded-br-lg rounded-tl-lg bg-stone-900 px-2 py-0.5 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[15px] leading-6 text-stone-800">{item.name}</div>
                  <div className="text-base font-bold leading-6 text-stone-900">{formatWon(item.price)}</div>
                </Link>
              </li>
            ))}
      </ol>
    </section>
  );
}
