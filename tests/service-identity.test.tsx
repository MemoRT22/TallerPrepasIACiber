import test from "node:test";
import assert from "node:assert/strict";
import { createElement, act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { DEPARTMENTS, type DepartmentState } from "../shared/types";
import { serviceState, serviceContribution } from "../client/serviceIdentity";
import {
  ServiceResponsibility,
  ServiceStateBadge,
  ServiceStateNotice,
} from "../client/components/ServiceIdentity";
import Player from "../client/pages/Player";
import Dashboard from "../client/pages/Dashboard";
import { SERVICE_SITES } from "../client/three/sites";
import { serviceFixture } from "./helpers/serviceFixture";
import type { GameConnection } from "../client/useGame";

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: true }) },
});
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: { origin: "http://localhost", search: "", hash: "" },
});
const service = (
  id: string,
  status: DepartmentState["status"] = "operational",
): DepartmentState => ({
  id,
  name: DEPARTMENTS.find((d) => d.id === id)!.name,
  status,
  connected: true,
  occupied: true,
});

test("E2: seis perfiles en el catálogo existente y la maqueta comparte la infraestructura", () => {
  assert.equal(DEPARTMENTS.length, 6);
  assert.deepEqual(
    SERVICE_SITES.map((s) => s.id),
    DEPARTMENTS.map((s) => s.id),
  );
  for (const profile of DEPARTMENTS) {
    assert.equal(
      SERVICE_SITES.find((s) => s.id === profile.id)!.description,
      profile.infrastructure,
    );
    assert(profile.potentialImpact.includes("podría"));
    for (const phase of ["mail", "ddos", "identity", "recovery"] as const) {
      const html = renderToStaticMarkup(
        createElement(ServiceResponsibility, {
          department: profile.id,
          phase,
          urgent: false,
        }),
      );
      for (const text of [
        profile.short,
        profile.responsibility,
        profile.infrastructure,
        profile.potentialImpact,
        serviceContribution(phase),
      ])
        assert(html.includes(text));
      assert(html.includes('open=""'));
    }
    const compact = renderToStaticMarkup(
      createElement(ServiceResponsibility, {
        department: profile.id,
        phase: "identity",
        urgent: true,
      }),
    );
    assert(!compact.includes('open=""'));
  }
});

test("E2: estados reales y desconexión se distinguen de marcador, memoria y causas privadas", () => {
  for (const [status, label] of [
    ["operational", "Operativo"],
    ["warning", "Bajo presión"],
    ["down", "Interrumpido"],
  ] as const) {
    const record = service("energia", status);
    const value = serviceState(record);
    assert.equal(value.label, label);
    assert.equal(value.status, status);
    const html = renderToStaticMarkup(
      createElement(ServiceStateBadge, { service: record, connected: true }),
    );
    assert(html.includes(label));
    const notice = renderToStaticMarkup(
      createElement(ServiceStateNotice, { service: record, connected: true }),
    );
    assert.equal(notice.length > 0, status !== "operational");
    if (status !== "operational") assert(notice.includes(value.message));
  }
  assert.equal(serviceState(undefined).status, "unknown");
  assert.equal(serviceState(service("agua", "down"), false).status, "unknown");
  assert(
    serviceState({
      ...service("agua", "warning"),
      connected: false,
    }).message.includes("no se atribuye"),
  );
  assert.equal(
    renderToStaticMarkup(
      createElement(ServiceStateNotice, {
        service: service("agua", "down"),
        connected: false,
      }),
    ),
    "",
  );
});

test("E2: identidad cerrada equivalente entre roles para seis servicios y tres estados", () => {
  const f = serviceFixture(6);
  f.start("mail");
  const snapshot = f.snapshot(f.players[0]);
  for (const dep of DEPARTMENTS)
    for (const status of ["operational", "warning", "down"] as const) {
      const fragments = [];
      for (const role of ["defender", "impostor"] as const) {
        const state = {
          ...snapshot.public,
          departments: [service(dep.id, status)],
        };
        const own = {
          ...snapshot.player!,
          department: dep.id,
          role,
          coverRole: `Responsable de ${dep.name}`,
        };
        const game = {
          snapshot: { public: state, player: own },
          connected: true,
          error: "",
        } as GameConnection;
        const html = renderToStaticMarkup(
          createElement(Player, { code: f.admin.code, game }),
        );
        const dom = new JSDOM(html);
        fragments.push(
          [".simple-terminal-header", ".cover-role", ".service-state-notice"]
            .map(
              (selector) =>
                dom.window.document.querySelector(selector)?.outerHTML ?? "",
            )
            .join(""),
        );
        assert(!html.includes("CENTRO DE CONTROL"));
        dom.window.close();
      }
      assert.equal(fragments[0], fragments[1]);
    }
});

