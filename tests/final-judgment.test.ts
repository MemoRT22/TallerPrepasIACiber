import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../server/engine.js";
import {
  votingBonus,
  revealStep,
  finalReflection,
} from "../shared/finalRules.js";
import type { Capacity, GameAction, Session } from "../shared/types.js";

function fixture(capacity: Capacity = 4) {
  let now = 0,
    sequence = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0.37 });
  const created = engine.create(capacity),
    admin = created.session!;
  const players = created.snapshot!.admin!.invites.map(
    (i) =>
      engine.join({
        code: admin.code,
        slot: i.slot,
        invite: i.invite,
        name: `Equipo ${i.slot}`,
      }).session!,
  );
  players.forEach((p, i) => engine.bind(p, `socket-${i}`));
  const room = engine.rooms.get(admin.code)!;
  const command = (
    name: Parameters<typeof engine.admin>[2],
    id = `c-${sequence++}`,
  ) => engine.admin(admin, id, name);
  const act = (
    p: Session,
    value: Omit<GameAction, "eventId">,
    id = `a-${sequence++}`,
  ) => engine.action(p, { eventId: id, ...value });
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  const snapshot = () => engine.snapshot(admin)!.public;
  assert(command("assign").ok);
  for (let i = 0; i < 3; i++) {
    assert(command("start").ok);
    advance(5000);
    assert(command("stop").ok);
    assert(command("next").ok);
  }
  assert(command("start").ok);
  advance(5000);
  const internal = (s: Session) =>
    room.players.find((p) => p.token === s.token)!;
  const impostor = players.find((s) => internal(s).role === "impostor")!;
  const defenders = players.filter((s) => s !== impostor);
  const recover = () => {
    for (const s of defenders)
      assert(
        act(s, {
          type: "recovery:solve",
          answer: internal(s).fragment!.plaintext,
        }).ok,
      );
  };
  const vote = (s: Session, correct = true, id?: string) =>
    act(
      s,
      {
        type: "vote",
        suspect: internal(correct ? impostor : defenders[0]).department,
        reason: "Señal observada en la simulación",
      },
      id,
    );
  return {
    engine,
    admin,
    players,
    room,
    command,
    act,
    advance,
    snapshot,
    internal,
    impostor,
    defenders,
    recover,
    vote,
  };
}

test("P7: mayoría estricta 3–6, cero elegibles, empates, abstenciones e impostor sin voto útil", () => {
  for (const capacity of [3, 4, 5, 6] as const)
    for (let correct = 0; correct < capacity; correct++) {
      const eligible = Array.from({ length: capacity - 1 }, (_, i) => `d${i}`);
      const ballots = eligible
        .slice(0, correct)
        .map((id) => ({ id, suspect: "impostor" }));
      const result = votingBonus(
        eligible,
        [...ballots, { id: "hacker", suspect: "impostor" }],
        "impostor",
      );
      assert.equal(
        result.winner,
        correct > (capacity - 1) / 2 ? "defenders" : "impostor",
      );
      assert.equal(result.correct, correct);
      assert.equal(result.abstentions, capacity - 1 - correct);
      assert.deepEqual(
        votingBonus(eligible, [...ballots, ...ballots], "impostor"),
        votingBonus(eligible, ballots, "impostor"),
      );
    }
  assert.equal(votingBonus([], [], "impostor").winner, "impostor");
  assert.deepEqual([0, 3, 9, 20, 30].map(revealStep), [
    "truth",
    "identity",
    "result",
    "learning",
    "learning",
  ]);
});

test("P7: recuperación completa, timeout e interrupción adjudican una vez y repetir revierte", () => {
  for (const mode of ["complete", "timeout", "manual"] as const) {
    const f = fixture();
    if (mode === "complete") f.recover();
    else if (mode === "timeout") f.advance(120000);
    else assert(f.command("stop").ok);
    const scores = {
      defenders: mode === "complete" ? 1 : 0,
      impostor: mode === "timeout" ? 1 : 0,
    };
    assert.deepEqual(f.room.scores, scores);
    assert.equal(
      f.room.results.filter((r) => r.phase === "recovery").length,
      1,
    );
    f.advance(100000);
    assert.deepEqual(f.room.scores, scores);
    assert(f.command("restart", "restart").ok);
    assert(f.command("restart", "restart").ok);
    assert.deepEqual(f.room.scores, { defenders: 0, impostor: 0 });
    assert(!f.room.results.some((r) => r.phase === "recovery"));
    assert(f.command("start").ok);
    f.advance(5000);
    f.recover();
    assert.deepEqual(f.room.scores, { defenders: 1, impostor: 0 });
    assert(f.command("judgment").ok);
    assert.deepEqual(f.room.scores, { defenders: 1, impostor: 0 });
  }
});

