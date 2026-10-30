import test from "node:test";
import assert from "node:assert/strict";
import {
  identityFixture,
  runStudy,
} from "../scripts/analysis/e3-identity-pressure";
import { DEFAULT_SETTINGS } from "../shared/types";

// These tests characterize current rules. They do not approve a balance change.
test("E3: 10/8/6 s se asignan al activar; cruzar un tercio no recorta la tarjeta activa", () => {
  const f = identityFixture();
  const s = f.defenders[0],
    p = f.internal(s);
  assert.equal(p.card!.expires, 10_000);
  f.advance(39_900);
  assert(
    f.action(s, {
      type: "identity:decide",
      cardId: p.card!.id,
      accept: p.card!.legit,
    }).ok,
  );
  assert.equal(p.card!.expires, 49_900);
  f.advance(100);
  assert.equal(p.card!.expires, 49_900);
  assert(
    f.action(s, {
      type: "identity:decide",
      cardId: p.card!.id,
      accept: p.card!.legit,
    }).ok,
  );
  assert.equal(p.card!.expires, 48_000);
  f.advance(39_900);
  assert(
    f.action(s, {
      type: "identity:decide",
      cardId: p.card!.id,
      accept: p.card!.legit,
    }).ok,
  );
  assert.equal(p.card!.expires, 87_900);
  f.advance(100);
  assert.equal(p.card!.expires, 87_900);
  assert(
    f.action(s, {
      type: "identity:decide",
      cardId: p.card!.id,
      accept: p.card!.legit,
    }).ok,
  );
  assert.equal(p.card!.expires, 86_000);
  assert.equal(f.room.settings.identitySeconds, 120);
  assert.equal(f.room.settings.identityAccuracy, 70);
});

test("E3: la expiración no reinicia inactividad; una tarjeta nueva puede heredar un vencimiento próximo", () => {
  const f = identityFixture();
  const s = f.defenders[0],
    p = f.internal(s),
    first = p.card!.id;
  f.advance(4_999);
  assert.equal(p.inactivityPenalties, 0);
  f.advance(1);
  assert.equal(p.inactivityPenalties, 1);
  assert.equal(p.card!.id, first);
  f.advance(5_000);
  assert.notEqual(p.card!.id, first);
  assert.equal(p.inactivityPenalties, 2);
  assert.equal(p.nextIdleAt, 15_000);
});

test("E3: acción aceptada reinicia 5 s; rechazo y retransmisión deduplicada no lo hacen", () => {
  const f = identityFixture();
  const s = f.defenders[0],
    p = f.internal(s);
  f.advance(4_000);
  const action = { type: "identity:verify" as const, cardId: p.card!.id };
  assert(f.action(s, action, "verify-once").ok);
  assert.equal(p.nextIdleAt, 9_000);
  f.advance(500);
  assert(f.action(s, action, "verify-once").ok);
  assert.equal(p.nextIdleAt, 9_000);
  assert.equal(
    f.action(s, { type: "identity:decide", cardId: p.card!.id, accept: true })
      .ok,
    false,
  );
  assert.equal(p.nextIdleAt, 9_000);
  f.advance(4_499);
  assert.equal(p.inactivityPenalties, 0);
  f.advance(1);
  assert.equal(p.inactivityPenalties, 1);
  assert(
    f.action(s, {
      type: "identity:decide",
      cardId: p.card!.id,
      accept: p.card!.legit,
    }).ok,
  );
  assert.equal(p.nextIdleAt, 14_000);
});

test("E3: consultar no congela expiración, no penaliza durante 1,5 s y conserva 1,5 s mínimo para decidir", () => {
  const f = identityFixture();
  f.advance(80_000);
  const s = f.defenders[0],
    p = f.internal(s);
  // Start a naturally activated 6-second card at t=80 s.
  assert(
    f.action(s, {
      type: "identity:decide",
      cardId: p.card!.id,
      accept: p.card!.legit,
    }).ok,
  );
  const card = p.card!,
    expires = card.expires;
  assert.equal(expires, 86_000);
  f.advance(3_000);
  const priorPenalty = p.inactivityPenalties;
  assert(f.action(s, { type: "identity:verify", cardId: card.id }).ok);
  assert.equal(card.expires, expires);
  assert.equal(card.verifyReadyAt, 84_500);
  assert.equal(p.nextIdleAt, 88_000);
  assert(f.command("pause").ok);
  f.advance(15_000);
  assert.equal(f.room.clock, 83_000);
  assert.equal(p.inactivityPenalties, priorPenalty);
  assert(f.command("resume").ok);
  f.advance(1_500);
  assert.equal(p.inactivityPenalties, priorPenalty);
  assert.equal(card.expires - f.room.clock, 1_500);
  assert(f.engine.snapshot(s)!.player!.card!.verification!.evidence?.length);
  const second = f.internal(f.defenders[1]),
    uses = second.identityVerificationsRemaining;
  assert.equal(
    f.action(f.defenders[1], {
      type: "identity:verify",
      cardId: second.card!.id,
    }).ok,
    false,
  );
  assert.equal(second.identityVerificationsRemaining, uses);
});

test("E3: puntos malos reducen la precisión, sin crear infiltraciones ni puntos directos al atacante", () => {
  const finish = (penalties: number) => {
    const f = identityFixture();
    f.advance(119_900);
    for (const s of f.defenders) {
      const p = f.internal(s);
      // Controlled fixture isolates the real timeout formula, not a student run.
      p.legitShown = 4;
      p.legitAuthorized = 4;
      p.inactivityPenalties = penalties;
      p.card!.expires = 130_000;
      p.nextIdleAt = 125_000;
      assert.equal(p.infiltrations, 0);
    }
    const before = { ...f.room.scores };
    f.advance(100);
    return {
      result: f.room.results.find((r) => r.phase === "identity")!,
      before,
      scores: f.room.scores,
    };
  };
  const clean = finish(0),
    idle = finish(2);
  assert.equal(clean.result.metric, 100);
  assert.equal(clean.result.winner, "defenders");
  assert.equal(idle.result.metric, 66.67);
  assert.equal(idle.result.winner, "inconclusive");
  assert.deepEqual(idle.scores, idle.before);
  assert.equal(DEFAULT_SETTINGS.identityAccuracy, 70);
});

test("E3: 60 trazas reproducibles, baseline idéntico al motor y alternativa de consulta sin efecto artificial", () => {
  const data = runStudy();
  assert.equal(data.caseCount, 60);
  assert.equal(data.policyCount, 4);
  assert.deepEqual(
    [...new Set(data.cases.map((c) => c.capacity))],
    [3, 4, 5, 6],
  );
  for (const current of data.cases) {
    assert(current.missionSeconds <= 120);
    for (const policy of current.results) {
      assert(policy.penalties <= current.results[0].penalties);
      assert(policy.metric >= current.results[0].metric);
      if (current.blocked >= current.targets && current.targets > 0)
        assert.equal(policy.winner, "impostor");
    }
  }
  assert(
    data.cases.some(
      (c) =>
        c.profile === "oraculo_6s" && c.results[0].metric < 70 && c.wrong === 0,
    ),
  );
  assert(
    data.cases.some(
      (c) =>
        c.profile === "permitir_todo_3s_con_ataque" &&
        c.results.every((r) => r.winner === "impostor"),
    ),
  );
});