test("E2: 3–6 participantes, pausa y reconexión; el estado privado no adelanta el pulso público", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = serviceFixture(capacity);
    f.start("identity");
    const s = f.defenders[0],
      p = f.internal(s);
    const current = () =>
      f.snapshot().public.departments.find((d) => d.id === p.department)!;
    p.card!.legit = false;
    assert(
      f.action(s, { type: "identity:decide", cardId: p.card!.id, accept: true })
        .ok,
    );
    assert.equal(p.infiltrations, 1);
    assert.equal(serviceState(current()).status, "operational");
    assert(f.command("pause").ok);
    f.advance(10_000);
    assert.equal(serviceState(current()).status, "operational");
    assert(f.command("resume").ok);
    f.advance(10_000);
    assert.equal(serviceState(current()).status, "warning");
    f.engine.unbind(`p${s.slot}`);
    assert.equal(serviceState(current(), false).status, "unknown");
    assert(f.engine.resume(s).ok);
    f.engine.bind(s, "reconnected");
    assert.equal(serviceState(current()).status, current().status);
    const publicState = f.engine.getPublicSnapshot(f.admin.code)!;
    const html = renderToStaticMarkup(
      createElement(Dashboard, { state: publicState }),
    );
    for (const secret of [
      "identityChallenge",
      "advancedAvailable",
      s.token,
      "Eres el impostor",
      "Objetivo privado",
    ])
      assert(!html.includes(secret));
  }
});

test("E2: restauración parcial/completa, pérdida de puntos y nueva partida no inventan interrupciones", () => {
  for (const complete of [false, true]) {
    const f = serviceFixture();
    f.start("recovery");
    for (const s of complete ? f.defenders : [f.defenders[0]])
      assert(
        f.action(s, {
          type: "recovery:solve",
          answer: f.internal(s).fragment!.answer,
        }).ok,
      );
    if (!complete) assert(f.command("stop").ok);
    const state = f.snapshot().public;
    assert.equal(state.recovery.done, complete);
    for (const record of state.departments)
      assert.equal(serviceState(record).status, record.status);
    const altered = {
      ...state,
      scores: { defenders: 0, impostor: 100 },
      city: state.city
        ? { ...state.city, stability: 0, status: "critical" as const }
        : undefined,
    };
    const html = renderToStaticMarkup(
      createElement(Dashboard, { state: altered }),
    );
    for (const record of altered.departments) {
      const p = f.snapshot(
        f.players.find((s) => f.internal(s).department === record.id)!,
      );
      const game = {
        snapshot: { ...p, public: altered },
        connected: true,
        error: "",
      } as GameConnection;
      const own = new JSDOM(
        renderToStaticMarkup(
          createElement(Player, { code: f.admin.code, game }),
        ),
      );
      assert(
        own.window.document
          .querySelector(".service-state-badge")!
          .classList.contains(record.status),
      );
      own.window.close();
    }
    assert(
      html.includes(
        complete ? "Protocolo de restauración completo" : "interrumpida",
      ),
    );
    const prior = [...f.players];
    assert(f.command("reset-all").ok);
    for (const s of prior) assert.equal(f.engine.snapshot(s), null);
    f.join();
    f.start("mail");
    for (const record of f.snapshot().public.departments)
      assert.equal(serviceState(record).status, record.status);
    assert.equal(f.snapshot().public.results.length, 0);
  }
});

test("E2: revelar rol muestra el mismo perfil neutro; durante juego queda plegado", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/jugar",
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
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    const f = serviceFixture();
    f.start("mail");
    const snap = f.snapshot(f.players[0]);
    const profiles = [];
    for (const role of ["defender", "impostor"] as const) {
      const game = {
        snapshot: { ...snap, player: { ...snap.player!, role } },
        connected: true,
        error: "",
      } as GameConnection;
      await act(async () =>
        root.render(
          createElement(Player, { key: role, code: f.admin.code, game }),
        ),
      );
      const button = [...dom.window.document.querySelectorAll("button")].find(
        (b) => b.textContent?.includes("Mi rol secreto"),
      )!;
      await act(async () => button.click());
      const profile = dom.window.document.querySelector<HTMLDetailsElement>(
        ".service-responsibility",
      )!;
      assert(profile);
      assert.equal(profile.open, false);
      profiles.push(profile.innerHTML);
    }
    assert.equal(profiles[0], profiles[1]);
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of old) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});

test("E2: recuperación agotada e incompleta no convierte un punto perdido en interrupción de cada servicio", () => {
  const f = serviceFixture();
  f.start("recovery");
  const own = f.defenders[0];
  assert(
    f.action(own, {
      type: "recovery:solve",
      answer: f.internal(own).fragment!.answer,
    }).ok,
  );
  f.advance(120_000);
  const state = f.snapshot().public;
  assert.equal(state.recovery.done, false);
  assert.equal(
    state.results.find((r) => r.phase === "recovery")!.winner,
    "impostor",
  );
  assert(
    renderToStaticMarkup(createElement(Dashboard, { state })).includes(
      "Restauración incompleta",
    ),
  );
  for (const record of state.departments) {
    assert.equal(serviceState(record).status, record.status);
    if (record.status === "operational")
      assert.equal(serviceState(record).label, "Operativo");
  }
});
