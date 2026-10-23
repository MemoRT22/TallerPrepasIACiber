import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import MailGame from "../client/games/MailGame";
import DdosGame from "../client/games/DdosGame";
import Player from "../client/pages/Player";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import { getCityImpacts } from "../client/three/impactLabels";
import type { GameConnection } from "../client/useGame";
import type { PlayerState, GameAction } from "../shared/types";
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: "http://localhost/jugar",
});
Object.defineProperty(dom.window, "matchMedia", {
  value: () => ({ matches: true }),
});
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  IS_REACT_ACT_ENVIRONMENT: true,
}))
  Object.defineProperty(globalThis, key, { configurable: true, value });
const player: PlayerState = {
  id: "player-private",
  slot: 1,
  name: "Alex",
  department: "agua",
  node: "777",
  role: "impostor",
  blocked: false,
  mail: [],
  templates: [
    {
      id: "legit-service",
      senderName: "Mesa de Servicios",
      sender: "mesa@servicios-cancun.example",
      subject: "Actualización del servicio",
      preview: "Ventana programada.",
      kind: "official",
      tactic: "official",
    },
    {
      id: "fake-support",
      senderName: "Soporte de Sesiones",
      sender: "soporte@cancun.example",
      subject: "Verifica tu contraseña de inmediato",
      preview: "Tu sesión expira.",
      kind: "attack",
      tactic: "urgency",
    },
  ],
  mailCooldown: 0,
  mailInspectionsRemaining: 2,
  traffic: [],
  saturation: 0,
  card: null,
  pendingCards: 0,
  identityCooldown: 0,
};
const state = {
  ...DEMO_STATE,
  code: "8378",
  assigned: true,
  phase: "mail" as const,
  stage: "playing" as const,
  running: true,
  remaining: 150,
};
const actions: Omit<GameAction, "eventId">[] = [];
const game = {
  connected: true,
  busy: false,
  error: "",
  left: false,
  setError: () => {},
  act: async (action: Omit<GameAction, "eventId">) => {
    actions.push(action);
    return { ok: true };
  },
  leave: () => {},
  reconnect: () => {},
} as unknown as GameConnection;
const host = dom.window.document.getElementById("root")!;
async function click(button: HTMLButtonElement) {
  await act(async () =>
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
  );
}

