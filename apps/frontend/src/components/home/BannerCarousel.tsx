"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CATEGORIES, categorySearchHref } from "@/lib/categories";
import { BANNER_IMAGES } from "@/lib/productImage";

const AUTO_ADVANCE_MS = 5000;

const SLIDES = [
  { title: "타임세일 최대 50%", sub: "지금 담으면 세일가 그대로", href: "/?q=%EC%84%B8%EC%9D%BC" },
  { title: "새로 들어온 키링", sub: "신상품을 가장 먼저 만나 보세요", href: "/#all-products" },
  { title: "귀여운 동물 키링 모음", sub: "고양이 · 강아지 · 곰돌이", href: categorySearchHref(CATEGORIES[0]) },
];

const ARROW =
  "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-lg text-stone-700 shadow-soft transition hover:bg-white";

export function BannerCarousel(): JSX.Element {
  const [index, setIndex] = useState(0);
  const count = Math.min(SLIDES.length, BANNER_IMAGES.length);

  // 직접 넘기면(index 변경) 5초 타이머를 다시 시작한다.
  useEffect(() => {
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, count]);

  return (
    <section aria-label="이벤트 배너" className="relative mb-6 aspect-[3/1] min-h-[150px] overflow-hidden rounded-xl bg-stone-200">
      {SLIDES.slice(0, count).map((slide, i) => (
        <Link
          key={slide.title}
          href={slide.href}
          aria-hidden={i !== index}
          tabIndex={i === index ? 0 : -1}
          className={`absolute inset-0 text-inherit no-underline transition-opacity duration-500 ${
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BANNER_IMAGES[i]} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-stone-900/75 via-stone-900/40 to-transparent px-8 sm:px-14">
            <div className="text-2xl font-bold text-white sm:text-4xl">{slide.title}</div>
            <div className="mt-2 text-base text-white/90 sm:text-lg">{slide.sub}</div>
          </div>
        </Link>
      ))}
      <button
        type="button"
        aria-label="이전 배너"
        className={`${ARROW} left-3`}
        onClick={() => setIndex((index - 1 + count) % count)}
      >
        &lt;
      </button>
      <button
        type="button"
        aria-label="다음 배너"
        className={`${ARROW} right-3`}
        onClick={() => setIndex((index + 1) % count)}
      >
        &gt;
      </button>
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`배너 ${i + 1}`}
            aria-current={i === index}
            className={`h-2.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2.5 bg-white/60 hover:bg-white/90"}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
