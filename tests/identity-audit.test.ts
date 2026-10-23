import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../server/engine.js";
import {
  DEFAULT_SETTINGS,
  type GameAction,
  type Session,
} from "../shared/types.js";

function setup(capacity: 3 | 4 | 5 | 6 = 4, seed0 = 33) {
  let now = 0;
  let seed = seed0;
  let event = 0;
  const engine = new GameEngine({
    now: () => now,
    random: () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    },
  });
  const created = engine.create(capacity);
  const admin = created.session!;
  const players = created.snapshot!.admin!.invites.map(
    (invite) =>
      engine.join({
        code: admin.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `P${invite.slot}`,
      }).session!,
  );
  const command = (value: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `c-${event++}`, value);
  const action = (session: Session, value: Omit<GameAction, "eventId">) =>
    engine.action(session, { eventId: `a-${event++}`, ...value });
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  assert(command("assign").ok);
  const impostor = players.find(
    (s) => engine.snapshot(s)!.player!.role === "impostor",
  )!;
  const defenders = players.filter((s) => s.token !== impostor.token);
  const room = engine.rooms.get(admin.code)!;
  const internal = (s: Session) =>
    room.players.find((p) => p.token === s.token)!;
  const startIdentity = () => {
    assert(command("start").ok);
    advance(5_000);
    for (const seconds of [
      DEFAULT_SETTINGS.mailSeconds,
      DEFAULT_SETTINGS.ddosSeconds,
    ]) {
      advance(seconds * 1_000);
      assert(command("next").ok);
      assert(command("start").ok);
      advance(5_000);
    }
    assert.equal(room.phase, "identity");
  };
  return {
    engine,
    admin,
    players,
    impostor,
    defenders,
    room,
    command,
    action,
    advance,
    internal,
    startIdentity,
  };
}

const PRIVATE_KEYS = [
  "tier",
  "registry",
  "legit",
  "isEvent",
  "alteration",
  "synthetic",
  "advanced",
  "verifyReadyAt",
  "finding",
];

test("ningún snapshot filtra clasificación interna, expediente ni respuestas durante toda la ronda", () => {
  const f = setup(5);
  f.startIdentity();
  const answer = f.internal(f.impostor).identityChallenge!.answer;
  for (let step = 0; step < 250 && !f.room.roundFinished; step += 1) {
    for (const session of f.players) {
      const card = f.internal(session).card;
      if (card)
        f.action(session, {
          type: "identity:decide",
          cardId: card.id,
          accept: card.legit,
        });
    }
    f.advance(500);
    const publicJson = JSON.stringify(f.engine.snapshot(f.admin)!.public);
    for (const key of [...PRIVATE_KEYS, "identityChallenge", "dossier"])
      assert(!publicJson.includes(`"${key}"`), `público filtra ${key}`);
    for (const session of f.players) {
      const state = f.engine.snapshot(session)!.player!;
      const json = JSON.stringify({
        card: state.card,
        pending: state.pendingCards,
        debrief: state.identityDebrief,
      });
      for (const key of PRIVATE_KEYS)
        if (key !== "finding")
          assert(!json.includes(`"${key}"`), `jugador filtra ${key}`);
      if (session.token !== f.impostor.token)
        assert.equal(state.identityChallenge, undefined);
      else
        assert(!JSON.stringify(state.identityChallenge).includes(`"answer"`));
      if (!f.room.roundFinished) assert.equal(state.identityDebrief, undefined);
    }
  }
  assert(answer);
  assert.equal(f.room.roundFinished, true);
});

