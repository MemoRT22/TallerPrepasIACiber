import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { GameEngine } from "../server/engine";
import type {
  AdminState,
  GameAction,
  LogEntry,
  PublicState,
  Session,
} from "../shared/types";
import { teacherDebrief } from "../client/teacherDebrief";
import TeacherDebrief from "../client/components/TeacherDebrief";
import Admin from "../client/pages/Admin";
import Player from "../client/pages/Player";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import type { GameConnection } from "../client/useGame";

const TITLE = "CIERRE DOCENTE — ¿QUÉ APRENDIMOS?";
const finished: PublicState = {
  ...DEMO_STATE,
  phase: "revealed",
  stage: "finished",
  judgment: {
    stage: "reveal",
    step: "learning",
    elapsed: 30,
    votesExpected: 3,
  },
  reveal: {
    winner: "tie",
    impostorDepartment: "SECRETO_SERVICIO",
    impostorName: "SECRETO_NOMBRE",
    votes: [],
    logs: [],
  },
  results: [],
};
const entry = (phase: LogEntry["phase"], type: string): LogEntry => ({
  at: 0,
  phase,
  type,
  department: "SECRETO_VICTIMA",
  detail: "SECRETO_REGISTRO correct=false result=false_authorized_infiltration",
});
const admin = (logs: LogEntry[] = []): AdminState => ({
  invites: [],
  players: [],
  closingAudit: {
    logs,
    votes: [
      {
        voter: "SECRETO_VOTO",
        suspect: "SECRETO_OBJETIVO",
        reason: "SECRETO_RAZON",
      },
    ],
  },
});
const html = (state = finished, a = admin(), connected = true) =>
  renderToStaticMarkup(
    createElement(TeacherDebrief, { state, admin: a, connected }),
  );

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: true }) },
});
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: { origin: "http://localhost", search: "", hash: "" },
});

test("E5: solo después de 30 s y con estado administrativo; desconectado no deja material previo", () => {
  assert.equal(teacherDebrief(finished), null);
  for (const elapsed of [0, 3, 9, 20, 29]) {
    assert.equal(
      html({ ...finished, judgment: { ...finished.judgment!, elapsed } }),
      "",
    );
  }
  for (const phase of ["lobby", "mail", "identity", "voting"] as const)
    assert.equal(html({ ...finished, phase }), "");
  assert.equal(html({ ...finished, judgment: undefined }), "");
  assert.equal(html(finished, admin(), false), "");
  assert(html().includes(TITLE));
  assert(!html().includes("open="));
});

test("E5: cada consulta procede de su tipo y misión; no afirma lectura, consulta completada ni decisión correcta", () => {
  const cases = [
    ["mail", "mail_inspect", "inspección de correos"],
    ["identity", "identity_verify", "consulta al registro de Identidad"],
    [
      "recovery",
      "recovery_key_verify",
      "verificación de claves de Recuperación",
    ],
  ] as const;
  for (const [phase, type, expected] of cases) {
    const item = teacherDebrief(finished, admin([entry(phase, type)]))!
      .questions[0];
    assert(item.evidence?.includes(expected));
    assert(item.evidence?.startsWith("Se solicitaron"));
    const wrongPhase = phase === "mail" ? "ddos" : "mail";
    assert.equal(
      teacherDebrief(finished, admin([entry(wrongPhase, type)]))!.questions[0]
        .evidence,
      null,
    );
  }
  const combined = teacherDebrief(
    finished,
    admin(cases.map(([phase, type]) => entry(phase, type))),
  )!;
  assert.equal(combined.questions.length, 3);
  for (const [, , expected] of cases)
    assert(combined.questions[0].evidence!.includes(expected));
});

test("E5: errores por eventos comprobables, sin interpretar detalles libres ni inventar intenciones", () => {
  assert(
    teacherDebrief(
      finished,
      admin([entry("ddos", "blue_lost")]),
    )!.questions[1].evidence!.includes("tráfico legítimo"),
  );
  assert(
    teacherDebrief(
      finished,
      admin([entry("identity", "identity_blocked")]),
    )!.questions[1].evidence!.includes("servicio comprometido"),
  );
  for (const logs of [
    [],
    [entry("mail", "blue_lost")],
    [entry("identity", "identity_allow")],
    [entry("mail", "mail_decision")],
    [entry("ddos", "red_impact")],
  ]) {
    const item = teacherDebrief(finished, admin(logs))!.questions[1];
    assert.equal(item.evidence, null);
    assert(item.suggestion.includes("hipótesis"));
  }
});

