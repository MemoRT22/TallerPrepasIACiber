import test from "node:test";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { GameEngine } from "../server/engine.js";
import { createApp } from "../server/index.js";
import type { Ack, Session, Snapshot } from "../shared/types.js";

const ADMIN_KEY = "qr-test-admin-key";

function engineFixture(capacity: 3 | 4 | 5 | 6, autoStart = true) {
  let now = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0 });
  const created = engine.create(capacity, autoStart);
  assert(created.ok && created.session && created.snapshot?.admin);
  const admin = created.session;
  engine.bind(admin, "admin-socket");
  const players: Session[] = [];
  for (const invite of created.snapshot.admin.invites) {
    const joined = engine.join({
      code: admin.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `QR ${capacity}-${invite.slot}`,
    });
    assert(joined.ok && joined.session);
    players.push(joined.session);
    engine.bind(joined.session, `player-${invite.slot}`);
  }
  return {
    engine,
    admin,
    players,
    invites: created.snapshot.admin.invites,
    advance(ms: number) {
      now += ms;
      engine.tick();
    },
    now: () => now,
  };
}

function publicState(engine: GameEngine, session: Session) {
  const snapshot = engine.snapshot(session);
  assert(snapshot);
  return snapshot.public;
}

async function connect(url: string): Promise<Socket> {
  const socket = io(url, { transports: ["websocket"], reconnection: false });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}

async function emit(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<Ack> {
  return (await socket.timeout(3_000).emitWithAck(event, payload)) as Ack;
}

test("autoarranca una sola vez al completar exactamente cada cupo 3–6", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const fixture = engineFixture(capacity);
    const state = publicState(fixture.engine, fixture.admin);
    assert.equal(state.phase, "mail");
    assert.equal(state.assigned, true);
    assert.equal(state.stage, "briefing");
    assert.equal(state.running, true);
    assert.equal(state.autoStart, true);
    assert.equal(state.briefingRemaining, 20);
    const roles = fixture.players.map(
      (session) => fixture.engine.snapshot(session)?.player?.role,
    );
    assert.equal(roles.filter((role) => role === "impostor").length, 1);
    const serialized = JSON.stringify(state);
    assert(!serialized.includes("role"));
    assert(!serialized.includes("token"));
    assert(!serialized.includes("node"));
    fixture.advance(20_000);
    assert.equal(publicState(fixture.engine, fixture.admin).stage, "countdown");
    fixture.advance(5_000);
    assert.equal(publicState(fixture.engine, fixture.admin).stage, "playing");
    fixture.advance(10_000);
    assert.equal(publicState(fixture.engine, fixture.admin).stage, "playing");
  }
});

test("un cupo de seis no arranca con solo tres puestos vinculados", () => {
  let now = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0 });
  const created = engine.create(6, true);
  assert(created.session && created.snapshot?.admin);
  const admin = created.session;
  engine.bind(admin, "admin");
  for (const invite of created.snapshot.admin.invites.slice(0, 3)) {
    const joined = engine.join({
      code: admin.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `Parcial ${invite.slot}`,
    });
    assert(joined.session);
    engine.bind(joined.session, `partial-${invite.slot}`);
  }
  now = 60_000;
  engine.tick();
  const state = publicState(engine, admin);
  assert.equal(state.phase, "lobby");
  assert.equal(state.stage, "waiting");
  assert.equal(state.assigned, false);
  assert.equal(state.connectedCount, 3);
  assert.equal(state.autoStart, true);
});

test("la ausencia del administrador impide el disparo y su reconexión lo habilita", () => {
  let now = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0 });
  const created = engine.create(3, true);
  assert(created.session && created.snapshot?.admin);
  const admin = created.session;
  engine.bind(admin, "admin-old");
  const sessions: Session[] = [];
  for (const [index, invite] of created.snapshot.admin.invites.entries()) {
    if (index === created.snapshot.admin.invites.length - 1)
      engine.unbind("admin-old");
    const joined = engine.join({
      code: admin.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `Sin docente ${invite.slot}`,
    });
    assert(joined.session);
    sessions.push(joined.session);
    engine.bind(joined.session, `student-${invite.slot}`);
  }
  now = 30_000;
  engine.tick();
  assert.equal(publicState(engine, admin).assigned, false);
  engine.bind(admin, "admin-new");
  assert.equal(publicState(engine, admin).assigned, true);
  assert.equal(engine.snapshot(sessions[0])?.player?.role, "impostor");
});

