import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const setUser = vi.fn();
const clearUser = vi.fn();
vi.mock("@datadog/browser-rum", () => ({ datadogRum: { init, setUser, clearUser } }));
vi.mock("@datadog/browser-rum-nextjs", () => ({ nextjsPlugin: () => ({ name: "nextjs" }) }));

const config = { applicationId: "app", clientToken: "token" };

describe("initRum", () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a no-op on the server", async () => {
    const { initRum } = await import("./datadogRum");
    initRum(config);
    expect(init).not.toHaveBeenCalled();
  });

  it("initializes once across repeated renders", async () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost" } });
    const { initRum } = await import("./datadogRum");
    initRum(config);
    initRum(config);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it("skips when credentials are missing", async () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost" } });
    const { initRum } = await import("./datadogRum");
    initRum({});
    expect(init).not.toHaveBeenCalled();
  });
});

// Unsigned JWT-shaped token: header.payload.signature, base64url payload.
const tokenFor = (payload: object): string =>
  `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

describe("setRumUserFromToken", () => {
  beforeEach(() => {
    vi.resetModules();
    setUser.mockClear();
    clearUser.mockClear();
  });

  it("tags the session with the member id only (no email)", async () => {
    const { setRumUserFromToken } = await import("./datadogRum");
    setRumUserFromToken(tokenFor({ userId: "u-1", email: "a@b.c", role: "customer" }));
    expect(setUser).toHaveBeenCalledWith({ id: "u-1" });
    expect(clearUser).not.toHaveBeenCalled();
  });

  it("clears the user for guests", async () => {
    const { setRumUserFromToken } = await import("./datadogRum");
    setRumUserFromToken(null);
    expect(clearUser).toHaveBeenCalledTimes(1);
    expect(setUser).not.toHaveBeenCalled();
  });

  it("treats a malformed token as a guest", async () => {
    const { setRumUserFromToken } = await import("./datadogRum");
    setRumUserFromToken("not-a-jwt");
    expect(clearUser).toHaveBeenCalledTimes(1);
    expect(setUser).not.toHaveBeenCalled();
  });
});
