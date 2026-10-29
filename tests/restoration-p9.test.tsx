import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameEngine } from "../server/engine";
import type { GameAction, PublicState, Session } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import {
  RestorationProgress,
  RestorationMoment,
  RestorationOutcome,
  restorationOutcome,
} from "../client/components/Restoration";
import Finale from "../client/components/Finale";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import { buildCity } from "../client/three/cityScene";
import { cityNarrative } from "../shared/cityNarrative";

function decode(cipher: string, shift: number) {
  return cipher.replace(/[A-Z]/g, (c) =>
    String.fromCharCode(65 + ((c.charCodeAt(0) - 65 - shift + 26) % 26)),
  );
}
function fixture(capacity: 3 | 4 | 5 | 6 = 3) {
  let now = 0,
    event = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0.3 });
  const created = engine.create(capacity);
  const admin = created.session!;
  const players = created.snapshot!.admin!.invites.map((invite, i) => {
    const joined = engine.join({
      code: admin.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `QA${i}`,
    });
    engine.bind(joined.session!, `p${i}`);
    return joined.session!;
  });
  const command = (value: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `c${event++}`, value);
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  const action = (s: Session, value: Omit<GameAction, "eventId">) =>
    engine.action(s, { eventId: `a${event++}`, ...value });
  const state = () => engine.snapshot(admin)!.public;
  assert(command("assign").ok);
  const defenders = players.filter(
    (s) => engine.snapshot(s)!.player!.role === "defender",
  );
  const impostor = players.find((s) => !defenders.includes(s))!;
  for (const phase of ["mail", "ddos", "identity"]) {
    assert(command("start").ok);
    advance(5000);
    assert.equal(state().phase, phase);
    assert(command("stop").ok);
    assert(command("next").ok);
  }
  assert(command("start").ok);
  advance(5000);
  const solve = (s: Session, eventId?: string) => {
    const f = engine.snapshot(s)!.player!.fragment!;
    return engine.action(s, {
      eventId: eventId ?? `solve${event++}`,
      type: "recovery:solve",
      answer: decode(f.cipher, f.verifiedShift ?? f.shift ?? 3),
    });
  };
  return {
    engine,
    admin,
    players,
    defenders,
    impostor,
    command,
    advance,
    action,
    state,
    solve,
  };
}

for (const capacity of [3, 4, 5, 6] as const) {
  test(`P9: ${capacity} jugadores restauran ${capacity - 1} partes, deduplicación y cierre privado intactos`, () => {
    const f = fixture(capacity);
    assert.deepEqual(f.state().settings, DEFAULT_SETTINGS);
    for (const [index, s] of f.defenders.entries()) {
      assert(f.solve(s, `unique-${index}`).ok);
      assert(f.solve(s, `unique-${index}`).ok);
      const publicState = f.state();
      assert.equal(publicState.recovery.completed, index + 1);
      const html = renderToStaticMarkup(
        createElement(RestorationProgress, { state: publicState }),
      );
      const doc = new JSDOM(html).window.document;
      assert.equal(
        doc.querySelectorAll(".protocol-modules li").length,
        capacity - 1,
      );
      assert.equal(doc.querySelectorAll(".validated").length, index + 1);
      assert(
        html.includes(`${Math.round(((index + 1) / (capacity - 1)) * 100)}%`),
      );
      assert(!html.includes(f.engine.snapshot(s)!.player!.fragment!.cipher));
      doc.defaultView!.close();
    }
    assert.equal(restorationOutcome(f.state()), "complete");
    assert.equal(f.state().scores.defenders, 1);
    assert.equal(f.state().city!.stability, 100);
    const unchanged = JSON.stringify(f.state());
    const html = renderToStaticMarkup(
      createElement(RestorationMoment, { state: f.state() }),
    );
    assert(html.includes("PROTOCOLO RECONSTRUIDO"));
    assert(html.includes("responsable del ataque sigue entre nosotros"));
    assert.equal(
      JSON.stringify(f.state()),
      unchanged,
      "presentation cannot alter points/state",
    );
    assert(f.command("judgment").ok);
    assert(f.command("voting").ok);
    const suspect = f.engine.snapshot(f.impostor)!.player!.department;
    for (const s of f.players)
      assert(
        f.action(s, { type: "vote", suspect, reason: "Señal de prueba" }).ok,
      );
    assert(f.command("reveal").ok);
    f.advance(2999);
    assert.equal(f.state().reveal, undefined);
    assert(!JSON.stringify(f.state()).includes("impostorDepartmentId"));
    f.advance(1);
    assert(f.state().reveal);
    assert.deepEqual(f.state().reveal!.logs, []);
    assert.deepEqual(f.state().reveal!.votes, []);
    f.advance(27000);
    assert.equal(f.state().judgment!.elapsed, 30);
    assert(f.command("reset-all").ok);
    assert.equal(restorationOutcome(f.state()), "pending");
    assert.equal(f.state().recovery.completed, 0);
    assert.equal(f.state().reveal, undefined);
    assert.equal(f.state().city!.chapters.length, 0);
  });
}

