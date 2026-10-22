import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import Admin from "../client/pages/Admin";
import { GameEngine } from "../server/engine";
import type { GameConnection } from "../client/useGame";

const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', {
  url: "http://localhost/docente",
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: dom.window,
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: dom.window.document,
});
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: dom.window.location,
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});
QRCode.toDataURL = (async () =>
  "data:image/png;base64,test") as typeof QRCode.toDataURL;

function fixture() {
  const engine = new GameEngine();
  const created = engine.create(6);
  assert(created.session && created.snapshot);
  const calls: unknown[] = [];
  const game = {
    snapshot: created.snapshot,
    session: created.session,
    connected: true,
    busy: false,
    error: "",
    canCreate: true,
    setError: () => {},
    forget: () => {},
    leave: () => {},
    reconnect: () => {},
    openAdminLink: async () => ({ ok: false }),
    left: false,
    admin: async () => ({ ok: true }),
    act: async () => ({ ok: true }),
    request: async (event: string, payload: unknown) => {
      calls.push({ event, payload });
      return { ok: false, error: "Fallo simulado" };
    },
  } as GameConnection;
  return { game, calls, engine };
}
const container = document.getElementById("root")!;
function findButton(text: string) {
  const b = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(text),
  );
  assert(b, `Falta botón ${text}`);
  return b;
}
async function click(button: HTMLButtonElement) {
  await act(async () =>
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
  );
}

test("selector superior permanente conserva borrador y confirma el cupo en la misma sala", async () => {
  const { game, calls, engine } = fixture();
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(Admin, {
          game: { ...game, snapshot: null, connected: false },
        }),
      ),
    );
    assert(container.textContent?.includes("Recuperando tu experiencia"));
    assert(!container.querySelector('[aria-label="3 jugadores"]'));
    await act(async () => root.render(createElement(Admin, { game })));
    assert(container.querySelector('[aria-label="3 jugadores"]'));
    const consoleElement = container.querySelector("#admin-console");
    const capacityPanel = container.querySelector(".admin-capacity-panel");
    assert(capacityPanel && consoleElement);
    assert(
      capacityPanel.compareDocumentPosition(consoleElement) &
        dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await click(
      container.querySelector<HTMLButtonElement>('[aria-label="3 jugadores"]')!,
    );
    for (let i = 0; i < 4; i++)
      await act(async () =>
        root.render(
          createElement(Admin, {
            game: {
              ...game,
              connected: i !== 1,
              snapshot: {
                ...game.snapshot!,
                public: { ...game.snapshot!.public, connectedCount: i },
              },
            },
          }),
        ),
      );
    assert.equal(
      container
        .querySelector('[aria-label="3 jugadores"]')
        ?.getAttribute("aria-pressed"),
      "true",
    );
    assert(container.textContent?.includes("No hay límite de tiempo"));
    assert.equal(calls.length, 0);
    await click(findButton("Confirmar jugadores y mostrar QR"));
    assert.equal(calls.length, 1);
    const submitted = calls[0] as {
      event: string;
      payload: { command: string; capacity: number; eventId: string };
    };
    assert.equal(submitted.event, "admin");
    assert.equal(submitted.payload.command, "capacity");
    assert.equal(submitted.payload.capacity, 3);
    assert(submitted.payload.eventId);
    assert(container.querySelector('[aria-label="3 jugadores"]')); // un error no cierra la selección
    let saved = game.snapshot!;
    const success = {
      ...game,
      request: async (_event: string, payload: unknown) => {
        const result = engine.handleAdmin(
          game.session!,
          payload as { eventId: string; command: string; capacity: number },
        );
        assert(result.ok && result.snapshot);
        saved = result.snapshot;
        return result;
      },
    } as GameConnection;
    await act(async () => root.render(createElement(Admin, { game: success })));
    await click(findButton("Confirmar jugadores y mostrar QR"));
    await act(async () =>
      root.render(
        createElement(Admin, {
          game: {
            ...success,
            snapshot: saved,
          },
        }),
      ),
    );
    assert(container.querySelector('[aria-label="3 jugadores"]'));
    assert.equal(saved.public.code, game.session!.code);
    assert.equal(saved.public.capacity, 3);
    assert.equal(container.querySelector("#admin-console"), consoleElement);
    assert(container.textContent?.includes("Panel de administrador"));
  } finally {
    await act(async () => root.unmount());
  }
});