test("P7: debate, permisos, voto privado único, confirmación autoritativa y bonus solo al revelar", () => {
  const f = fixture();
  assert(!f.vote(f.defenders[0]).ok);
  assert(!f.engine.admin(f.players[0], "fake", "judgment").ok);
  f.recover();
  assert(f.command("judgment").ok);
  assert.equal(f.snapshot().judgment!.stage, "debate");
  assert(!f.vote(f.defenders[0]).ok);
  assert(!f.command("reveal").ok);
  assert(f.command("voting").ok);
  const before = f.snapshot().scores;
  assert(f.vote(f.impostor, true, "hacker-vote").ok);
  assert(f.vote(f.impostor, true, "hacker-vote").ok);
  assert(!f.vote(f.impostor, false).ok);
  assert(f.vote(f.defenders[0], true, "first-vote").ok);
  assert(f.vote(f.defenders[0], false, "first-vote").ok); // Duplicate payload cannot replace the original ballot.
  assert(!f.vote(f.defenders[0], false).ok);
  assert.equal(
    f.internal(f.defenders[0]).vote!.suspect,
    f.internal(f.impostor).department,
  );
  assert.deepEqual(f.snapshot().scores, before);
  assert(!f.snapshot().results.some((r) => r.phase === "voting"));
  const publicBefore = JSON.stringify(f.snapshot());
  assert(!publicBefore.includes("Señal observada en la simulación"));
  assert.equal(f.snapshot().reveal, undefined);
  assert.equal(f.snapshot().judgment!.votesExpected, 4);
  assert(!("votingDefenders" in f.snapshot()));
  assert(!f.engine.admin(f.players[0], "fake-reveal", "reveal").ok);
  assert(f.command("reveal", "reveal").ok); // Teacher may close with abstentions.
  assert.equal(f.snapshot().reveal!.bonus!.winner, "impostor");
  const finalScores = f.snapshot().scores;
  assert(f.command("reveal", "reveal").ok);
  assert(!f.command("reveal").ok);
  assert.deepEqual(f.snapshot().scores, finalScores);
  assert.equal(f.room.results.filter((r) => r.phase === "voting").length, 1);
  assert(!f.vote(f.defenders[1]).ok);
  assert.equal(f.snapshot().reveal!.votes.length, 0);
  assert.equal(f.snapshot().reveal!.logs.length, 0);
  assert.equal(
    f.engine.snapshot(f.admin)!.admin!.closingAudit!.votes.length,
    2,
  );
  assert.equal(f.engine.snapshot(f.players[0])!.admin, undefined);
});

test("P7: elegibilidad congelada, desconexión no rebaja mayoría ni elimina voto y reconexión no añade", () => {
  const f = fixture(5);
  f.recover();
  f.engine.unbind("socket-0"); // Offline before opening; excluded regardless of role.
  assert(f.command("voting").ok);
  const eligible = [...f.room.votingDefenders];
  const expected = f.snapshot().judgment!.votesExpected;
  f.engine.bind(f.players[0], "new-0");
  assert.equal(f.engine.snapshot(f.players[0])!.player!.voteEligible, false);
  assert(!f.vote(f.players[0]).ok);
  const connectedDefender = f.defenders.find((s) =>
    eligible.includes(s.token),
  )!;
  assert(f.vote(connectedDefender).ok);
  const index = f.players.indexOf(connectedDefender);
  f.engine.unbind(`socket-${index}`);
  assert.deepEqual(f.room.votingDefenders, eligible);
  assert.equal(f.snapshot().judgment!.votesExpected, expected);
  f.engine.bind(connectedDefender, "new-eligible");
  assert(!f.vote(connectedDefender).ok);
  f.engine.unbind("new-eligible");
  assert(f.command("reveal").ok);
  assert.equal(f.snapshot().reveal!.bonus!.eligible, eligible.length);
  assert.equal(f.snapshot().reveal!.bonus!.correct, 1);
  assert.equal(
    f.engine.snapshot(f.admin)!.admin!.closingAudit!.votes.length,
    1,
  );
});

test("P7: flujo completo 3–6, ambos ganadores/empate, suma de cinco rubros y continuidad P6", () => {
  for (const capacity of [3, 4, 5, 6] as const)
    for (const mode of ["defenders", "impostor", "tie"] as const) {
      const f = fixture(capacity);
      if (mode === "impostor") f.advance(120000);
      else f.recover();
      const memory = () => {
        const { message, ...city } = f.snapshot().city!;
        return city;
      };
      const city = memory();
      assert(f.command("judgment").ok);
      assert(f.command("voting").ok);
      for (const s of f.players) assert(f.vote(s, mode === "defenders").ok);
      assert(f.command("reveal").ok);
      assert.equal(f.snapshot().reveal!.winner, mode);
      assert.deepEqual(memory(), city);
      const results = f.snapshot().results;
      assert.equal(results.length, 5);
      assert.deepEqual(f.snapshot().scores, {
        defenders: results.filter((r) => r.winner === "defenders").length,
        impostor: results.filter((r) => r.winner === "impostor").length,
      });
      assert.equal(f.snapshot().judgment!.step, "truth");
      for (const [ms, step] of [
        [3000, "identity"],
        [6000, "result"],
        [11000, "learning"],
        [10000, "learning"],
      ] as const) {
        f.advance(ms);
        assert.equal(f.snapshot().judgment!.step, step);
      }
      assert.equal(f.snapshot().judgment!.elapsed, 30);
      assert.deepEqual(memory(), city);
      assert(f.command("reset-all").ok);
      assert.equal(f.snapshot().judgment, undefined);
      assert.equal(f.snapshot().reveal, undefined);
      assert.deepEqual(f.snapshot().scores, { defenders: 0, impostor: 0 });
      assert.equal(f.snapshot().city!.stability, 100);
    }
});

test("P7: reflexión no inventa aciertos o errores ni expone nombres, motivos o logs", () => {
  const neutral = finalReflection([], {
    inspected: false,
    blueLost: false,
    redImpact: false,
  });
  assert(neutral.success.includes("No se registró"));
  assert(neutral.vulnerability.includes("No hay un error concreto"));
  assert(neutral.recommendation.includes("simulación"));
  assert(
    finalReflection([], {
      inspected: true,
      blueLost: true,
      redImpact: true,
    }).success.includes("consultó evidencia"),
  );
  assert(
    finalReflection([], {
      inspected: false,
      blueLost: true,
      redImpact: true,
    }).vulnerability.includes("tráfico legítimo"),
  );
});
