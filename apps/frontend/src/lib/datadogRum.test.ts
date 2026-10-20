import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
vi.mock("@datadog/browser-rum", () => ({ datadogRum: { init } }));
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
