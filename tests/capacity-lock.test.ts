import test from "node:test";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { GameEngine } from "../server/engine.js";
import { createApp } from "../server/index.js";
import type { Ack, Session, Settings } from "../shared/types.js";

const SETTINGS: Settings = {
  mailSeconds: 60,
  ddosSeconds: 30,
  identitySeconds: 30,
  recoverySeconds: 60,
  mailAccuracy: 80,
  blueAccuracy: 70,
  identityAccuracy: 70,
  saturationLimit: 10,
};

type Capacity = 3 | 4 | 5 | 6;

type Fixture = {
  engine: GameEngine;
  admin: Session;
  players: Session[];
  now: { value: number };
  advance: (ms: number) => void;
};

function lobby(capacity: Capacity = 3): Fixture {
  const now = { value: 0 };
  const engine = new GameEngine({ now: () => now.value, random: () => 0 });
  const created = engine.create(capacity);
  assert(created.ok && created.session && created.snapshot?.admin);
  return {
    engine,
    admin: created.session,
    players: [],
    now,
    advance(ms) {
      now.value += ms;
      engine.tick();
    },
  };
}

function join(fixture: Fixture, slots: number[]): void {
  const adminSnapshot = fixture.engine.snapshot(fixture.admin);
  assert(adminSnapshot?.admin);
  for (const slot of slots) {
    const invite = adminSnapshot.admin.invites.find((item) => item.slot === slot);
    assert(invite);
    const joined = fixture.engine.join({
      code: fixture.admin.code,
      slot,
      invite: invite.invite,
      name: `Capacidad ${slot}`,
    });
    assert(joined.ok && joined.session);
    fixture.players.push(joined.session);
  }
}

function startAllRounds(fixture: Fixture): void {
  assert.equal(
    fixture.engine.admin(fixture.admin, "capacity-settings", "settings", SETTINGS)
      .ok,
    true,
  );
  assert.equal(fixture.engine.admin(fixture.admin, "assign", "assign").ok, true);
  assert.equal(fixture.engine.admin(fixture.admin, "start-mail", "start").ok, true);
  fixture.advance(5_000);
  fixture.advance(60_000);
  assert.equal(fixture.engine.admin(fixture.admin, "next-mail", "next").ok, true);
  assert.equal(fixture.engine.admin(fixture.admin, "start-ddos", "start").ok, true);
  fixture.advance(35_000);
  assert.equal(fixture.engine.admin(fixture.admin, "next-ddos", "next").ok, true);
  assert.equal(
    fixture.engine.admin(fixture.admin, "start-identity", "start").ok,
    true,
  );
  fixture.advance(35_000);
  assert.equal(
    fixture.engine.admin(fixture.admin, "next-identity", "next").ok,
    true,
  );
  assert.equal(fixture.engine.admin(fixture.admin, "start-recovery", "start").ok, true);
  fixture.advance(65_000);
  assert.equal(fixture.engine.admin(fixture.admin, "voting", "voting").ok, true);
}

function reveal(fixture: Fixture): string {
  const adminSnapshot = fixture.engine.snapshot(fixture.admin);
  assert(adminSnapshot?.admin);
  for (const player of fixture.players) {
    const vote = fixture.engine.action(player, {
      eventId: `vote-${player.slot}`,
      type: "vote",
      suspect: adminSnapshot.admin.players[0].department,
      reason: "La evidencia operativa requiere revisar este servicio.",
    });
    assert.equal(vote.ok, true);
  }
  const revealed = fixture.engine.admin(fixture.admin, "reveal", "reveal");
  assert(revealed.ok && revealed.snapshot?.public.phase === "revealed");
  assert.equal(revealed.snapshot.public.reveal, undefined);
  fixture.advance(3000);
  return fixture.engine.snapshot(fixture.admin)!.public.reveal!.impostorDepartmentId ?? "";
}

async function connect(url: string): Promise<Socket> {
  const socket = io(url, { transports: ["websocket"], reconnection: false });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}

async function emit(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return (await socket.timeout(3_000).emitWithAck(event, payload)) as Ack;
}