test("al terminar, cada jugador recibe una explicación de la llamada sin revelar roles", () => {
  const f = setup(6);
  f.startIdentity();
  f.advance(60_000);
  const [allow, block, expire, verify] = f.defenders;
  const find = (session: Session) => {
    const player = f.internal(session);
    return [player.card, ...player.pendingCards].find((c) => c?.isEvent);
  };
  const reach = (session: Session) => {
    for (let guard = 0; guard < 8; guard += 1) {
      const player = f.internal(session);
      if (player.card?.isEvent) return player.card;
      if (player.card)
        f.action(session, {
          type: "identity:decide",
          cardId: player.card.id,
          accept: player.card.legit,
        });
    }
    throw new Error("no llegó el comunicado");
  };
  for (const session of [allow, block, expire, verify]) assert(find(session));
  const a = reach(allow);
  const b = reach(block);
  const c = reach(expire);
  const d = reach(verify);
  assert(f.action(verify, { type: "identity:verify", cardId: d.id }).ok);
  f.advance(1_500);
  assert(
    f.action(allow, { type: "identity:decide", cardId: a.id, accept: true }).ok,
  );
  assert(
    f.action(block, { type: "identity:decide", cardId: b.id, accept: false })
      .ok,
  );
  assert(
    f.action(verify, { type: "identity:decide", cardId: d.id, accept: false })
      .ok,
  );
  c.expires = f.room.clock + 100;
  f.advance(200);
  assert.equal(f.engine.snapshot(allow)!.player!.identityDebrief, undefined);
  f.advance(120_000);
  assert.equal(f.room.roundFinished, true);
  const debrief = (s: Session) =>
    f.engine.snapshot(s)!.player!.identityDebrief!;
  assert.equal(debrief(allow).outcome, "allowed");
  assert.equal(debrief(block).outcome, "blocked");
  assert.equal(debrief(expire).outcome, "expired");
  assert.equal(debrief(verify).verified, true);
  assert(debrief(allow).finding);
  assert.equal(debrief(allow).verified, false);
  // Las llegadas tardías o no vistas no inventan un hallazgo.
  const unseen = debrief(f.impostor);
  assert(["allowed", "blocked", "expired", "unseen"].includes(unseen.outcome));
  assert.equal(
    JSON.stringify(f.engine.snapshot(f.admin)!.public).includes("finding"),
    false,
  );
  assert(f.command("next").ok);
  assert.equal(f.engine.snapshot(allow)!.player!.identityDebrief, undefined);
});

test("una tarjeta expirada no se puede verificar y no consume el uso", () => {
  const f = setup(3);
  f.startIdentity();
  const session = f.defenders[0];
  const player = f.internal(session);
  const card = player.card!;
  card.expires = f.room.clock;
  const result = f.action(session, {
    type: "identity:verify",
    cardId: card.id,
  });
  assert.equal(result.ok, false);
  assert.match(result.error!, /expir/);
  assert.equal(player.identityVerificationsRemaining, 2);
  assert.notEqual(player.card?.id, card.id);
});

test("el cierre conserva una tarjeta del comunicado vista y su consulta completada o pendiente", () => {
  for (const elapsed of [0, 1_500]) {
    const f = setup(6);
    f.startIdentity();
    f.advance(60_000);
    const [seen, queued] = f.defenders;
    const player = f.internal(seen);
    assert(!player.card?.isEvent);
    assert(
      f.action(seen, {
        type: "identity:decide",
        cardId: player.card!.id,
        accept: player.card!.legit,
      }).ok,
    );
    const card = player.card!;
    assert(card.isEvent);
    assert(f.action(seen, { type: "identity:verify", cardId: card.id }).ok);
    f.advance(elapsed);
    assert.equal(f.engine.snapshot(seen)!.player!.identityDebrief, undefined);
    assert(f.command("stop").ok);
    const debrief = f.engine.snapshot(seen)!.player!.identityDebrief!;
    assert.equal(debrief.outcome, "unanswered");
    assert.equal(debrief.verified, elapsed === 1_500);
    assert.equal(debrief.finding, card.finding);
    assert.equal(
      f.engine.snapshot(queued)!.player!.identityDebrief!.outcome,
      "unseen",
    );
    assert(
      !JSON.stringify(f.engine.snapshot(f.admin)!.public).includes("finding"),
    );
    assert(f.command("restart").ok);
    assert.equal(f.engine.snapshot(seen)!.player!.identityDebrief, undefined);
    assert.equal(player.identityEvent, undefined);
  }
});