test("las salas manuales siguen requiriendo assign y start docentes", () => {
  const fixture = engineFixture(3, false);
  let state = publicState(fixture.engine, fixture.admin);
  assert.equal(state.assigned, false);
  assert.equal(state.autoStart, undefined);
  assert.equal(
    fixture.engine.admin(fixture.admin, "manual-assign", "assign").ok,
    true,
  );
  assert.equal(
    fixture.engine.admin(fixture.admin, "manual-start", "start").ok,
    true,
  );
  state = publicState(fixture.engine, fixture.admin);
  assert.equal(state.stage, "countdown");
  assert.equal(state.briefingRemaining, undefined);
});

test("briefing y countdown automáticos congelan tiempo con pause/resume", () => {
  const fixture = engineFixture(3);
  fixture.advance(7_000);
  assert.equal(
    publicState(fixture.engine, fixture.admin).briefingRemaining,
    13,
  );
  assert.equal(
    fixture.engine.admin(fixture.admin, "pause-briefing", "pause").ok,
    true,
  );
  fixture.advance(60_000);
  assert.equal(
    publicState(fixture.engine, fixture.admin).briefingRemaining,
    13,
  );
  assert.equal(
    fixture.engine.admin(fixture.admin, "resume-briefing", "resume").ok,
    true,
  );
  fixture.advance(13_000);
  assert.equal(publicState(fixture.engine, fixture.admin).stage, "countdown");
  assert.equal(publicState(fixture.engine, fixture.admin).countdown, 5);
  fixture.advance(60_000);
  assert.equal(publicState(fixture.engine, fixture.admin).stage, "playing");
});

test("la desconexión de un jugador no pausa briefing ni countdown y bloquea su ronda", () => {
  const fixture = engineFixture(3);
  fixture.advance(5_000);
  fixture.engine.unbind("player-1");
  const disconnected = publicState(fixture.engine, fixture.admin);
  assert.equal(disconnected.paused, false);
  assert.equal(disconnected.briefingRemaining, 15);
  fixture.advance(15_000);
  assert.equal(publicState(fixture.engine, fixture.admin).stage, "countdown");
  fixture.advance(5_000);
  assert.equal(publicState(fixture.engine, fixture.admin).stage, "playing");

  const resumed = fixture.engine.resume(fixture.players[0]);
  assert(resumed.ok && resumed.snapshot?.player);
  assert.equal(resumed.snapshot.player.waitingForNextRound, true);
  assert.equal(resumed.snapshot.player.mail.length, 0);
  assert.equal(resumed.snapshot.player.traffic.length, 0);
  assert.equal(
    fixture.engine.action(fixture.players[0], {
      eventId: "forged-while-waiting",
      type: "mail:classify",
      cardId: "forged",
      accept: true,
    }).ok,
    false,
  );
});

test("la desconexión del administrador sí pausa briefing automático sin exigir jugadores", () => {
  const fixture = engineFixture(3);
  fixture.advance(5_000);
  fixture.engine.unbind("player-1");
  fixture.engine.unbind("admin-socket");
  const paused = publicState(fixture.engine, fixture.admin);
  assert.equal(paused.paused, true);
  assert.equal(paused.briefingRemaining, 15);
  fixture.advance(60_000);
  assert.equal(
    publicState(fixture.engine, fixture.admin).briefingRemaining,
    15,
  );
  fixture.engine.bind(fixture.admin, "admin-new");
  assert.equal(
    fixture.engine.admin(
      fixture.admin,
      "resume-after-admin-reconnect",
      "resume",
    ).ok,
    true,
  );
  assert.equal(publicState(fixture.engine, fixture.admin).paused, false);
});

