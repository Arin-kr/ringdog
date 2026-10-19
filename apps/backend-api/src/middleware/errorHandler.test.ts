import { afterEach, describe, expect, it, vi } from "vitest";

const setTag = vi.fn();
vi.mock("dd-trace", () => ({
  default: { scope: () => ({ active: () => ({ setTag, context: () => null }) }) },
}));

import { errorHandler } from "./errorHandler";
import { mockRes } from "../testing/http";

const req = { path: "/api/orders/checkout", method: "POST" } as import("express").Request;

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setTag.mockClear();
  });

  it("logs standard error.* fields and tags the active span for 500s", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = new TypeError("Cannot read properties of undefined (reading 'trim')");
    const res = mockRes();

    errorHandler(err, req, res, vi.fn());

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error.kind).toBe("TypeError");
    expect(line.error.message).toBe(err.message);
    expect(line.error.stack).toContain("TypeError");
    expect(line.status).toBe(500);
    expect(setTag).toHaveBeenCalledWith("error", err);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Internal server error" } });
  });

  it("does not tag the span or expose a stack for 4xx errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = Object.assign(new Error("Out of stock"), { status: 409 });
    const res = mockRes();

    errorHandler(err, req, res, vi.fn());

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error).toBeUndefined();
    expect(setTag).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "Out of stock" } });
  });
});
