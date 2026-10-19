import { RequestHandler } from "express";

import type { TrendingItem } from "../lib/trending";

export interface TrendingDeps {
  isEnabled: () => boolean;
  fetchTrending: () => Promise<TrendingItem[]>;
}

/** GET /api/products/trending — 시나리오 ① "실시간 인기상품" 위젯. 플래그가 꺼지면 DB를 건드리지 않는다. */
export function createTrendingHandler(deps: TrendingDeps): RequestHandler {
  return async (_req, res, next) => {
    if (!deps.isEnabled()) {
      res.status(200).json({ enabled: false, items: [] });
      return;
    }
    try {
      const items = await deps.fetchTrending();
      res.status(200).json({ enabled: true, items });
    } catch (err) {
      next(err);
    }
  };
}