test("capacity 3–6 conserva código, acceso y parámetros en el mismo panel", () => {
  const fixture = lobby(3);
  assert.equal(
    fixture.engine.admin(fixture.admin, "settings-before-capacity", "settings", SETTINGS)
      .ok,
    true,
  );
  const before = fixture.engine.snapshot(fixture.admin);
  assert(before?.admin);
  const code = fixture.admin.code;
  const invite1 = before.admin.invites[0].invite;
  assert.equal(before.public.capacityLocked, false);

  const raised = fixture.engine.admin(
    fixture.admin,
    "capacity-6",
    "capacity",
    undefined,
    6,
  );
  assert(raised.ok && raised.snapshot?.admin);
  assert.equal(raised.snapshot.public.code, code);
  assert.equal(raised.snapshot.public.capacity, 6);
  assert.equal(raised.snapshot.public.autoStart, true);
  assert.equal(raised.snapshot.public.settings.mailSeconds, SETTINGS.mailSeconds);
  assert.equal(raised.snapshot.admin.invites.length, 6);
  assert.equal(raised.snapshot.admin.invites[0].invite, invite1);

  const lowered = fixture.engine.handleAdmin(fixture.admin, {
    eventId: "capacity-3",
    command: "capacity",
    capacity: 3,
  });
  assert(lowered.ok && lowered.snapshot?.admin);
  assert.equal(lowered.snapshot.public.code, code);
  assert.equal(lowered.snapshot.public.capacity, 3);
  assert.deepEqual(
    lowered.snapshot.admin.invites.map((invite) => invite.slot),
    [1, 2, 3],
  );
  assert.equal(lowered.snapshot.admin.invites[0].invite, invite1);
});

test("el aumento agrega puestos, el recorte filtra el acceso y el puesto inactivo no entra", () => {
  const fixture = lobby(3);
  assert(
    fixture.engine.admin(fixture.admin, "raise", "capacity", undefined, 6).ok,
  );
  const six = fixture.engine.snapshot(fixture.admin);
  assert(six?.admin);
  const inactiveInvite = six.admin.invites[5].invite;
  assert(
    fixture.engine.admin(fixture.admin, "lower", "capacity", undefined, 3).ok,
  );
  assert.equal(fixture.engine.snapshot(fixture.admin)?.admin?.invites.length, 3);
  assert.equal(
    fixture.engine.join({
      code: fixture.admin.code,
      slot: 6,
      invite: inactiveInvite,
      name: "Puesto inactivo",
    }).ok,
    false,
  );
  const publicJoin = fixture.engine.join({
    code: fixture.admin.code,
    name: "Entrada pública",
  });
  assert(publicJoin.ok && publicJoin.session);
  assert(publicJoin.session.slot !== undefined && publicJoin.session.slot <= 3);
});

test("un recorte ocupado rechaza sin expulsar ni cambiar el lobby", () => {
  const fixture = lobby(6);
  join(fixture, [4]);
  const before = fixture.engine.snapshot(fixture.admin);
  assert(before?.admin);
  const rejected = fixture.engine.admin(
    fixture.admin,
    "reject-occupied",
    "capacity",
    undefined,
    3,
  );
  assert.equal(rejected.ok, false);
  const after = fixture.engine.snapshot(fixture.admin);
  assert(after?.admin);
  assert.equal(after.public.capacity, 6);
  assert.equal(after.admin.players.length, 1);
  assert.equal(after.admin.players[0].id, before.admin.players[0].id);
  assert.equal(after.admin.invites.length, 6);
});