test("cantidad queda bloqueada en pausas y entre juegos, se libera al final y preparar siguiente grupo exige confirmar", async () => {
  const { game, calls, engine } = fixture();
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Admin, { game })));
    for (const phase of [
      "mail",
      "ddos",
      "identity",
      "recovery",
      "voting",
    ] as const) {
      await act(async () =>
        root.render(
          createElement(Admin, {
            game: {
              ...game,
              snapshot: {
                ...game.snapshot!,
                public: {
                  ...game.snapshot!.public,
                  phase,
                  assigned: true,
                  paused: true,
                  stage: "finished",
                },
              },
            },
          }),
        ),
      );
      for (const button of container.querySelectorAll<HTMLButtonElement>(
        ".simple-capacity button",
      ))
        assert(button.disabled);
      assert(
        !container.textContent?.includes(
          "Nueva experiencia · elegir jugadores",
        ),
      );
    }
    const finished = {
      ...game,
      snapshot: {
        ...game.snapshot!,
        public: {
          ...game.snapshot!.public,
          phase: "revealed" as const,
          assigned: true,
          stage: "finished" as const,
        },
      },
    };
    await act(async () =>
      root.render(createElement(Admin, { game: finished })),
    );
    assert(
      !container.querySelector<HTMLButtonElement>('[aria-label="4 jugadores"]')!
        .disabled,
    );
    await click(
      container.querySelector<HTMLButtonElement>('[aria-label="4 jugadores"]')!,
    );
    await click(findButton("Preparar siguiente grupo"));
    assert(container.querySelector('[role="alertdialog"]'));
    assert.equal(calls.length, 0);
    await click(findButton("Cancelar"));
    assert(!container.querySelector('[role="alertdialog"]'));
    assert.equal(calls.length, 0);
    assert.equal(
      container
        .querySelector('[aria-label="4 jugadores"]')
        ?.getAttribute("aria-pressed"),
      "true",
    );
    assert(container.textContent?.includes("Panel de administrador"));
    const consoleElement = container.querySelector("#admin-console");
    engine.rooms.get(game.session!.code)!.phase = "revealed";
    let saved = game.snapshot;
    const success: GameConnection = {
      ...finished,
      request: async (event, payload) => {
        calls.push({ event, payload });
        const result = engine.handleAdmin(
          game.session!,
          payload as { eventId: string; command: string; capacity: number },
        );
        assert(result.ok && result.snapshot);
        saved = result.snapshot;
        return result;
      },
    };
    await act(async () => root.render(createElement(Admin, { game: success })));
    await click(findButton("Preparar siguiente grupo"));
    await click(findButton("Confirmar siguiente grupo"));
    await act(async () =>
      root.render(
        createElement(Admin, { game: { ...success, snapshot: saved } }),
      ),
    );
    assert.equal(calls.length, 1);
    assert.equal(saved!.public.capacity, 4);
    assert.equal(saved!.public.code, game.session!.code);
    assert.equal(saved!.public.phase, "lobby");
    assert.equal(saved!.public.playersCount, 0);
    assert.equal(container.querySelector("#admin-console"), consoleElement);
    assert.equal(location.pathname, "/docente");
    assert(!container.querySelector('[role="alertdialog"]'));
  } finally {
    await act(async () => root.unmount());
  }
});

test("QR administrativo identifica su sala y no conserva una imagen anterior si la nueva falla", async () => {
  const { game } = fixture();
  const root = createRoot(container);
  const original = QRCode.toDataURL;
  QRCode.toDataURL = (async () =>
    "data:image/png;base64,anterior") as typeof QRCode.toDataURL;
  try {
    const first = {
      ...game,
      snapshot: {
        ...game.snapshot!,
        public: { ...game.snapshot!.public, autoStart: true },
      },
    };
    await act(async () => root.render(createElement(Admin, { game: first })));
    assert.equal(
      container.querySelector(".simple-qr img")?.getAttribute("src"),
      "data:image/png;base64,anterior",
    );
    QRCode.toDataURL = (async () => {
      throw new Error("QR simulado");
    }) as typeof QRCode.toDataURL;
    const second = {
      ...first,
      snapshot: {
        ...first.snapshot!,
        public: { ...first.snapshot!.public, code: "4321" },
      },
    };
    await act(async () => root.render(createElement(Admin, { game: second })));
    assert(!container.querySelector(".simple-qr img"));
    assert(container.textContent?.includes("4321"));
    await act(async () => root.render(createElement(Admin, { game })));
    assert(!container.querySelector(".simple-qr img"));
  } finally {
    await act(async () => root.unmount());
    QRCode.toDataURL = original;
  }
});