test("E5: resultados, empates e inconclusas no se convierten en incidentes inventados", () => {
  for (const winner of ["defenders", "impostor", "tie"] as const)
    for (const phase of ["mail", "ddos", "identity", "recovery"] as const)
      for (const missionWinner of [
        "defenders",
        "impostor",
        "inconclusive",
      ] as const) {
        const state = {
          ...finished,
          reveal: { ...finished.reveal!, winner },
          results: [
            {
              phase,
              winner: missionWinner,
              metric: 0,
              description: "SECRETO_DESCRIPCION",
            },
          ],
        };
        const result = teacherDebrief(state, admin())!;
        assert.equal(result.questions[1].evidence, null);
        assert(
          result.questions[2].evidence!.includes(
            missionWinner === "defenders"
              ? "alcanzó la meta"
              : missionWinner === "impostor"
                ? "ganó la misión"
                : "sin punto adjudicado",
          ),
        );
        assert(!JSON.stringify(result).includes("SECRETO_"));
        assert(result.questions[2].suggestion.length > 20);
      }
  const missing = html(finished, { invites: [], players: [] });
  assert(missing.includes("Recomendación general"));
  assert(missing.includes("no significa que no haya ocurrido"));
});

test("E5: el componente no reproduce nombres, votos, objetivos, logs ni reflexión pública como evidencia", () => {
  const state = {
    ...finished,
    reveal: {
      ...finished.reveal!,
      reflection: {
        success: "SECRETO_ACIERTO",
        vulnerability: "SECRETO_ERROR",
        recommendation: "SECRETO_RECOMENDACION",
      },
    },
  };
  const result = html(
    state,
    admin([entry("mail", "mail_inspect"), entry("ddos", "blue_lost")]),
  );
  assert(!result.includes("SECRETO_"));
  assert.equal((result.match(/<h3>/g) ?? []).length, 3);
  assert(result.includes("Material privado · no proyectar"));
  assert(!result.includes("Descargar"));
});

function fixture(capacity: 3 | 4 | 5 | 6) {
  let now = 0,
    sequence = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0.2 });
  const created = engine.create(capacity),
    operator = created.session!;
  engine.bind(operator, "docente");
  const command = (cmd: Parameters<typeof engine.admin>[2]) =>
    engine.admin(operator, `c${sequence++}`, cmd);
  const act = (session: Session, value: Omit<GameAction, "eventId">) =>
    engine.action(session, { eventId: `a${sequence++}`, ...value });
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  const snapshot = () => engine.snapshot(operator)!;
  const play = (withEvidence: boolean) => {
    const players = snapshot().admin!.invites.map(
      (invite) =>
        engine.join({
          code: operator.code,
          slot: invite.slot,
          invite: invite.invite,
          name: `E5 ${invite.slot}`,
        }).session!,
    );
    assert(command("assign").ok);
    const room = engine.rooms.get(operator.code)!;
    const internal = (s: Session) =>
      room.players.find((p) => p.token === s.token)!;
    const defender = players.find((s) => internal(s).role === "defender")!;
    const hacker = players.find((s) => internal(s).role === "impostor")!;
    for (const phase of ["mail", "ddos", "identity", "recovery"] as const) {
      assert(command("start").ok);
      advance(5000);
      assert.equal(room.phase, phase);
      if (withEvidence) {
        if (phase === "mail")
          assert(
            act(defender, {
              type: "mail:inspect",
              cardId: internal(defender).mail[0].id,
            }).ok,
          );
        if (phase === "ddos") {
          const blue = internal(defender).traffic.find(
            (p) => p.kind === "blue",
          )!;
          assert(blue);
          assert(act(defender, { type: "ddos:tap", pointId: blue.id }).ok);
        }
        if (phase === "identity")
          assert(
            act(defender, {
              type: "identity:verify",
              cardId: internal(defender).card!.id,
            }).ok,
          );
        if (phase === "recovery") {
          assert(
            act(hacker, {
              type: "recovery:challenge-solve",
              answer: internal(hacker).recoveryChallenge!.answer,
            }).ok,
          );
          assert(
            act(hacker, {
              type: "recovery:sabotage",
              target: internal(defender).department,
            }).ok,
          );
          assert(act(defender, { type: "recovery:verify" }).ok);
        }
      }
      assert(command("stop").ok);
      assert(command(phase === "recovery" ? "judgment" : "next").ok);
    }
    assert(command("voting").ok);
    assert(command("reveal").ok);
    return { players, defender };
  };
  return { engine, operator, command, advance, snapshot, play };
}

