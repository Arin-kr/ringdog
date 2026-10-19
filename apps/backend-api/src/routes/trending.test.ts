import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";

import { mockRes } from "../testing/http";
import { createTrendingHandler } from "./trending";

const req = {} as Request;
const item = { id: "p1", name: "별 키링", price: 4550, imageUrl: null, tags: ["미니", "별"], sold: 12 };

describe("GET /api/products/trending", () => {
  it("returns enabled:false without touching the DB when the flag is off", async () => {
    const fetchTrending = vi.fn();
    const res = mockRes();
    await createTrendingHandler({ isEnabled: () => false, fetchTrending })(req, res, vi.fn());
    expect(fetchTrending).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ enabled: false, items: [] });
  });

  it("returns the aggregated items when the flag is on", async () => {
    const res = mockRes();
    await createTrendingHandler({ isEnabled: () => true, fetchTrending: async () => [item] })(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ enabled: true, items: [item] });
  });

  it("passes DB errors to the error handler", async () => {
    const next = vi.fn();
    const boom = new Error("canceling statement due to statement timeout");
    await createTrendingHandler({ isEnabled: () => true, fetchTrending: async () => Promise.reject(boom) })(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
