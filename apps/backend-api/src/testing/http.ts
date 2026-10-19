import { vi } from "vitest";
import type { Response } from "express";

export type MockRes = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

/** 테스트용 Express Response 목. status()/json() 체이닝을 지원한다. */
export function mockRes(): MockRes {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as MockRes;
}