test("E5: datos reales 3–6, privacidad de snapshots, reconexión y limpieza completa del siguiente grupo", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = fixture(capacity),
      group = f.play(true);
    assert.equal(teacherDebrief(f.snapshot().public, f.snapshot().admin), null);
    f.advance(30_000);
    const snapshot = f.snapshot();
    const material = teacherDebrief(snapshot.public, snapshot.admin)!;
    assert(material.questions[0].evidence!.includes("inspección de correos"));
    assert(material.questions[0].evidence!.includes("registro de Identidad"));
    assert(material.questions[0].evidence!.includes("claves de Recuperación"));
    assert(material.questions[1].evidence!.includes("tráfico legítimo"));
    assert(snapshot.admin!.closingAudit!.logs.length > 0);
    const publicState = f.engine.getPublicSnapshot(f.operator.code)!;
    assert.deepEqual(publicState.reveal!.logs, []);
    assert.deepEqual(publicState.reveal!.votes, []);
    assert.equal((publicState as any).closingAudit, undefined);
    for (const session of group.players) {
      const player = f.engine.snapshot(session)!;
      assert.equal(player.admin, undefined);
      assert.equal(teacherDebrief(player.public, player.admin), null);
      assert.equal(f.engine.snapshot({ ...session, kind: "admin" }), null);
      const game = {
        snapshot: player,
        connected: true,
        error: "",
      } as GameConnection;
      assert(
        !renderToStaticMarkup(
          createElement(Player, { code: f.operator.code, game }),
        ).includes(TITLE),
      );
    }
    assert(
      !renderToStaticMarkup(
        createElement(Dashboard, { state: publicState }),
      ).includes(TITLE),
    );
    const game = {
      snapshot,
      connected: true,
      error: "",
      busy: false,
    } as GameConnection;
    assert(
      renderToStaticMarkup(createElement(Admin, { game })).includes(TITLE),
    );
    const withoutAdmin = {
      ...game,
      snapshot: { public: snapshot.public },
    } as GameConnection;
    assert(
      !renderToStaticMarkup(
        createElement(Admin, { game: withoutAdmin }),
      ).includes(TITLE),
    );
    f.engine.unbind("docente");
    assert(f.engine.resume(f.operator).ok);
    f.engine.bind(f.operator, "docente-reconectado");
    assert.deepEqual(
      teacherDebrief(f.snapshot().public, f.snapshot().admin),
      material,
    );
    assert(f.command("reset-all").ok);
    assert.equal(f.snapshot().admin!.closingAudit, undefined);
    assert.equal(teacherDebrief(f.snapshot().public, f.snapshot().admin), null);
    assert.equal(f.engine.snapshot(group.defender), null);
    f.play(false);
    f.advance(30_000);
    const next = teacherDebrief(f.snapshot().public, f.snapshot().admin)!;
    assert.equal(next.questions[0].evidence, null);
    assert.equal(next.questions[1].evidence, null);
  }
});

test("E5: cerrar por defecto y eliminar texto anterior al desconectar/reiniciar en el mismo montaje", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  const props = {
    state: finished,
    admin: admin([entry("ddos", "blue_lost")]),
    connected: true,
  };
  try {
    await act(async () => root.render(createElement(TeacherDebrief, props)));
    const details = dom.window.document.querySelector("details")!;
    assert.equal(details.open, false);
    details.open = true;
    await act(async () =>
      root.render(
        createElement(TeacherDebrief, { ...props, connected: false }),
      ),
    );
    assert.equal(dom.window.document.querySelector("details"), null);
    await act(async () => root.render(createElement(TeacherDebrief, props)));
    assert.equal(dom.window.document.querySelector("details")!.open, false);
    await act(async () =>
      root.render(
        createElement(TeacherDebrief, {
          ...props,
          state: { ...finished, phase: "lobby", reveal: undefined },
        }),
      ),
    );
    assert.equal(dom.window.document.getElementById("root")!.textContent, "");
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
