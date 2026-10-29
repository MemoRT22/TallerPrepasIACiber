import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import DdosGame from "../client/games/DdosGame";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import Briefing from "../client/components/Briefing";
import { hitTraffic, pointPosition } from "../client/games/ddosRadar";
import type { GameConnection } from "../client/useGame";
import type { GameAction, PlayerState, PublicState } from "../shared/types";

const player: PlayerState = {
  id: "p1",
  slot: 1,
  name: "Test",
  role: "defender",
  department: "agua",
  node: "101",
  blocked: false,
  mail: [],
  templates: [],
  mailCooldown: 0,
  mailSendCooldown: 30,
  mailInspectionsRemaining: 2,
  traffic: [],
  saturation: 0,
  card: null,
  pendingCards: 0,
  identityCooldown: 0,
  identityVerificationsRemaining: 2,
  ddosDefense: {
    available: true,
    remaining: 0,
    absorbed: 0,
    feedbackRemaining: 0,
    waveRemaining: 0,
  },
};
const state: PublicState = {
  ...DEMO_STATE,
  phase: "ddos",
  stage: "playing",
  running: true,
  duration: 90,
  clock: 0,
  remaining: 90,
};
const actions: Omit<GameAction, "eventId">[] = [];
const game = {
  connected: true,
  busy: false,
  act: async (value: Omit<GameAction, "eventId">) => {
    actions.push(value);
    return { ok: true };
  },
} as unknown as GameConnection;

test("radar comparte geometría visual e interacción, conserva azul y rechaza futuras/expiradas", () => {
  for (const angle of [0, 0.7, Math.PI, 4.8])
    for (const clock of [0, 1_500, 3_999]) {
      const point = {
        id: "p",
        kind: "red" as const,
        angle,
        born: 0,
        arrives: 4_000,
      };
      const pos = pointPosition(point, clock);
      assert.equal(hitTraffic([point], clock, pos.x, pos.y)?.id, "p");
      assert.equal(hitTraffic([point], clock, pos.x + 25, pos.y), undefined);
      assert.equal(hitTraffic([point], 4_000, pos.x, pos.y), undefined);
      assert.equal(hitTraffic([point], -1, pos.x, pos.y), undefined);
      assert.equal(
        hitTraffic([{ ...point, kind: "blue" }], clock, pos.x, pos.y)?.kind,
        "blue",
      );
    }
});

test("P5 UI: escudo, absorción, oleada y briefing son claros sin filtrar el reto al proyector", () => {
  const render = (p = player, s = state, roleVisible = false) =>
    renderToStaticMarkup(
      createElement(DdosGame, { player: p, state: s, game, roleVisible }),
    );
  assert(render().includes("ACTIVAR ESCUDO"));
  const active = render({
    ...player,
    ddosDefense: {
      available: false,
      remaining: 2.4,
      absorbed: 2,
      feedbackRemaining: 0.7,
      waveRemaining: 1,
    },
  });
  assert(active.includes("ESCUDO · 2.4 s"));
  assert(active.includes("Impacto absorbido"));
  const impostor: PlayerState = {
    ...player,
    role: "impostor",
    ddosDefense: undefined,
    ddosChallenge: {
      patterns: [
        { id: "a", label: "Origen A", requests: [30, 34, 32], clients: 1 },
      ],
      solved: false,
      waveAvailable: false,
      waveUsed: false,
      retryIn: 0,
      targets: [],
    },
  };
  assert(!render(impostor).includes("Origen A"));
  assert(render(impostor, state, true).includes("Origen A"));
  assert(!render(impostor, state, true).includes("REFUERZO FINAL"));
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: {
      origin: "http://localhost",
      pathname: "/pantalla",
      search: "",
      hash: "",
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { matchMedia: () => ({ matches: true }) },
  });
  const publicHtml = renderToStaticMarkup(
    createElement(Dashboard, {
      state: { ...state, ddos: { waveAlert: true } },
    }),
  );
  assert(publicHtml.includes("ATAQUE DE TRÁFICO ANÓMALO DETECTADO"));
  for (const secret of ["Origen A", "ANÁLISIS PRIVADO", "ACTIVAR ESCUDO"])
    assert(!publicHtml.includes(secret));
  const briefing = renderToStaticMarkup(
    createElement(Briefing, {
      state: { ...state, stage: "briefing" },
      player,
      roleVisible: false,
    }),
  );
  assert(briefing.includes("escudo de 4 segundos"));
  assert(!briefing.includes("reto privado"));
});

test("P5 Canvas: toque escalado, pausa, pestaña oculta, movimiento reducido y limpieza de RAF", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/jugar",
  });
  let hidden = false,
    nextFrame = 0,
    draws = 0;
  const frames = new Map<number, FrameRequestCallback>();
  Object.defineProperty(dom.window.document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  const ctx = {
    setTransform: () => {},
    clearRect: () => {
      draws++;
    },
    fillRect: () => {},
    beginPath: () => {},
    arc: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fill: () => {},
    fillText: () => {},
  };
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "getContext", {
    value: () => ctx,
  });
  const media = {
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(dom.window, "matchMedia", { value: () => media });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      const id = ++nextFrame;
      frames.set(id, cb);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id);
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  const frame = (time: number) => {
    const first = frames.entries().next().value;
    assert(first);
    frames.delete(first[0]);
    first[1](time);
  };
  try {
    const point = {
      id: "touch-target",
      kind: "red" as const,
      angle: 0,
      born: 0,
      arrives: 4_000,
    };
    const props = { player: { ...player, traffic: [point] }, state, game };
    await act(async () => {
      root.render(createElement(DdosGame, props));
    });
    frame(0);
    assert.equal(draws, 1);
    frame(16);
    assert.equal(draws, 1);
    frame(34);
    assert.equal(draws, 2);
    const canvas = dom.window.document.querySelector("canvas")!;
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({ left: 10, top: 20, width: 220, height: 220 }),
    });
    actions.length = 0;
    await act(async () => {
      canvas.dispatchEvent(
        new dom.window.MouseEvent("pointerdown", {
          bubbles: true,
          clientX: 10 + 407 / 2,
          clientY: 20 + 220 / 2,
        }),
      );
    });
    assert.equal(actions[0]?.type, "ddos:tap");
    assert.equal(actions[0]?.pointId, point.id);
    assert.equal(dom.window.document.querySelector(".ddos-tap-feedback")?.textContent?.trim(), "Intercepción confirmada");
    assert(dom.window.document.querySelector(".ddos-tap-pulse.good"));
    const button = dom.window.document.querySelector(
      ".ddos-defense button",
    ) as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    assert.equal(actions[1]?.type, "ddos:shield");
    hidden = true;
    dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
    assert.equal(frames.size, 0);
    hidden = false;
    dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
    assert.equal(frames.size, 1);
    await act(async () => {
      root.render(
        createElement(DdosGame, {
          ...props,
          state: { ...state, paused: true },
        }),
      );
    });
    frame(100);
    assert.equal(frames.size, 0);
    await act(async () => {
      root.render(createElement(DdosGame, props));
    });
    frame(150);
    assert.equal(frames.size, 1);
    await act(async () => {
      root.unmount();
    });
    assert.equal(frames.size, 0);
    dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
    assert.equal(frames.size, 0);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