test("una victoria anticipada registra el comunicado activo sin cambiar su decisión ni el marcador", () => {
  const f = setup(5);
  f.startIdentity();
  f.advance(60_000);
  const observer = f.impostor;
  const player = f.internal(observer);
  assert(
    f.action(observer, {
      type: "identity:decide",
      cardId: player.card!.id,
      accept: player.card!.legit,
    }).ok,
  );
  const event = player.card!;
  assert(event.isEvent);
  assert(f.action(observer, { type: "identity:verify", cardId: event.id }).ok);
  f.advance(1_500);
  for (const defender of f.defenders) {
    const target = f.internal(defender);
    const card = target.card!;
    target.infiltrations = 2;
    card.legit = false;
    assert(
      f.action(defender, {
        type: "identity:decide",
        cardId: card.id,
        accept: true,
      }).ok,
    );
    if (f.room.roundFinished) break;
  }
  assert(f.room.roundFinished);
  assert.equal(f.room.results.at(-1)!.winner, "impostor");
  assert.deepEqual(f.engine.snapshot(observer)!.player!.identityDebrief, {
    outcome: "unanswered",
    verified: true,
    finding: event.finding,
  });
  assert.equal(player.infiltrations, 0);
  assert.equal(player.card?.id, event.id);
});

test("verificar requiere margen antes de la expiración y del final de la misión", () => {
  for (const remaining of [2_999, 3_000]) {
    const f = setup(3);
    f.startIdentity();
    f.advance(DEFAULT_SETTINGS.identitySeconds * 1_000 - remaining);
    const session = f.defenders[0];
    const player = f.internal(session);
    const card = player.card!;
    card.expires = f.room.clock + 6_000;
    const result = f.action(session, {
      type: "identity:verify",
      cardId: card.id,
    });
    assert.equal(result.ok, remaining === 3_000);
    assert.equal(
      player.identityVerificationsRemaining,
      remaining === 3_000 ? 1 : 2,
    );
    if (result.ok) {
      f.advance(1_500);
      assert.equal(
        f.engine.snapshot(session)!.player!.card!.verification?.pending,
        false,
      );
      assert(
        f.action(session, {
          type: "identity:decide",
          cardId: card.id,
          accept: card.legit,
        }).ok,
      );
    }
  }
});

test("verificar al final de la ronda no deja estado colgado ni acepta más acciones", () => {
  const f = setup(3);
  f.startIdentity();
  f.advance(DEFAULT_SETTINGS.identitySeconds * 1000 - 5_000);
  const session = f.defenders[0];
  const player = f.internal(session);
  const card = player.card;
  if (card) {
    card.expires = f.room.clock + 4_000;
    assert(f.action(session, { type: "identity:verify", cardId: card.id }).ok);
  }
  f.advance(10_000);
  assert.equal(f.room.roundFinished, true);
  const state = f.engine.snapshot(session)!.player!;
  assert(state.card === null || typeof state.card.id === "string");
  assert.equal(
    f.action(session, { type: "identity:verify", cardId: card?.id ?? "x" }).ok,
    false,
  );
  assert.equal(
    f.action(session, {
      type: "identity:decide",
      cardId: card?.id ?? "x",
      accept: true,
    }).ok,
    false,
  );
});

test("inyectar una suplantación no altera la tarjeta activa ni su verificación en curso", () => {
  const f = setup(3);
  f.startIdentity();
  const internal = f.internal(f.impostor);
  assert(
    f.action(f.impostor, {
      type: "identity:challenge-solve",
      answer: internal.identityChallenge!.answer,
    }).ok,
  );
  f.advance(41_000);
  for (const defender of f.defenders) {
    const player = f.internal(defender);
    if (!player.card) continue;
    player.card.expires = f.room.clock + 9_000;
    f.action(defender, { type: "identity:verify", cardId: player.card.id });
  }
  const before = f.defenders.map((d) => {
    const card = f.internal(d).card;
    return card && [card.id, card.verifyReadyAt, card.expires];
  });
  assert(f.action(f.impostor, { type: "identity:send-advanced" }).ok);
  const after = f.defenders.map((d) => {
    const card = f.internal(d).card;
    return card && [card.id, card.verifyReadyAt, card.expires];
  });
  assert.deepEqual(after, before);
  for (const defender of f.defenders)
    assert(f.internal(defender).pendingCards.length <= 2);
});

