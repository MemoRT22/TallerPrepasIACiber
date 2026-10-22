import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApp } from "../server/index";
import { useGame, type GameConnection } from "../client/useGame";
import Admin from "../client/pages/Admin";
import { parseAdminLink } from "../client/adminLink";

const adminKey = "operator-share-test";
async function environment(fragment = "", blocked = false) {
  const bundle = await createApp({
    root: process.cwd(),
    env: "production",
    adminKey,
  });
  await new Promise<void>((resolve) =>
    bundle.server.listen(0, "127.0.0.1", resolve),
  );
  const address = bundle.server.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: `${origin}/docente?view=panel${fragment}`,
  });
  const denied = {
    getItem() {
      throw new Error("Storage blocked");
    },
    setItem() {
      throw new Error("Storage blocked");
    },
    removeItem() {
      throw new Error("Storage blocked");
    },
  };
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    history: dom.window.history,
    localStorage: blocked ? denied : dom.window.localStorage,
    sessionStorage: blocked ? denied : dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = dom.window.document.getElementById("root")!;
  let latest: GameConnection | undefined;
  function Probe() {
    latest = useGame("admin");
    return createElement(Admin, { game: latest });
  }
  let root = createRoot(host);
  async function mount() {
    await act(async () =>
      root.render(createElement(StrictMode, null, createElement(Probe))),
    );
    await ready();
  }
  async function ready() {
    for (let i = 0; i < 120; i++) {
      if (latest?.connected) return;
      await act(async () => await new Promise((r) => setTimeout(r, 15)));
    }
    assert(latest?.connected, "connection");
  }
  async function recreate() {
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount();
  }
  return {
    bundle,
    dom,
    host,
    origin,
    mount,
    recreate,
    game: () => {
      assert(latest);
      return latest;
    },
    close: async () => {
      await act(async () => root.unmount());
      await bundle.close();
      dom.window.close();
    },
  };
}

test(
  "enlace nuevo funciona con StrictMode, guarda acceso y limpia solo credenciales del URL",
  { timeout: 10000 },
  async () => {
    const e = await environment(`#access=${adminKey}&notice=ok`);
    try {
      await e.mount();
      assert(e.game().canCreate);
      assert.equal(
        e.dom.window.sessionStorage.getItem("cancun:operator"),
        adminKey,
      );
      assert.equal(e.dom.window.location.search, "?view=panel");
      assert.equal(e.dom.window.location.hash, "#notice=ok");
      assert(e.host.textContent?.includes("Cantidad de jugadores"));
      assert.equal(e.bundle.engine.rooms.size, 0);
      await e.recreate();
      assert(e.game().canCreate);
    } finally {
      await e.close();
    }
  },
);

test(
  "almacenamiento bloqueado no pierde enlace privado al montar o volver a cargar",
  { timeout: 10000 },
  async () => {
    const e = await environment(`#access=${adminKey}`, true);
    try {
      await e.mount();
      assert(e.game().canCreate);
      assert.equal(e.dom.window.location.hash, `#access=${adminKey}`);
      await e.recreate();
      assert(e.game().canCreate);
      assert.equal(e.bundle.engine.rooms.size, 0);
      let result: any;
      await act(async () => {
        result = await e
          .game()
          .request("create", { capacity: 3, autoStart: false });
      });
      assert(result.ok);
      assert.equal(result.snapshot.public.running, false);
    } finally {
      await e.close();
    }
  },
);

