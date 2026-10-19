export interface TrendingItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  tags: string[];
  sold: number;
}

export interface TrendingResponse {
  enabled: boolean;
  items: TrendingItem[];
}

export type TrendingState = { status: "hidden" } | { status: "ready"; items: TrendingItem[] };

export type TrendingFetcher = (path: string, init: { signal: AbortSignal }) => Promise<TrendingResponse>;

/** 장애 중에도 화면에 에러를 띄우지 않도록, 늦거나 실패하면 위젯을 숨긴다. */
export const TRENDING_TIMEOUT_MS = 5000;

export async function loadTrending(
  fetcher: TrendingFetcher,
  timeoutMs: number = TRENDING_TIMEOUT_MS,
): Promise<TrendingState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const data = await fetcher("/api/products/trending", { signal: controller.signal });
    if (!data.enabled || data.items.length === 0) {
      return { status: "hidden" };
    }
    return { status: "ready", items: data.items };
  } catch {
    return { status: "hidden" };
  } finally {
    clearTimeout(timer);
  }
}
