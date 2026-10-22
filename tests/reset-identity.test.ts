import test from "node:test";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { GameEngine } from "../server/engine.js";
import { createApp } from "../server/index.js";
import {
  DEFAULT_SETTINGS,
  type Ack,
  type Session,
  type Snapshot,
} from "../shared/types.js";

function fixture(capacity: 3 | 4 | 5 | 6 = 6) {
  let now = 0;
  const engine = new GameEngine({ now: () => now });
  const created = engine.create(capacity);
  assert(created.session && created.snapshot?.admin);
  const admin = created.session;
  const invites = created.snapshot.admin.invites;
  const players = invites.map((invite) => {
    const joined = engine.join({
      code: admin.code,
      name: `Participante ${invite.slot}`,
      slot: invite.slot,
      invite: invite.invite,
    });
    assert(joined.session);
    return joined.session;
  });
  return {
    engine,
    admin,
    players,
    invites,
    advance: (ms: number) => {
      now += ms;
      engine.tick();
    },
  };
}

test("reinicio total revoca todas las terminales, conserva accesos y prepara una sala limpia", () => {
  const f = fixture();
  assert(
    f.engine.admin(f.admin, "settings", "settings", {
      ...DEFAULT_SETTINGS,
      mailSeconds: 120,
    }).ok,
  );
  assert(f.engine.admin(f.admin, "assign", "assign").ok);
  assert(f.engine.admin(f.admin, "start", "start").ok);
  f.advance(5000);
  assert(f.engine.admin(f.admin, "stop", "stop").ok);
  const room = f.engine.rooms.get(f.admin.code)!;
  const oldNonce = room.roundNonce;
  room.scores = { defenders: 2, impostor: 1 };
  room.recoveryCompleted = 1;
  room.votesOpen = true;
  room.players[0].connected = false;
  const other = f.engine.create(3);
  assert(other.session);
  const otherBefore = f.engine.snapshot(other.session);
  assert.equal(f.engine.admin(f.players[0], "forged", "reset-all").ok, false);
  const reset = f.engine.admin(f.admin, "reset-event", "reset-all");
  assert(reset.ok && reset.snapshot?.admin);
  const state = reset.snapshot.public;
  assert.equal(state.code, f.admin.code);
  assert.equal(state.capacity, 6);
  assert.equal(state.phase, "lobby");
  assert.equal(state.stage, "waiting");
  assert.equal(state.playersCount, 0);
  assert.equal(state.connectedCount, 0);
  assert.equal(state.assigned, false);
  assert.equal(state.clock, 0);
  assert.equal(state.running, false);
  assert.equal(state.paused, false);
  assert.equal(state.countdown, 0);
  assert.deepEqual(state.results, []);
  assert.deepEqual(state.scores, { defenders: 0, impostor: 0 });
  assert.equal(state.reveal, undefined);
  assert.equal(state.recovery.completed, 0);
  assert.equal(state.votesCount, 0);
  assert.equal(state.settings.mailSeconds, 120);
  assert.notEqual(state.roundId, oldNonce);
  assert(
    state.departments.every((d) => d.status === "operational" && !d.occupied),
  );
  assert.deepEqual(reset.snapshot.admin.players, []);
  assert.deepEqual(reset.snapshot.admin.invites, f.invites);
  assert.equal(room.logs.length, 0);
  assert.equal(room.votesOpen, false);
  for (const player of f.players) {
    assert.equal(f.engine.resume(player).ok, false);
    assert.equal(f.engine.snapshot(player), null);
    assert.equal(
      f.engine.action(player, {
        eventId: "stale",
        type: "vote",
        suspect: "agua",
        reason: "Viejo",
      }).ok,
      false,
    );
  }
  assert.deepEqual(f.engine.snapshot(other.session), otherBefore);
  const joined = f.engine.join({
    code: f.admin.code,
    name: "Nuevo grupo",
    slot: 1,
    invite: f.invites[0].invite,
  });
  assert(joined.ok && joined.session);
  assert.notEqual(joined.session.token, f.players[0].token);
  const duplicate = f.engine.admin(f.admin, "reset-event", "reset-all");
  assert(duplicate.ok);
  assert.equal(duplicate.snapshot?.public.playersCount, 1);
  assert(f.engine.resume(joined.session).ok);
  assert.equal(f.engine.admin(f.admin, "assign-too-few", "assign").ok, false);
});