test("transporte real limita autoStart a creación autenticada y entrega rol solo en ACK privado", async () => {
  const bundle = await createApp({
    env: "production",
    root: process.cwd(),
    adminKey: ADMIN_KEY,
  });
  await new Promise<void>((resolve) =>
    bundle.server.listen(0, "127.0.0.1", resolve),
  );
  const address = bundle.server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}`;
  const sockets: Socket[] = [];
  try {
    const unauthenticated = await connect(url);
    sockets.push(unauthenticated);
    assert.equal(
      (await emit(unauthenticated, "create", { capacity: 3, autoStart: true }))
        .ok,
      false,
    );

    const adminSocket = await connect(url);
    sockets.push(adminSocket);
    const created = await emit(adminSocket, "create", {
      capacity: 3,
      autoStart: true,
      adminKey: ADMIN_KEY,
    });
    assert(created.ok && created.session && created.snapshot?.admin);
    assert.equal(created.snapshot.public.autoStart, true);
    const code = created.session.code;

    const monitor = await connect(url);
    sockets.push(monitor);
    const watched = await emit(monitor, "watch", { code });
    assert(watched.ok && watched.snapshot);
    assert.equal(watched.snapshot.public.autoStart, true);

    let finalJoin: Ack | undefined;
    for (const invite of created.snapshot.admin.invites) {
      const playerSocket = await connect(url);
      sockets.push(playerSocket);
      finalJoin = await emit(playerSocket, "join", {
        code,
        slot: invite.slot,
        invite: invite.invite,
        name: `Socket ${invite.slot}`,
      });
    }
    assert(finalJoin?.ok && finalJoin.snapshot?.player);
    assert(
      finalJoin.snapshot.player.role === "impostor" ||
        finalJoin.snapshot.player.role === "defender",
    );
    assert.equal(finalJoin.snapshot.public.assigned, true);
    assert(!JSON.stringify(finalJoin.snapshot.public).includes("role"));
    assert(!JSON.stringify(finalJoin.snapshot.public).includes("token"));

    const manual = await emit(adminSocket, "admin", {
      eventId: "manual-before-next-group",
      command: "auto-start",
    });
    assert.equal(manual.ok, false);
  } finally {
    for (const socket of sockets) socket.disconnect();
    await bundle.close();
  }
});

test("un socket ajeno o reemplazado no pausa la sala de incorporación", () => {
  const fixture = engineFixture(3);
  fixture.advance(3000);
  fixture.engine.unbind("public-monitor-unbound");
  assert.equal(publicState(fixture.engine, fixture.admin).paused, false);
  fixture.engine.bind(fixture.players[0], "replacement-player-1");
  fixture.engine.unbind("player-1");
  assert.equal(publicState(fixture.engine, fixture.admin).paused, false);
  fixture.advance(17000);
  assert.equal(publicState(fixture.engine, fixture.admin).stage, "countdown");
  fixture.engine.unbind("socket-de-otra-sala");
  assert.equal(publicState(fixture.engine, fixture.admin).paused, false);
  fixture.advance(5000);
  assert.equal(publicState(fixture.engine, fixture.admin).stage, "playing");
});

test("desconectar un participante de otra sala no pausa el briefing automático", () => {
  let now = 0;
  let random = 0;
  const engine = new GameEngine({ now: () => now, random: () => random });
  const first = engine.create(3, true);
  assert(first.session && first.snapshot?.admin);
  engine.bind(first.session, "first-admin");
  for (const invite of first.snapshot.admin.invites) {
    const joined = engine.join({
      code: first.session.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `EquipoA ${invite.slot}`,
    });
    assert(joined.session);
    engine.bind(joined.session, `first-${invite.slot}`);
  }
  random = 0.5;
  const second = engine.create(3, false);
  assert(second.session && second.snapshot?.admin);
  engine.bind(second.session, "second-admin");
  const invite = second.snapshot.admin.invites[0];
  const joined = engine.join({
    code: second.session.code,
    slot: invite.slot,
    invite: invite.invite,
    name: "Equipo B",
  });
  assert(joined.session);
  engine.bind(joined.session, "second-player");
  now = 4000;
  engine.tick();
  engine.unbind("second-player");
  const state = publicState(engine, first.session);
  assert.equal(state.paused, false);
  assert.equal(state.briefingRemaining, 16);
  engine.unbind("second-admin");
  assert.equal(publicState(engine, first.session).paused, false);
});
