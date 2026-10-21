/** 다음 페이지 상품을 이어 붙인다. id가 겹치면 먼저 받은 것을 남기고 순서를 유지한다. */
export function mergeProducts<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((p) => p.id));
  const merged = [...prev];
  for (const item of next) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

/** 더 불러올 상품이 남았는지(더보기 버튼 표시 여부). */
export function hasMore(loaded: number, total: number): boolean {
  return loaded < total;
}
