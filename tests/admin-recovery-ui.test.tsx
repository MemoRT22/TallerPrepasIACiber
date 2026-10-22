import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createApp } from "../server/index";
import { useGame, type GameConnection } from "../client/useGame";

test(
  "acceso único descarta solo la sala obsoleta y permite crear desde el mismo panel",
  { timeout: 10000 },
  async () => {
    const bundle = await createApp({
      root: process.cwd(),
      env: "production",
      adminKey: "operator-recovery-test",
    });
    await new Promise<void>((resolve) =>
      bundle.server.listen(0, "127.0.0.1", resolve),
    );
    const address = bundle.server.address();
    assert(address && typeof address === "object");
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: `http://127.0.0.1:${address.port}/docente#access=operator-recovery-test`,
    });
    for (const [key, value] of Object.entries({
      window: dom.window,
      document: dom.window.document,
      location: dom.window.location,
      history: dom.window.history,
      localStorage: dom.window.localStorage,
      sessionStorage: dom.window.sessionStorage,
      IS_REACT_ACT_ENVIRONMENT: true,
    })) {
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    dom.window.localStorage.setItem(
      "cancun:admin:session",
      JSON.stringify({ code: "1658", kind: "admin", token: "obsolete" }),
    );
    let latest: GameConnection | undefined;
    function Probe() {
      latest = useGame("admin");
      return null;
    }
    const root = createRoot(dom.window.document.getElementById("root")!);
    try {
      await act(async () => root.render(createElement(Probe)));
      for (let i = 0; i < 100; i++) {
        await act(
          async () => await new Promise((resolve) => setTimeout(resolve, 20)),
        );
        if (latest?.connected) break;
      }
      assert(latest?.connected);
      assert(latest.canCreate);
      assert.equal(latest.session, null);
      assert.equal(
        dom.window.localStorage.getItem("cancun:admin:session"),
        null,
      );
      assert.equal(
        dom.window.sessionStorage.getItem("cancun:operator"),
        "operator-recovery-test",
      );
      assert.equal(dom.window.location.pathname, "/docente");
      let result: Awaited<ReturnType<GameConnection["request"]>> | undefined;
      await act(async () => {
        result = await latest!.request("create", {
          capacity: 3,
          autoStart: true,
        });
      });
      assert(result?.ok && result.snapshot && result.session);
      assert.equal(result.snapshot.public.capacity, 3);
      assert.equal(
        (latest as GameConnection).session?.code,
        result.session.code,
      );
      assert.equal(latest!.error, "");
    } finally {
      await act(async () => root.unmount());
      await bundle.close();
      dom.window.close();
    }
  },
);