test("las credenciales de cada terminal avanzan y mezclan las tres alteraciones observables", () => {
  const f = fixture();
  assert(f.engine.admin(f.admin, "assign", "assign").ok);
  assert(f.engine.admin(f.admin, "start", "start").ok);
  assert(f.engine.admin(f.admin, "stop-mail", "stop").ok);
  assert(f.engine.admin(f.admin, "next-ddos", "next").ok);
  assert(f.engine.admin(f.admin, "stop-ddos", "stop").ok);
  assert(f.engine.admin(f.admin, "next-identity", "next").ok);
  assert(f.engine.admin(f.admin, "start-identity", "start").ok);
  f.advance(5000);
  for (const session of f.players) {
    const seen = new Set<string>();
    const alterations = new Set<string>();
    let previous = "";
    let legitimate = 0,
      falseCards = 0;
    for (let i = 0; i < 18; i++) {
      const p = f.engine.rooms
        .get(f.admin.code)!
        .players.find((p) => p.token === session.token)!;
      const card = p.card;
      assert(card);
      assert(!seen.has(card.id));
      seen.add(card.id);
      const signature = JSON.stringify(card.reference);
      assert.notEqual(signature, previous);
      previous = signature;
      const different = (
        Object.keys(card.reference) as Array<keyof typeof card.reference>
      ).filter((k) => card.reference[k] !== card.presented[k]);
      if (card.legit) {
        legitimate++;
        assert.deepEqual(different, []);
      } else {
        falseCards++;
        assert.equal(different.length, 1);
        alterations.add(different[0]);
      }
      const snapshot = f.engine.snapshot(session)!;
      assert.deepEqual(snapshot.player?.card?.presented, card.presented);
      assert(!JSON.stringify(snapshot.player?.card).includes('"legit"'));
      const decision = f.engine.action(session, {
        eventId: `compare-${session.slot}-${i}`,
        type: "identity:decide",
        cardId: card.id,
        accept: card.legit,
      });
      assert(decision.ok);
      assert.notEqual(decision.snapshot?.player?.card?.id, card.id);
    }
    assert.equal(legitimate, 12);
    assert.equal(falseCards, 6);
    assert.deepEqual([...alterations].sort(), ["avatar", "code", "symbol"]);
  }
});

async function connect(url: string): Promise<Socket> {
  const s = io(url, { transports: ["websocket"], reconnection: false });
  await new Promise<void>((resolve, reject) => {
    s.once("connect", () => resolve());
    s.once("connect_error", reject);
  });
  return s;
}
async function emit(s: Socket, event: string, payload: unknown): Promise<Ack> {
  return (await s.timeout(3000).emitWithAck(event, payload)) as Ack;
}