test("el cupo queda bloqueado desde asignación hasta votación, incluso con pausa e interronda", () => {
  const fixture = lobby(3);
  assert.equal(
    fixture.engine.admin(fixture.admin, "lock-settings", "settings", SETTINGS).ok,
    true,
  );
  join(fixture, [1, 2, 3]);
  assert.equal(fixture.engine.admin(fixture.admin, "assign", "assign").ok, true);
  assert.equal(fixture.engine.snapshot(fixture.admin)?.public.capacityLocked, true);
  for (const [eventId, command, args] of [
    ["briefing", "capacity", [4]] as const,
  ]) {
    assert.equal(
      fixture.engine.admin(fixture.admin, eventId, command, undefined, args[0]).ok,
      false,
    );
  }
  assert.equal(fixture.engine.admin(fixture.admin, "start", "start").ok, true);
  assert.equal(fixture.engine.admin(fixture.admin, "pause", "pause").ok, true);
  assert.equal(
    fixture.engine.admin(fixture.admin, "paused", "capacity", undefined, 4).ok,
    false,
  );
  assert.equal(fixture.engine.admin(fixture.admin, "resume", "resume").ok, true);
  fixture.advance(5_000);
  fixture.advance(60_000);
  assert.equal(fixture.engine.admin(fixture.admin, "next", "next").ok, true);
  assert.equal(
    fixture.engine.admin(fixture.admin, "interround", "capacity", undefined, 4).ok,
    false,
  );
  assert.equal(fixture.engine.admin(fixture.admin, "start-ddos", "start").ok, true);
  fixture.advance(35_000);
  assert.equal(fixture.engine.admin(fixture.admin, "next-ddos", "next").ok, true);
  assert.equal(fixture.engine.admin(fixture.admin, "start-identity", "start").ok, true);
  fixture.advance(35_000);
  assert.equal(
    fixture.engine.admin(fixture.admin, "next-identity", "next").ok,
    true,
  );
  assert.equal(fixture.engine.admin(fixture.admin, "start-recovery", "start").ok, true);
  fixture.advance(65_000);
  assert.equal(
    fixture.engine.admin(fixture.admin, "recovery-lock", "capacity", undefined, 4).ok,
    false,
  );
  assert.equal(fixture.engine.admin(fixture.admin, "voting", "voting").ok, true);
  assert.equal(
    fixture.engine.admin(fixture.admin, "voting-lock", "capacity", undefined, 4).ok,
    false,
  );
});

test("solo el final permite cambiar cupo: resetea grupo, revoca jugadores y deja replay viejo seguro", () => {
  const fixture = lobby(3);
  join(fixture, [1, 2, 3]);
  const oldPlayers = [...fixture.players];
  const oldInvites = fixture.engine.snapshot(fixture.admin)?.admin?.invites;
  assert(oldInvites);
  startAllRounds(fixture);
  const oldSettings = fixture.engine.snapshot(fixture.admin)?.public.settings;
  assert(oldSettings);
  const impostorDepartmentId = reveal(fixture);
  assert(impostorDepartmentId.length > 0);
  const changed = fixture.engine.admin(
    fixture.admin,
    "capacity-final",
    "capacity",
    undefined,
    6,
  );
  assert(changed.ok && changed.snapshot?.admin);
  assert.equal(changed.snapshot.public.phase, "lobby");
  assert.equal(changed.snapshot.public.assigned, false);
  assert.equal(changed.snapshot.public.capacity, 6);
  assert.equal(changed.snapshot.public.capacityLocked, false);
  assert.equal(changed.snapshot.public.autoStart, true);
  assert.equal(changed.snapshot.public.playersCount, 0);
  assert.equal(changed.snapshot.admin.invites.length, 6);
  assert.deepEqual(changed.snapshot.public.settings, oldSettings);
  assert.equal(fixture.engine.snapshot(fixture.admin)?.public.code, fixture.admin.code);
  assert.equal(fixture.engine.resume(oldPlayers[0]).errorCode, "session_revoked");

  const newPlayer = fixture.engine.join({
    code: fixture.admin.code,
    name: "Nuevo grupo",
  });
  assert(newPlayer.ok);
  const beforeReplay = fixture.engine.snapshot(fixture.admin);
  assert(beforeReplay?.admin);
  const replay = fixture.engine.admin(
    fixture.admin,
    "capacity-final",
    "capacity",
    undefined,
    3,
  );
  assert(replay.ok && replay.snapshot?.admin);
  assert.equal(replay.snapshot.public.capacity, 6);
  assert.equal(replay.snapshot.public.playersCount, 1);
  assert.equal(replay.snapshot.admin.players.length, 1);
  assert.equal(replay.snapshot.admin.players[0].name, "Nuevo grupo");
  assert.equal(replay.snapshot.admin.invites.length, 6);
  assert.deepEqual(replay.snapshot.public.settings, oldSettings);
  assert.equal(oldInvites[0].invite, replay.snapshot.admin.invites[0].invite);
});