for (const mode of ["timeout", "interrupted"] as const) {
  test(`P9: cierre ${mode} no anuncia restauración completa ni falsa victoria`, () => {
    const f = fixture();
    assert(f.solve(f.defenders[0]).ok);
    if (mode === "timeout") f.advance(120000);
    else assert(f.command("stop").ok);
    assert.equal(
      restorationOutcome(f.state()),
      mode === "timeout" ? "incomplete" : "interrupted",
    );
    assert.equal(f.state().scores.impostor, mode === "timeout" ? 1 : 0);
    const html = renderToStaticMarkup(
      createElement(RestorationMoment, { state: f.state() }),
    );
    assert(!html.includes("PROTOCOLO RECONSTRUIDO"));
    assert(!html.includes("CANCÚN HA SIDO RESTAURADO"));
    assert(
      html.includes(
        mode === "timeout"
          ? "Restauración incompleta"
          : "Restauración interrumpida",
      ),
    );
    assert(
      f.state().city!.message.includes("respuesta de emergencia finalizada"),
    );
    assert(f.command("restart").ok);
    assert.equal(restorationOutcome(f.state()), "pending");
    assert.equal(f.state().recovery.completed, 0);
  });
}

test("P9: sabotaje +3→+5, pausa, verificación y recuperación real sin filtrar objetivo", () => {
  const f = fixture(6);
  const c = f.engine.snapshot(f.impostor)!.player!.recoveryChallenge!;
  assert(
    f.action(f.impostor, {
      type: "recovery:challenge-solve",
      answer: decode(c.cipher, c.shift),
    }).ok,
  );
  const target = f.defenders[0];
  const before = f.engine.snapshot(target)!.player!.fragment!;
  const answer = decode(before.cipher, before.shift!);
  assert(
    f.action(f.impostor, {
      type: "recovery:sabotage",
      target: f.engine.snapshot(target)!.player!.department,
    }).ok,
  );
  const altered = f.engine.snapshot(target)!.player!.fragment!;
  assert.equal(decode(altered.cipher, 5), answer);
  assert.equal(altered.shift, undefined);
  assert.equal(f.state().recovery.integrityAlert, true);
  assert.deepEqual(Object.keys(f.state().recovery).sort(), [
    "completed",
    "done",
    "integrityAlert",
    "total",
  ]);
  assert(
    !f.action(f.impostor, {
      type: "recovery:sabotage",
      target: f.engine.snapshot(target)!.player!.department,
    }).ok,
  );
  assert(f.action(target, { type: "recovery:verify" }).ok);
  assert(f.command("pause").ok);
  f.advance(10000);
  assert.equal(
    f.engine.snapshot(target)!.player!.fragment!.verificationRemaining,
    3,
  );
  assert(!f.action(target, { type: "recovery:solve", answer }).ok);
  assert(f.command("resume").ok);
  f.advance(3000);
  assert.equal(f.engine.snapshot(target)!.player!.fragment!.verifiedShift, 5);
  assert(f.solve(target).ok);
  const absent = f.defenders[1];
  const slot = f.players.indexOf(absent);
  f.engine.unbind(`p${slot}`);
  const resumed = f.engine.resume(absent);
  assert(resumed.ok && resumed.snapshot!.player!.waitingForNextRound);
  assert.equal(f.state().recovery.completed, 1);
  assert(!f.solve(absent).ok);
  assert(f.command("restart").ok);
  assert.equal(f.state().recovery.completed, 0);
  assert.equal(f.state().recovery.integrityAlert, undefined);
});

