import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameEngine } from "../server/engine";
import { missionStory } from "../shared/missionStory";
import type { CityMission, PublicState, RoundResult } from "../shared/types";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import MissionTransition from "../client/components/MissionTransition";
import Briefing from "../client/components/Briefing";
import Player from "../client/pages/Player";
import type { GameConnection } from "../client/useGame";

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: true }) },
});
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: { search: "", hash: "" },
});
const phases = ["mail", "ddos", "identity", "recovery"] as const;
const result = (
  phase: CityMission,
  winner: RoundResult["winner"],
  description = "",
) => ({ phase, winner, metric: 0, description });
const state = (
  phase: CityMission,
  results: RoundResult[] = [],
): PublicState => ({
  ...DEMO_STATE,
  phase,
  stage: "finished",
  results,
});

test("E4: inicio y las cuatro conexiones usan resultados, sin inferir daños de puntos o estabilidad", () => {
  const intro = missionStory({ ...state("mail"), stage: "briefing" })!;
  assert(intro.text.includes("Solicitudes sospechosas"));
  assert(!intro.text.includes("alcanzó"));
  for (const [index, phase] of phases.entries()) {
    for (const winner of ["defenders", "impostor", "inconclusive"] as const) {
      for (const interrupted of [false, true]) {
        if (interrupted && winner !== "inconclusive") continue;
        const current = state(phase, [
          result(
            phase,
            winner,
            interrupted ? "Interrumpida por administrador." : "DETALLE_PRIVADO",
          ),
        ]);
        current.recovery = {
          completed: winner === "defenders" ? 2 : 1,
          total: 2,
          done: winner === "defenders",
        };
        current.scores = { defenders: 100, impostor: 0 };
        const story = missionStory(current)!;
        const publicHtml = renderToStaticMarkup(
          createElement(Dashboard, { state: current }),
        );
        assert(publicHtml.includes(story.text));
        assert(
          story.title.includes(
            index === 3 ? "JUICIO FINAL" : `MISIÓN 0${index + 2}`,
          ),
        );
        assert(story.text.split(/[.!?]+/).filter((s) => s.trim()).length <= 3);
        assert(!story.text.includes("DETALLE_PRIVADO"));
        if (phase === "recovery") {
          assert(
            story.text.includes(
              winner === "inconclusive"
                ? "interrumpida"
                : winner === "defenders"
                  ? "protocolo completo"
                  : "protocolo incompleto",
            ),
          );
        } else {
          assert(
            story.text.includes(
              interrupted
                ? "interrumpida"
                : winner === "defenders"
                  ? "alcanzó la meta"
                  : winner === "impostor"
                    ? "obtuvo ventaja"
                    : "sin ganador",
            ),
          );
          const nextBriefing = {
            ...current,
            phase: phases[index + 1],
            stage: "briefing" as const,
          };
          assert.deepEqual(missionStory(nextBriefing), story);
        }
        assert.deepEqual(missionStory({ ...current, paused: true }), story);
      }
    }
  }
});

test("E4: sin resultado no inventa cierres; no aparece durante juego, cuenta ni revelación", () => {
  assert.equal(missionStory(state("ddos")), null);
  assert(
    missionStory({ ...state("identity"), stage: "briefing" })!.text.includes(
      "no tiene cierre confirmado",
    ),
  );
  for (const stage of ["playing", "countdown"] as const)
    assert.equal(missionStory({ ...state("mail"), stage }), null);
  for (const phase of ["voting", "revealed"] as const)
    assert.equal(missionStory({ ...state("recovery"), phase }), null);
});