test("cuando el impostor acepta la tarjeta avanzada no hay infiltración ni alerta pública", () => {
  const f = setup(3);
  f.startIdentity();
  f.advance(60_000);
  const player = f.internal(f.impostor);
  for (let guard = 0; guard < 8 && !player.card?.isEvent; guard += 1)
    if (player.card)
      f.action(f.impostor, {
        type: "identity:decide",
        cardId: player.card.id,
        accept: player.card.legit,
      });
  assert(player.card?.isEvent);
  assert(
    f.action(f.impostor, {
      type: "identity:decide",
      cardId: player.card!.id,
      accept: true,
    }).ok,
  );
  assert.equal(player.infiltrations, 0);
  assert.equal(f.room.identityAlertPending, false);
});

test("el registro incluye al titular para contrastar nombre y empleado", () => {
  const f = setup(3);
  f.startIdentity();
  const session = f.defenders[0];
  const card = f.internal(session).card!;
  assert(f.action(session, { type: "identity:verify", cardId: card.id }).ok);
  f.advance(1_500);
  const heading =
    f.engine.snapshot(session)!.player!.card!.verification!.heading!;
  assert(heading.includes(card.reference.employeeId!));
  assert(heading.includes(card.reference.name!));
});

test("reincorporarse durante una consulta conserva el uso y espera a la siguiente misión", () => {
  const f = setup(4);
  f.startIdentity();
  const session = f.defenders[0];
  const player = f.internal(session);
  f.engine.bind(session, "identity-before-disconnect");
  const card = player.card!;
  assert(f.action(session, { type: "identity:verify", cardId: card.id }).ok);
  f.advance(500);
  f.engine.unbind("identity-before-disconnect");
  f.engine.bind(session, "identity-after-disconnect");
  const returned = f.engine.resume(session);
  assert(returned.ok);
  assert(returned.snapshot!.player!.waitingForNextRound);
  assert.equal(returned.snapshot!.player!.card, null);
  assert.equal(player.identityVerificationsRemaining, 1);
  assert.equal(player.card!.verifyReadyAt, card.verifyReadyAt);
  assert.equal(
    f.action(session, {
      type: "identity:decide",
      cardId: card.id,
      accept: true,
    }).ok,
    false,
  );
  assert(f.command("stop").ok);
  assert(f.command("next").ok);
  assert.equal(
    f.engine.snapshot(session)!.player!.waitingForNextRound,
    undefined,
  );
  assert.equal(player.card, null);
  assert.equal(player.identityEvent, undefined);
  assert.equal(player.identityVerificationsRemaining, 2);
});

test("deduplicar expediente y envío avanzado no crea capacidades ni tarjetas adicionales", () => {
  const f = setup(4);
  f.startIdentity();
  const challenge = f.internal(f.impostor).identityChallenge!;
  const solve = {
    eventId: "dossier-replay",
    type: "identity:challenge-solve" as const,
    answer: challenge.answer,
  };
  assert(f.engine.action(f.impostor, solve).ok);
  assert(f.engine.action(f.impostor, solve).ok);
  assert.equal(
    f.room.logs.filter((log) => log.type === "identity_challenge_solved")
      .length,
    1,
  );
  f.advance(40_000);
  const send = {
    eventId: "advanced-replay",
    type: "identity:send-advanced" as const,
  };
  assert(f.engine.action(f.impostor, send).ok);
  assert(f.engine.action(f.impostor, send).ok);
  const injected = f.room.players
    .flatMap((p) => p.pendingCards)
    .filter((c) => c.tier === "advanced" && c.source === "player");
  assert.equal(injected.length, 1);
  assert(f.room.players.every((p) => p.pendingCards.length <= 2));
  assert(challenge.advancedUsed);
  assert(!challenge.advancedAvailable);
});
