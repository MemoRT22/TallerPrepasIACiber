import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import Finale from "../client/components/Finale";
import { Voting } from "../client/games/Closing";
import type { PlayerState, PublicState } from "../shared/types";
import type { GameConnection } from "../client/useGame";

const state: PublicState = {
  ...DEMO_STATE,
  phase: "revealed",
  stage: "finished",
  scores: { defenders: 3, impostor: 2 },
  results: ["mail", "ddos", "identity", "recovery", "voting"].map(
    (phase, i) => ({
      phase: phase as PublicState["phase"],
      winner: i < 3 ? "defenders" : "impostor",
      metric: 0,
      description: "Resultado público",
    }),
  ),
  judgment: { stage: "reveal", votesExpected: 6, elapsed: 0, step: "truth" },
  reveal: {
    impostorDepartmentId: "energia",
    impostorDepartment: "Energía",
    impostorName: "Nombre secreto de prueba",
    winner: "defenders",
    votes: [],
    logs: [],
    bonus: {
      winner: "impostor",
      correct: 2,
      eligible: 5,
      required: 3,
      abstentions: 0,
    },
    reflection: {
      success: "Acierto comprobado por el equipo.",
      vulnerability: "Vulnerabilidad observada en la simulación.",
      recommendation: "Verificar por otro canal. No fue un ataque real.",
    },
  },
};

function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "getContext", {
    value: () => null,
  });
  const old = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    old.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  return {
    dom,
    restore: () => {
      for (const [key, descriptor] of old) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      dom.window.close();
    },
  };
}

test("P7: secuencia pública no adelanta identidad ni marcador y termina con cinco rubros y reflexión", () => {
  const env = environment();
  try {
    for (const step of ["truth", "identity", "result", "learning"] as const) {
      const s = { ...state, judgment: { ...state.judgment!, step } };
      const html = renderToStaticMarkup(createElement(Dashboard, { state: s }));
      assert.equal(html.includes("Nombre secreto de prueba"), step !== "truth");
      assert.equal(html.includes("IMPOSTOR REVELADO"), step !== "truth");
      assert.equal(
        html.includes("Marcador final desglosado"),
        step === "result" || step === "learning",
      );
      assert.equal(html.includes("Lo que nos llevamos"), step === "learning");
      if (step === "truth") {
        const redacted = renderToStaticMarkup(
          createElement(Dashboard, { state: { ...s, reveal: undefined } }),
        );
        assert(redacted.includes("El momento de la verdad"));
        assert(!redacted.includes("Nombre secreto de prueba"));
      }
      if (step === "learning") {
        for (const label of [
          "Correos",
          "DDoS",
          "Identidad",
          "Bonus de Recuperación",
          "Bonus de identificación",
          "Acierto comprobado",
          "Vulnerabilidad observada",
          "No fue un ataque real",
        ])
          assert(html.includes(label), label);
      }
    }
    const tie = renderToStaticMarkup(
      createElement(Finale, {
        state: {
          ...state,
          judgment: undefined,
          reveal: { ...state.reveal!, winner: "tie" },
        },
      }),
    );
    assert(tie.includes("EMPATE FINAL"));
    const voting = renderToStaticMarkup(
      createElement(Dashboard, {
        state: {
          ...DEMO_STATE,
          phase: "voting",
          judgment: { stage: "debate", votesExpected: 0, elapsed: 0 },
        },
      }),
    );
    assert(voting.includes("ALERTA FINAL"));
    assert(voting.includes("El docente abrirá"));
    assert(!voting.includes("Nombre secreto"));
  } finally {
    env.restore();
  }
});

test("P7: móvil exige revisar/confirmar voto, luego solo muestra recibo; debate y no elegible no permiten votar", async () => {
  const env = environment(),
    host = env.dom.window.document.getElementById("root")!,
    root = createRoot(host);
  const actions: unknown[] = [];
  const game = {
    connected: true,
    busy: false,
    act: async (a: unknown) => {
      actions.push(a);
      return { ok: true };
    },
  } as GameConnection;
  const player = { voteEligible: true } as PlayerState;
  const voting = {
    ...DEMO_STATE,
    phase: "voting" as const,
    judgment: { stage: "voting" as const, votesExpected: 6, elapsed: 0 },
  };
  const dispatch = async (element: Element, event: Event) => {
    await act(async () => element.dispatchEvent(event));
  };
  try {
    await act(async () =>
      root.render(createElement(Voting, { player, state: voting, game })),
    );
    const select = host.querySelector("select")!;
    select.value = "agua";
    await dispatch(
      select,
      new env.dom.window.Event("change", { bubbles: true }),
    );
    const text = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(
      env.dom.window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(text, "Patrón observado");
    await dispatch(text, new env.dom.window.Event("input", { bubbles: true }));
    await dispatch(text, new env.dom.window.Event("change", { bubbles: true }));
    await dispatch(
      host.querySelector("form")!,
      new env.dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    assert.equal(actions.length, 0);
    assert(host.querySelector('[role="alertdialog"]'));
    // Server remains the authority even for an attempted duplicate or reconnection.
    await act(async () =>
      root.render(
        createElement(Voting, {
          player: {
            ...player,
            vote: { suspect: "agua", reason: "Patrón observado" },
          },
          state: voting,
          game,
        }),
      ),
    );
    assert(host.textContent!.includes("Voto registrado"));
    assert(!host.querySelector("form"));
    await act(async () =>
      root.render(
        createElement(Voting, {
          player: { ...player, voteEligible: false },
          state: voting,
          game,
        }),
      ),
    );
    assert(!host.querySelector("form"));
    assert(host.textContent!.includes("no estaba conectada"));
    await act(async () =>
      root.render(
        createElement(Voting, {
          player,
          state: {
            ...voting,
            judgment: { ...voting.judgment, stage: "debate" },
          },
          game,
        }),
      ),
    );
    assert(!host.querySelector("form"));
    assert(host.textContent!.includes("docente abrirá"));
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});

test("P7: desenlace conserva ciudad P6 y alternativa sin WebGL, sin logs o motivos individuales", async () => {
  const env = environment(),
    host = env.dom.window.document.getElementById("root")!,
    root = createRoot(host);
  const warn = console.warn,
    error = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    await act(async () => {
      root.render(
        createElement(Dashboard, {
          state: {
            ...state,
            judgment: { ...state.judgment!, step: "learning", elapsed: 30 },
          },
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    assert(host.querySelector(".has-fallback"));
    assert(host.textContent!.includes("Nombre secreto de prueba"));
    assert.equal(host.querySelectorAll(".final-scoreboard tbody tr").length, 5);
    assert(host.querySelector('meter[aria-label="Estabilidad de la ciudad"]'));
    assert(!host.textContent!.includes("Registro interno"));
    assert(host.textContent!.includes("Secuencia completa"));
  } finally {
    await act(async () => root.unmount());
    console.warn = warn;
    console.error = error;
    env.restore();
  }
});