test("E4: pantalla pública y terminal comparten relato sin autores, objetivos ni sabotaje", () => {
  const engine = new GameEngine({ random: () => 0.2 });
  const created = engine.create(3);
  const invite = created.snapshot!.admin!.invites[0];
  const joined = engine.join({
    code: created.session!.code,
    slot: invite.slot,
    invite: invite.invite,
    name: "SECRETO_AUTOR",
  });
  const player = engine.snapshot(joined.session!)!.player!;
  const current = {
    ...state("ddos", [result("mail", "impostor", "SECRETO_VICTIMA")]),
    stage: "briefing" as const,
  };
  const expected = missionStory(current)!.text;
  const publicHtml = renderToStaticMarkup(
    createElement(Dashboard, { state: current }),
  );
  const briefing = renderToStaticMarkup(
    createElement(Briefing, { state: current, player, roleVisible: false }),
  );
  assert(publicHtml.includes(expected));
  assert(briefing.includes(expected));
  for (const privateText of [
    "SECRETO_AUTOR",
    "SECRETO_VICTIMA",
    invite.invite,
    "Tu misión secreta",
  ])
    assert(!publicHtml.includes(privateText));
  const finished = {
    ...current,
    phase: "mail" as const,
    stage: "finished" as const,
  };
  const game = {
    snapshot: { public: finished, player },
    connected: true,
    error: "",
  } as GameConnection;
  const terminal = renderToStaticMarkup(
    createElement(Player, { code: "1234", game }),
  );
  assert(terminal.includes(missionStory(finished)!.text));
});

test("E4: 3–6 participantes conservan autoarranque 20+5 s, pausa, reinicio y avance docente", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    let now = 0,
      event = 0;
    const engine = new GameEngine({ now: () => now, random: () => 0.2 });
    const created = engine.create(capacity, true);
    const admin = created.session!;
    engine.bind(admin, "admin");
    for (const invite of created.snapshot!.admin!.invites) {
      const joined = engine.join({
        code: admin.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `Equipo ${invite.slot}`,
      });
      engine.bind(joined.session!, `socket-${invite.slot}`);
    }
    const snapshot = () => engine.snapshot(admin)!.public;
    const advance = (ms: number) => {
      now += ms;
      engine.tick();
    };
    const command = (cmd: Parameters<typeof engine.admin>[2]) =>
      engine.admin(admin, `e4-${event++}`, cmd);
    assert.equal(snapshot().stage, "briefing");
    assert.equal(snapshot().briefingRemaining, 20);
    const before = JSON.stringify(snapshot());
    renderToStaticMarkup(
      createElement(MissionTransition, { state: snapshot() }),
    );
    assert.equal(JSON.stringify(snapshot()), before);
    assert(command("pause").ok);
    advance(40_000);
    assert.equal(snapshot().briefingRemaining, 20);
    assert(command("resume").ok);
    advance(20_000);
    assert.equal(snapshot().stage, "countdown");
    advance(4_999);
    assert.equal(snapshot().stage, "countdown");
    advance(1);
    assert.equal(snapshot().stage, "playing");
    for (const [index, phase] of phases.entries()) {
      if (index > 0) {
        assert.equal(snapshot().stage, "briefing");
        assert(missionStory(snapshot()));
        assert(command("start").ok);
        advance(5_000);
      }
      assert.equal(snapshot().phase, phase);
      assert.equal(snapshot().clock, 0);
      assert(command("pause").ok);
      advance(12_000);
      assert.equal(snapshot().clock, 0);
      assert(command("resume").ok);
      if (phase === "mail") {
        assert(command("stop").ok);
        assert(missionStory(snapshot())!.text.includes("interrumpida"));
        assert(command("restart").ok);
        assert.equal(snapshot().results.length, 0);
        assert(!missionStory(snapshot())!.text.includes("interrumpida"));
        assert(command("start").ok);
        advance(5_000);
      }
      const seconds = snapshot().duration;
      advance(seconds * 1000);
      assert.equal(snapshot().stage, "finished");
      assert.equal(snapshot().clock, seconds * 1000);
      assert(missionStory(snapshot()));
      assert(command(index < 3 ? "next" : "judgment").ok);
    }
    assert.equal(snapshot().phase, "voting");
  }
});