test("Socket.io expulsa jugadores y mantiene administrador y monitor listos para un grupo nuevo", async () => {
  const bundle = await createApp({
    env: "production",
    adminKey: "reset-test-key",
    root: process.cwd(),
  });
  await new Promise<void>((resolve) =>
    bundle.server.listen(0, "127.0.0.1", resolve),
  );
  const address = bundle.server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}`;
  const sockets: Socket[] = [];
  try {
    const admin = await connect(url);
    sockets.push(admin);
    const created = await emit(admin, "create", {
      capacity: 3,
      adminKey: "reset-test-key",
    });
    assert(created.session && created.snapshot?.admin);
    const code = created.session.code;
    const playerSessions: Session[] = [];
    const players: Socket[] = [];
    for (const invite of created.snapshot.admin.invites) {
      const p = await connect(url);
      sockets.push(p);
      players.push(p);
      const joined = await emit(p, "join", {
        code,
        name: `Anterior ${invite.slot}`,
        slot: invite.slot,
        invite: invite.invite,
      });
      assert(joined.session);
      playerSessions.push(joined.session);
    }
    const monitor = await connect(url);
    sockets.push(monitor);
    assert((await emit(monitor, "watch", { code })).ok);
    assert.equal(
      (
        await emit(players[0], "admin", {
          command: "reset-all",
          eventId: "unauthorized",
        })
      ).ok,
      false,
    );
    const ended = players.map(
      (p) =>
        new Promise<{ code: string; reason: string }>((resolve) =>
          p.once("session:ended", resolve),
        ),
    );
    const disconnected = players.map(
      (p) =>
        new Promise<void>((resolve) => p.once("disconnect", () => resolve())),
    );
    const emptyState = new Promise<Snapshot>((resolve) =>
      monitor.on("state", (s) => {
        if (s.public.playersCount === 0) resolve(s);
      }),
    );
    const ack = await emit(admin, "admin", {
      command: "reset-all",
      eventId: "complete-reset",
    });
    assert(ack.ok);
    const events = await Promise.all(ended);
    await Promise.all(disconnected);
    for (const event of events)
      assert.deepEqual(event, { code, reason: "activity_reset" });
    const publicState = await emptyState;
    assert.equal(publicState.public.phase, "lobby");
    assert.equal(publicState.player, undefined);
    assert.equal(publicState.admin, undefined);
    assert(admin.connected && monitor.connected);
    const newcomer = await connect(url);
    sockets.push(newcomer);
    const revoked = await emit(newcomer, "resume", playerSessions[0]);
    assert.equal(revoked.ok, false);
    assert.equal(revoked.errorCode, "session_revoked");
    const invite = created.snapshot.admin.invites[0];
    const newJoin = await emit(newcomer, "join", {
      code,
      name: "Nuevo participante",
      slot: invite.slot,
      invite: invite.invite,
    });
    assert(newJoin.ok && newJoin.session);
    assert.notEqual(newJoin.session.token, playerSessions[0].token);
    const dedup = await emit(admin, "admin", {
      command: "reset-all",
      eventId: "complete-reset",
    });
    assert.equal(dedup.snapshot?.public.playersCount, 1);
    assert(newcomer.connected);
    assert.equal(bundle.engine.rooms.get(code)!.players.length, 1);
  } finally {
    for (const s of sockets) s.disconnect();
    await bundle.close();
  }
});

test("los comandos de un grupo anterior no bloquean al siguiente y los resets antiguos siguen idempotentes", () => {
  const f = fixture(3);
  assert(f.engine.admin(f.admin, "assign-shared", "assign").ok);
  assert(f.engine.admin(f.admin, "reset-first", "reset-all").ok);
  for (const invite of f.invites)
    assert(
      f.engine.join({
        code: f.admin.code,
        name: `Segundo ${invite.slot}`,
        slot: invite.slot,
        invite: invite.invite,
      }).ok,
    );
  const assigned = f.engine.admin(f.admin, "assign-shared", "assign");
  assert(assigned.ok);
  assert.equal(assigned.snapshot?.public.assigned, true);
  assert(f.engine.admin(f.admin, "reset-second", "reset-all").ok);
  const joined = f.engine.join({
    code: f.admin.code,
    name: "Tercero",
    slot: 1,
    invite: f.invites[0].invite,
  });
  assert(joined.ok);
  const replay = f.engine.admin(f.admin, "reset-first", "reset-all");
  assert(replay.ok);
  assert.equal(replay.snapshot?.public.playersCount, 1);
  const room = f.engine.rooms.get(f.admin.code)!;
  assert.equal(room.dedup.get(f.admin.token)?.has("assign-shared"), false);
});