test(
  "pegar el enlace original habilita panel sin crear salas; clave errónea sigue rechazada por servidor",
  { timeout: 10000 },
  async () => {
    const e = await environment();
    try {
      await e.mount();
      assert(!e.game().canCreate);
      assert(e.host.querySelector('input[type="password"]'));
      let result: any;
      await act(async () => {
        result = await e.game().openAdminLink(e.origin + "/docente");
      });
      assert(!result.ok);
      assert(!e.game().canCreate);
      await act(async () => {
        result = await e
          .game()
          .openAdminLink(e.origin + "/docente#access=wrong-key");
      });
      assert(result.ok);
      await act(async () => {
        result = await e.game().request("create", { capacity: 3 });
      });
      assert(!result.ok);
      assert.equal(e.bundle.engine.rooms.size, 0);
      await act(async () => {
        result = await e
          .game()
          .openAdminLink(e.origin + `/docente#access=${adminKey}`);
      });
      assert(result.ok);
      assert(e.host.textContent?.includes("Cantidad de jugadores"));
      assert.equal(e.bundle.engine.rooms.size, 0);
      await act(async () => {
        result = await e
          .game()
          .request("create", { capacity: 3, autoStart: false });
      });
      assert(result.ok);
      assert.equal(result.snapshot.public.running, false);
    } finally {
      await e.close();
    }
  },
);

test("solo enlaces administrativos del mismo origen son formatos válidos", () => {
  const origin = "https://example.test";
  assert.equal(
    parseAdminLink(origin + "/jugar/8378/1#invite=test", origin),
    null,
  );
  assert.equal(
    parseAdminLink("https://other.test/docente#access=test", origin),
    null,
  );
  assert.equal(parseAdminLink("javascript:alert(1)", origin), null);
  assert.equal(parseAdminLink(origin + "/docente", origin), null);
  assert.deepEqual(
    parseAdminLink(origin + "/docente#room=8378&token=adm_test", origin),
    { session: { code: "8378", token: "adm_test", kind: "admin" } },
  );
});

test(
  "enlace de sala específico reanuda solo sesión válida sin crear otra sala",
  { timeout: 10000 },
  async () => {
    const e = await environment();
    try {
      await e.mount();
      const created = e.bundle.engine.create(3);
      assert(created.ok && created.session);
      let result: any;
      await act(async () => {
        result = await e
          .game()
          .openAdminLink(
            e.origin + `/docente#room=${created.session!.code}&token=invalid`,
          );
      });
      assert(!result.ok);
      assert(!e.game().canCreate);
      await act(async () => {
        result = await e
          .game()
          .openAdminLink(
            e.origin +
              `/docente#room=${created.session!.code}&token=${created.session!.token}`,
          );
      });
      assert(result.ok);
      assert(e.game().canCreate);
      assert.equal(e.game().session?.code, created.session.code);
      assert.equal(e.bundle.engine.rooms.size, 1);
    } finally {
      await e.close();
    }
  },
);

test(
  "formulario pega enlace con almacenamiento bloqueado y conserva acceso tras recarga",
  { timeout: 10000 },
  async () => {
    const e = await environment("", true);
    try {
      await e.mount();
      const input = e.host.querySelector(
        'input[type="password"]',
      ) as HTMLInputElement;
      assert(input);
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          e.dom.window.HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, e.origin + `/docente#access=${adminKey}`);
        input.dispatchEvent(new e.dom.window.Event("input", { bubbles: true }));
      });
      const submit = e.host.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;
      assert(submit && !submit.disabled);
      await act(async () => {
        e.host
          .querySelector("form")!
          .dispatchEvent(
            new e.dom.window.Event("submit", {
              bubbles: true,
              cancelable: true,
            }),
          );
      });
      assert(e.game().canCreate);
      assert(e.host.textContent?.includes("Cantidad de jugadores"));
      assert.equal(e.bundle.engine.rooms.size, 0);
      await e.recreate();
      assert(e.game().canCreate);
    } finally {
      await e.close();
    }
  },
);

test(
  "enlace abierto en pestaña ya cargada se reconoce sin recargar ni crear actividad",
  { timeout: 10000 },
  async () => {
    const e = await environment();
    try {
      await e.mount();
      assert(!e.game().canCreate);
      await act(async () => {
        e.dom.window.location.hash = `access=${adminKey}`;
        await new Promise((r) => setTimeout(r, 30));
      });
      assert(e.game().canCreate);
      assert.equal(e.bundle.engine.rooms.size, 0);
    } finally {
      await e.close();
    }
  },
);