test("hacker escoge correctos o maliciosos y ocultar rol limpia su selección privada", async () => {
  const root = createRoot(host);
  actions.length = 0;
  let beforePassiveHide = 0;
  function MailProbe(props: Parameters<typeof MailGame>[0]) {
    useLayoutEffect(() => {
      if (props.roleVisible === false) {
        beforePassiveHide++;
        assert(!host.querySelector(".template-preview"));
        assert(!host.textContent?.includes("Tu sesión expira"));
      }
    }, [props.roleVisible]);
    return createElement(MailGame, props);
  }
  try {
    await act(async () =>
      root.render(
        createElement(MailProbe, { player, state, game, roleVisible: true }),
      ),
    );
    const mode = host.querySelector('[aria-label="Estrategia privada"]');
    assert(mode);
    const buttons = [...mode.querySelectorAll("button")];
    assert(buttons.some((b) => b.textContent?.includes("Cobertura")));
    assert(buttons.some((b) => b.textContent?.includes("Urgencia")));
    assert(buttons.some((b) => b.textContent?.includes("Autoridad")));
    assert(buttons.some((b) => b.textContent?.includes("Suplantación")));
    await click(buttons.find((b) => b.textContent?.includes("Urgencia"))!);
    assert(host.querySelector('option[value="fake-support"]'));
    assert(!host.querySelector('option[value="legit-service"]'));
    const [target, template] = [...host.querySelectorAll("select")];
    await act(async () => {
      target.value = "energia";
      target.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      template.value = "fake-support";
      template.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    const send = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Enviar comunicación"),
    );
    assert(send && !send.disabled);
    await click(send);
    assert.deepEqual(actions, [
      { type: "mail:send", templateId: "fake-support", target: "energia" },
    ]);
    await act(async () =>
      root.render(
        createElement(MailProbe, { player, state, game, roleVisible: false }),
      ),
    );
    assert.equal(beforePassiveHide, 1);
    assert(!host.querySelector('[aria-label="Estrategia privada"]'));
    assert(!host.querySelector('option[value="fake-support"]'));
    assert(!host.querySelector(".template-preview"));
    assert(host.querySelector('option[value="legit-service"]'));
    await act(async () =>
      root.render(
        createElement(MailProbe, {
          player: { ...player, role: "defender" },
          state,
          game,
          roleVisible: true,
        }),
      ),
    );
    assert(!host.querySelector('[aria-label="Estrategia privada"]'));
    assert(!host.querySelector('option[value="fake-support"]'));
  } finally {
    await act(async () => root.unmount());
  }
});

test("refuerzo final y contador de inactividad son privados sin señal de clasificación correcta", () => {
  const ddos = { ...state, phase: "ddos" as const, remaining: 10 };
  const hidden = renderToStaticMarkup(
    createElement(DdosGame, { player, state: ddos, game, roleVisible: false }),
  );
  assert(!hidden.includes("REFUERZO FINAL"));
  assert(!hidden.includes("inyectas"));
  const shown = renderToStaticMarkup(
    createElement(DdosGame, { player, state: ddos, game, roleVisible: true }),
  );
  assert(shown.includes("REFUERZO FINAL ×3"));
  assert(shown.includes("3 en total"));
  const before = renderToStaticMarkup(
    createElement(DdosGame, {
      player,
      state: { ...ddos, remaining: 11 },
      game,
      roleVisible: true,
    }),
  );
  assert(!before.includes("REFUERZO FINAL"));
  const terminal = renderToStaticMarkup(
    createElement(Player, {
      game: {
        ...game,
        snapshot: {
          public: state,
          player: { ...player, inactivityPenalties: 3 },
        },
      },
    }),
  );
  assert(terminal.includes("3 puntos malos"));
  assert(!terminal.includes("Respuesta correcta"));
  assert(!terminal.includes("incorrecta"));
  const waiting = renderToStaticMarkup(
    createElement(Player, {
      game: {
        ...game,
        snapshot: {
          public: state,
          player: {
            ...player,
            inactivityPenalties: 3,
            waitingForNextRound: true,
          },
        },
      },
    }),
  );
  assert(!waiting.includes("3 puntos malos"));
  const publicHtml = renderToStaticMarkup(createElement(Dashboard, { state }));
  assert(!publicHtml.includes("puntos malos"));
  assert(!publicHtml.includes("REFUERZO FINAL"));
  assert(!publicHtml.includes("player-private"));
});

test("leyendas de ciudad dependen solo de problemas públicos y desaparecen al restaurar servicios", () => {
  assert.deepEqual(getCityImpacts(DEMO_STATE.departments), []);
  const departments = DEMO_STATE.departments.map((d) => ({
    ...d,
    status: "down" as const,
  }));
  const impacts = getCityImpacts(departments);
  assert(impacts.some((i) => i.id === "energia" && i.label.includes("Apagón")));
  assert(
    impacts.some(
      (i) => i.id === "movilidad" && i.label.includes("Embotellamiento"),
    ),
  );
  assert(impacts.some((i) => i.id === "agua" && i.label.includes("fila")));
  assert(
    impacts.some((i) => i.id === "municipal" && i.label.includes("calle")),
  );
  assert(
    impacts.some(
      (i) => i.id === "comunicaciones" && i.label.includes("conexión"),
    ),
  );
  assert(
    impacts.some((i) => i.id === "turismo" && i.label.includes("visitantes")),
  );
  const html = renderToStaticMarkup(
    createElement(Dashboard, { state: { ...DEMO_STATE, departments } }),
  );
  assert(html.includes("city-life-status"));
  assert(html.includes("personas en las calles"));
  assert(!html.includes("777"));
  assert(!html.includes("impostorDepartmentId"));
  const normal = renderToStaticMarkup(
    createElement(Dashboard, { state: DEMO_STATE }),
  );
  assert(!normal.includes("city-life-status"));
});
