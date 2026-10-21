"use client";

import { Product } from "@ringdog/shared";
import { useEffect, useState } from "react";

import { ProductCard } from "@/components/ProductCard";
import { apiFetch } from "@/lib/apiClient";

export function SimilarProducts({ subject, currentId }: { subject: string | null; currentId: string }): JSX.Element | null {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    if (!subject) return;
    let cancelled = false;
    setItems([]);
    apiFetch<{ items: Product[] }>(`/api/products/search?q=${encodeURIComponent(subject)}&limit=6`)
      .then((data) => {
        if (!cancelled) setItems(data.items.filter((p) => p.id !== currentId).slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subject, currentId]);

  if (!subject || items.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold text-stone-900">이 상품과 비슷한 상품</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((p) => (
          <ProductCard key={p.id} id={p.id} name={p.name} price={p.price} imageUrl={p.imageUrl} tags={p.tags} />
        ))}
      </div>
    </section>
  );
}