test("el identificador canónico del impostor solo aparece después del voto y la revelación docente", () => {
  const fixture = lobby(3);
  join(fixture, [1, 2, 3]);
  assert(!JSON.stringify(fixture.engine.snapshot(fixture.admin)?.public).includes("impostorDepartmentId"));
  startAllRounds(fixture);
  assert(!JSON.stringify(fixture.engine.snapshot(fixture.admin)?.public).includes("impostorDepartmentId"));
  for (const player of fixture.players) {
    const own = fixture.engine.snapshot(player);
    assert(own?.player);
    const vote = fixture.engine.action(player, {
      eventId: `canon-vote-${player.slot}`,
      type: "vote",
      suspect: own.player.department,
      reason: "Se revisa el servicio por señales coincidentes.",
    });
    assert.equal(vote.ok, true);
  }
  assert.equal(fixture.engine.admin(fixture.admin, "reveal", "reveal").ok, true);
  assert.equal(fixture.engine.snapshot(fixture.admin)?.public.reveal, undefined);
  fixture.advance(2999);
  assert.equal(fixture.engine.snapshot(fixture.admin)?.public.reveal, undefined);
  fixture.advance(1);
  const publicState = fixture.engine.snapshot(fixture.admin)?.public;
  assert(publicState?.reveal?.impostorDepartmentId);
  const privateImpostor = fixture.players
    .map((player) => fixture.engine.snapshot(player)?.player)
    .find((player) => player?.role === "impostor");
  assert(privateImpostor);
  assert.equal(
    publicState.reveal.impostorDepartmentId,
    privateImpostor.department,
  );
});

test("un jugador no puede ejecutar capacity y otras salas quedan aisladas", () => {
  const first = lobby(3);
  join(first, [1]);
  const second = lobby(3);
  const denied = first.engine.admin(first.players[0], "player-capacity", "capacity", undefined, 6);
  assert.equal(denied.ok, false);
  assert.equal(second.engine.snapshot(second.admin)?.public.capacity, 3);
  assert.equal(first.engine.snapshot(first.admin)?.public.capacity, 3);
});

test("el socket docente activo no puede crear otra sala, pero un administrador independiente sí", async () => {
  const bundle = await createApp({
    env: "production",
    root: process.cwd(),
    adminKey: "capacity-socket-key",
  });
  await new Promise<void>((resolve) => bundle.server.listen(0, "127.0.0.1", resolve));
  const address = bundle.server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}`;
  const sockets: Socket[] = [];
  try {
    const adminSocket = await connect(url);
    sockets.push(adminSocket);
    const created = await emit(adminSocket, "create", {
      capacity: 3,
      adminKey: "capacity-socket-key",
    });
    assert(created.ok && created.session && created.snapshot?.admin);
    for (const invite of created.snapshot.admin.invites) {
      const playerSocket = await connect(url);
      sockets.push(playerSocket);
      const joined = await emit(playerSocket, "join", {
        code: created.session.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `Socket ${invite.slot}`,
      });
      assert(joined.ok);
    }
    assert((await emit(adminSocket, "admin", { eventId: "assign", command: "assign" })).ok);
    assert.equal(
      (await emit(adminSocket, "create", { capacity: 4 })).ok,
      false,
    );
    assert.equal(
      (await emit(adminSocket, "admin", {
        eventId: "socket-capacity-locked",
        command: "capacity",
        capacity: 6,
      })).ok,
      false,
    );
    const otherAdmin = await connect(url);
    sockets.push(otherAdmin);
    const independent = await emit(otherAdmin, "create", {
      capacity: 4,
      adminKey: "capacity-socket-key",
    });
    assert(independent.ok && independent.session);
    assert.notEqual(independent.session.code, created.session.code);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await bundle.close();
  }
});