test("el mismo panel permanece durante elección, finalización y reinicio sin salir del administrador", async () => {
  const { game, engine } = fixture();
  const root = createRoot(container);
  const session = game.session!;
  const commands: string[] = [];
  for (const invite of game.snapshot!.admin!.invites.slice(0, 3)) {
    const joined = engine.join({
      code: session.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `Participante ${invite.slot}`,
    });
    assert(joined.ok);
  }
  game.snapshot = engine.snapshot(session);
  game.admin = async (command) => {
    commands.push(command);
    const result = engine.admin(session, `ui-${commands.length}`, command);
    if (result.snapshot) game.snapshot = result.snapshot;
    return result;
  };
  try {
    await act(async () => root.render(createElement(Admin, { game })));
    const consoleElement = container.querySelector("#admin-console");
    assert(consoleElement);
    assert.equal(
      container.querySelector("h1")?.textContent,
      "Panel de administrador",
    );
    await click(
      container.querySelector<HTMLButtonElement>('[aria-label="4 jugadores"]')!,
    );
    assert.equal(container.querySelector("#admin-console"), consoleElement);
    assert(container.querySelector('[aria-label="3 jugadores"]'));
    for (const phase of [
      "mail",
      "ddos",
      "identity",
      "recovery",
      "revealed",
    ] as const) {
      game.snapshot = {
        ...game.snapshot!,
        public: {
          ...game.snapshot!.public,
          phase,
          assigned: true,
          stage: phase === "revealed" ? "finished" : "briefing",
        },
      };
      await act(async () => root.render(createElement(Admin, { game })));
      assert.equal(container.querySelector("#admin-console"), consoleElement);
      assert.equal(
        container.querySelector("h1")?.textContent,
        "Panel de administrador",
      );
    }
    assert(container.textContent?.includes("La experiencia terminó"));
    assert.deepEqual(commands, []);
    await click(findButton("Reiniciar toda la actividad"));
    assert(container.querySelector('[role="alertdialog"]'));
    assert.deepEqual(commands, []);
    await click(findButton("Cancelar"));
    assert(!container.querySelector('[role="alertdialog"]'));
    assert.equal(container.querySelector("#admin-console"), consoleElement);
    await click(findButton("Reiniciar toda la actividad"));
    await click(findButton("Reiniciar y sacar a todos"));
    await act(async () => root.render(createElement(Admin, { game })));
    assert.deepEqual(commands, ["reset-all"]);
    assert.equal(game.session, session);
    assert.equal(game.snapshot?.public.code, session.code);
    assert.equal(game.snapshot?.public.playersCount, 0);
    assert.equal(game.snapshot?.public.phase, "lobby");
    assert.equal(container.querySelector("#admin-console"), consoleElement);
    assert.equal(location.pathname, "/docente");
    assert(!container.querySelector('[role="alertdialog"]'));
  } finally {
    await act(async () => root.unmount());
  }
});

test("la salida personal usa leave y Reconectarme mantiene el acceso sin llamar forget", async () => {
  const { default: Player } = await import("../client/pages/Player");
  const { game, engine } = fixture();
  const invite = game.snapshot!.admin!.invites[0];
  const joined = engine.join({
    code: game.session!.code,
    slot: invite.slot,
    invite: invite.invite,
    name: "Regreso",
  });
  assert(joined.session && joined.snapshot?.player);
  game.snapshot = joined.snapshot!;
  game.session = joined.session;
  let leaveCount = 0,
    reconnectCount = 0,
    forgetCount = 0;
  game.leave = () => {
    leaveCount++;
    game.left = true;
    game.connected = false;
  };
  game.reconnect = () => {
    reconnectCount++;
    game.left = false;
    game.connected = true;
  };
  game.forget = () => {
    forgetCount++;
  };
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Player, { game })));
    await click(findButton("Salir de mi terminal"));
    await act(async () => root.render(createElement(Player, { game })));
    assert.equal(leaveCount, 1);
    assert.equal(forgetCount, 0);
    assert.equal(game.session, joined.session);
    assert(container.textContent?.includes("Saliste de tu terminal"));
    await click(findButton("Reconectarme"));
    await act(async () => root.render(createElement(Player, { game })));
    assert.equal(reconnectCount, 1);
    assert.equal(forgetCount, 0);
    assert.equal(game.session, joined.session);
    assert(!container.textContent?.includes("Saliste de tu terminal"));
  } finally {
    await act(async () => root.unmount());
  }
});
