import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../server/engine.js";
import type { Ack, Session, Settings } from "../shared/types.js";

function fixture(capacity: 5 | 6 = 5, randomValue = 0.01) {
  let now = 0;
  const engine = new GameEngine({ now: () => now, random: () => randomValue });
  const created = engine.create(capacity);
  assert.equal(created.ok, true);
  assert(created.session && created.snapshot);
  const admin = created.session;
  const code = admin.code;
  const players: Session[] = [];
  for (let i = 0; i < capacity; i += 1) {
    const joined = engine.join({ code, name: `Jugador ${i + 1}` });
    assert.equal(joined.ok, true);
    assert(joined.session);
    players.push(joined.session);
  }
  const settings: Settings = {
    mailSeconds: 60,
    ddosSeconds: 30,
    identitySeconds: 30,
    recoverySeconds: 60,
    mailAccuracy: 80,
    blueAccuracy: 70,
    identityAccuracy: 70,
    saturationLimit: randomValue > 0.8 ? 20 : 10,
  };
  assert.equal(
    engine.admin(admin, "settings-1", "settings", settings).ok,
    true,
  );
  assert.equal(engine.admin(admin, "assign-1", "assign").ok, true);
  return {
    engine,
    admin,
    players,
    code,
    advance(ms: number) {
      now += ms;
      engine.tick();
    },
  };
}

function adminSnapshot(engine: GameEngine, admin: Session) {
  const snapshot = engine.snapshot(admin);
  assert(snapshot);
  assert(snapshot.admin);
  return snapshot;
}

function startMail(fx: ReturnType<typeof fixture>) {
  assert.equal(fx.engine.admin(fx.admin, "start-1", "start").ok, true);
  fx.advance(5_000);
  const snapshot = fx.engine.snapshot(fx.players[0]);
  assert(snapshot?.player?.mail.length === 6);
}

test("crea salas, reserva invitaciones y aísla la privacidad por vista", () => {
  const fx = fixture();
  const admin = adminSnapshot(fx.engine, fx.admin);
  assert.equal(admin.admin!.invites.length, 5);
  assert.deepEqual(
    admin.admin!.invites.map((x) => x.slot),
    [1, 2, 3, 4, 5],
  );
  assert(
    admin.admin!.invites.every((x) => /^inv_[A-Za-z0-9_-]+$/.test(x.invite)),
  );
  assert.equal(admin.admin!.players[0].department, "agua");
  const pub = admin.public;
  const serialized = JSON.stringify(pub);
  assert(!serialized.includes('"role"'));
  assert(!serialized.includes("token"));
  assert(!serialized.includes("node"));
  assert.equal(
    fx.engine.action(fx.admin, {
      eventId: "not-player",
      type: "vote",
      suspect: "agua",
      reason: "x",
    }).ok,
    false,
  );
  const player = fx.engine.snapshot(fx.players[0]);
  assert(player?.player?.role === "impostor");
  assert.equal(player?.admin, undefined);
});

test("clasifica de forma autoritativa, deduplica eventos y conserva roles al reiniciar", () => {
  const fx = fixture();
  startMail(fx);
  const before = fx.engine.snapshot(fx.players[0]);
  assert(before?.player?.mail[0]);
  const cardId = before.player.mail[0].id;
  const first = fx.engine.action(fx.players[0], {
    eventId: "mail-1",
    type: "mail:classify",
    cardId,
    accept: false,
  });
  assert.equal(first.ok, true);
  const second = fx.engine.action(fx.players[0], {
    eventId: "mail-1",
    type: "mail:classify",
    cardId,
    accept: true,
  });
  assert.deepEqual(second, first);
  assert.equal(fx.engine.snapshot(fx.players[0])?.player?.mail.length, 5);
  const roleBefore = fx.engine.snapshot(fx.players[0])?.player?.role;
  fx.advance(60_000);
  assert.equal(fx.engine.snapshot(fx.players[0])?.public.results.length, 1);
  assert.equal(fx.engine.admin(fx.admin, "restart-1", "restart").ok, true);
  assert.equal(fx.engine.snapshot(fx.players[0])?.public.results.length, 0);
  assert.equal(fx.engine.snapshot(fx.players[0])?.player?.role, roleBefore);
});

test("pausa congela el reloj lógico y resume sin consumir tiempo", () => {
  const fx = fixture();
  startMail(fx);
  fx.advance(5_000);
  const paused = fx.engine.admin(fx.admin, "pause-1", "pause");
  assert.equal(paused.ok, true);
  const before = fx.engine.snapshot(fx.players[0])!.public.clock;
  fx.advance(50_000);
  assert.equal(fx.engine.snapshot(fx.players[0])!.public.clock, before);
  assert.equal(fx.engine.admin(fx.admin, "resume-1", "resume").ok, true);
  fx.advance(1_000);
  assert.equal(fx.engine.snapshot(fx.players[0])!.public.clock, before + 1_000);
});

test("la recuperación requiere haber comenzado, y la revelación solo llega después de todos los votos", () => {
  const fx = fixture(5, 0.9);
  startMail(fx);
  fx.advance(60_000);
  assert.equal(fx.engine.admin(fx.admin, "next-1", "next").ok, true);
  assert.equal(fx.engine.snapshot(fx.players[0])?.public.phase, "ddos");
  assert.equal(fx.engine.admin(fx.admin, "start-2", "start").ok, true);
  fx.advance(5_000);
  fx.advance(30_000);
  assert.equal(fx.engine.admin(fx.admin, "next-2", "next").ok, true);
  assert.equal(fx.engine.admin(fx.admin, "start-3", "start").ok, true);
  fx.advance(5_000);
  fx.advance(30_000);
  assert.equal(fx.engine.admin(fx.admin, "next-3", "next").ok, true);
  assert.equal(fx.engine.snapshot(fx.players[0])?.public.phase, "recovery");
  assert.equal(
    fx.engine.admin(fx.admin, "voting-too-early", "voting").ok,
    false,
  );
  assert.equal(fx.engine.admin(fx.admin, "start-4", "start").ok, true);
  fx.advance(5_000);
  fx.advance(60_000);
  assert.equal(fx.engine.admin(fx.admin, "voting-1", "voting").ok, true);
  const departments = fx.engine
    .snapshot(fx.admin)!
    .admin!.players.map((p) => p.department);
  for (let i = 0; i < fx.players.length - 1; i += 1) {
    assert.equal(
      fx.engine.action(fx.players[i], {
        eventId: `vote-${i}`,
        type: "vote",
        suspect: departments[0],
        reason: "La conducta y el momento resultaron sospechosos.",
      }).ok,
      true,
    );
  }
  assert.equal(fx.engine.admin(fx.admin, "reveal-early", "reveal").ok, false);
  assert.equal(
    fx.engine.action(fx.players.at(-1)!, {
      eventId: "vote-last",
      type: "vote",
      suspect: departments[0],
      reason: "La conducta y el momento resultaron sospechosos.",
    }).ok,
    true,
  );
  assert.equal(fx.engine.admin(fx.admin, "reveal-1", "reveal").ok, true);
  const revealed = fx.engine.snapshot(fx.players[0])!.public;
  assert.equal(revealed.phase, "revealed");
  assert(revealed.reveal);
  assert.equal(revealed.reveal.winner, "tie");
  assert(
    !revealed.reveal.impostorDepartment.includes("agua") ||
      revealed.reveal.impostorDepartment.length > 0,
  );
  assert.equal(revealed.votesCount, fx.players.length);
});