test("P9: el mapa existente restaura luces y tránsito por progreso público, no por marcador", () => {
  const departments = DEMO_STATE.departments;
  const chapters = [
    {
      phase: "ddos" as const,
      outcome: "affected" as const,
      services: departments.map((d) => ({ id: d.id, status: "down" as const })),
    },
  ];
  const city = buildCity();
  try {
    for (const completed of [0, 1, 2]) {
      const narrative = cityNarrative({
        departments,
        chapters,
        phase: "recovery",
        stage: "playing",
        recovery: { completed, total: 2 },
      });
      city.updatePublic(departments, narrative);
      assert.equal(narrative.services[0].intensity, (2 - completed) / 2);
      if (completed === 2) {
        assert.equal(city.effects.state.energy.intensityScale, 1);
        assert.equal(city.effects.state.mobility.speedScale, 1);
        assert(narrative.services.every((s) => s.memory === "recovered"));
      }
    }
  } finally {
    city.dispose();
  }
});

test("P9: cinco combinaciones estratégicas se explican sin inferir restauración de estabilidad o puntos", () => {
  for (const complete of [true, false]) {
    for (const winner of ["defenders", "impostor", "tie"] as const) {
      const state: PublicState = {
        ...DEMO_STATE,
        phase: "revealed",
        stage: "finished",
        recovery: { completed: complete ? 5 : 2, total: 5, done: complete },
        results: [
          {
            phase: "recovery",
            winner: complete ? "defenders" : "impostor",
            metric: complete ? 100 : 40,
            description: "Resultado",
          },
        ],
        city: { ...DEMO_STATE.city!, stability: 100 },
        reveal: {
          impostorName: "Identidad de prueba",
          impostorDepartment: "Agua",
          winner,
          votes: [],
          logs: [],
        },
        judgment: {
          stage: "reveal",
          step: "result",
          elapsed: 9,
          votesExpected: 6,
        },
      };
      const html = renderToStaticMarkup(createElement(Finale, { state }));
      assert(
        html.includes(
          complete
            ? "Protocolo completamente restaurado"
            : "Restauración incompleta",
        ),
      );
      assert(
        html.includes(
          winner === "tie"
            ? "EMPATE FINAL"
            : winner === "defenders"
              ? "VICTORIA DE DEFENSORES"
              : "VICTORIA DEL IMPOSTOR",
        ),
      );
      assert(
        html.indexOf("Estado operativo de Cancún") <
          html.indexOf("Resultado estratégico de la partida"),
      );
      if (!complete)
        assert(!html.includes("Cancún recuperó su capacidad operativa"));
    }
  }
});

test("P9: proyector anónimo conserva controles y suspenso, sin fragmentos ni nombres antes de los 3 s", () => {
  const dom = new JSDOM("");
  const old = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true }),
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: dom.window,
  });
  try {
    const state: PublicState = {
      ...DEMO_STATE,
      phase: "recovery",
      stage: "playing",
      recovery: { completed: 2, total: 5, done: false, integrityAlert: true },
    };
    const html = renderToStaticMarkup(createElement(Dashboard, { state }));
    assert(html.includes("ANOMALÍA DETECTADA"));
    assert(html.includes("Pantalla completa"));
    assert(!html.includes("recoveryChallenge"));
    const truth = renderToStaticMarkup(
      createElement(Dashboard, {
        state: {
          ...state,
          phase: "revealed",
          judgment: {
            stage: "reveal",
            step: "truth",
            elapsed: 2,
            votesExpected: 6,
          },
        },
      }),
    );
    assert(truth.includes("El momento de la verdad"));
    assert(!truth.includes("Resultado estratégico de la partida"));
  } finally {
    if (old) Object.defineProperty(globalThis, "window", old);
    else Reflect.deleteProperty(globalThis, "window");
    dom.window.close();
  }
});
