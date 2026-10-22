import test from "node:test";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { GameEngine } from "../server/engine.js";
import { createApp } from "../server/index.js";
import { DEFAULT_SETTINGS, type Ack } from "../shared/types.js";

const TEST_ADMIN_KEY = "test-private-operator-key";

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
  payload?: unknown,
): Promise<Ack> {
  return (await socket.timeout(3_000).emitWithAck(event, payload)) as Ack;
}

test("la creación exige la clave raíz y no se hereda desde jugador o monitor", async () => {
  const bundle = await createApp({
    adminKey: TEST_ADMIN_KEY,
    env: "production",
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
    const newcomer = await connect(url);
    sockets.push(newcomer);
    assert.equal((await emit(newcomer, "create", { capacity: 3 })).ok, false);
    assert.equal(
      (
        await emit(newcomer, "create", {
          capacity: 3,
          adminKey: "not-the-operator-key",
        })
      ).ok,
      false,
    );
    const created = await emit(newcomer, "create", {
      capacity: 3,
      adminKey: TEST_ADMIN_KEY,
    });
    assert(created.ok && created.session && created.snapshot?.admin);
    const code = created.session.code;
    const invite = created.snapshot.admin.invites[0];

    const player = await connect(url);
    sockets.push(player);
    const joined = await emit(player, "join", {
      code,
      slot: invite.slot,
      invite: invite.invite,
      name: "Jugador autorizado",
    });
    assert(joined.ok);
    assert.equal(
      (
        await emit(player, "create", {
          capacity: 3,
          adminKey: TEST_ADMIN_KEY,
        })
      ).ok,
      false,
    );

    const monitor = await connect(url);
    sockets.push(monitor);
    assert((await emit(monitor, "watch", { code })).ok);
    assert.equal(
      (
        await emit(monitor, "create", {
          capacity: 3,
          adminKey: TEST_ADMIN_KEY,
        })
      ).ok,
      false,
    );

    // A valid bound administrator is allowed to create without re-sending the root key.
    const second = await emit(newcomer, "create", { capacity: 4 });
    assert(second.ok && second.session?.kind === "admin");
    assert.notEqual(second.session.code, code);
  } finally {
    for (const socket of sockets) socket.disconnect();
    await bundle.close();
  }
});

test("la clave raíz no convierte una sesión forjada en sesión docente", async () => {
  const bundle = await createApp({
    adminKey: TEST_ADMIN_KEY,
    env: "production",
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
      adminKey: TEST_ADMIN_KEY,
    });
    assert(created.ok && created.session && created.snapshot?.admin);
    const invite = created.snapshot.admin.invites[0];
    const player = await connect(url);
    sockets.push(player);
    const joined = await emit(player, "join", {
      code: created.session.code,
      slot: invite.slot,
      invite: invite.invite,
      name: "Terminal",
    });
    assert(joined.ok && joined.session);
    const forged = await emit(player, "resume", {
      ...joined.session,
      kind: "admin",
    });
    assert.equal(forged.ok, false);
    const stillPlayer = await emit(player, "resume", joined.session);
    assert(stillPlayer.ok && stillPlayer.snapshot?.player);
  } finally {
    for (const socket of sockets) socket.disconnect();
    await bundle.close();
  }
});

test("las capacidades válidas son 3–6 y una sala de seis puede asignar solo tres terminales", () => {
  const engine = new GameEngine();
  for (const capacity of [3, 4, 5, 6] as const)
    assert.equal(engine.create(capacity).ok, true);
  assert.equal(engine.create(2 as unknown as 3).ok, false);
  assert.equal(engine.create(7 as unknown as 6).ok, false);

  const partial = new GameEngine();
  const created = partial.create(6);
  assert(created.session && created.snapshot?.admin);
  const players = created.snapshot.admin.invites
    .slice(0, 3)
    .map((invite, index) => {
      const joined = partial.join({
        code: created.session!.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `Parcial ${index + 1}`,
      });
      assert(joined.ok && joined.session);
      return joined.session;
    });
  assert.equal(
    partial.admin(created.session, "partial-assign", "assign").ok,
    true,
  );
  assert.equal(partial.snapshot(players[0])?.public.playersCount, 3);
});

test("la cuenta regresiva y la pausa bloquean acciones, pero permiten configuración docente", () => {
  let now = 0;
  const engine = new GameEngine({ now: () => now });
  const created = engine.create(3);
  assert(created.session && created.snapshot?.admin);
  const players = created.snapshot.admin.invites.map((invite, index) => {
    const joined = engine.join({
      code: created.session!.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `Control ${index + 1}`,
    });
    assert(joined.ok && joined.session);
    return joined.session;
  });
  const admin = created.session;
  assert.equal(engine.admin(admin, "control-assign", "assign").ok, true);
  assert.equal(engine.admin(admin, "control-start", "start").ok, true);
  assert.equal(engine.snapshot(players[0])?.public.stage, "countdown");
  assert.equal(
    engine.action(players[0], {
      eventId: "too-early",
      type: "mail:classify",
      cardId: "not-yet",
      accept: true,
    }).ok,
    false,
  );
  assert.equal(engine.admin(admin, "control-pause", "pause").ok, true);
  now += 10_000;
  engine.tick();
  assert.equal(engine.snapshot(players[0])?.public.countdown, 5);
  assert.equal(
    engine.admin(admin, "paused-settings", "settings", {
      ...DEFAULT_SETTINGS,
      mailSeconds: 120,
    }).ok,
    true,
  );
  assert.equal(engine.snapshot(players[0])?.public.clock, 0);
  assert.equal(engine.admin(admin, "control-resume", "resume").ok, true);
  now += 5_000;
  engine.tick();
  assert.equal(engine.snapshot(players[0])?.public.stage, "playing");
});

test("la victoria de sabotaje se adapta a tres participantes y exige sus dos defensores", () => {
  let now = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0 });
  const created = engine.create(3);
  assert(created.session && created.snapshot?.admin);
  const players = created.snapshot.admin.invites.map((invite, index) => {
    const joined = engine.join({
      code: created.session!.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `DDoS ${index + 1}`,
    });
    assert(joined.ok && joined.session);
    return joined.session;
  });
  const admin = created.session;
  assert(
    engine.admin(admin, "adaptive-settings", "settings", {
      ...DEFAULT_SETTINGS,
      mailSeconds: 60,
      ddosSeconds: 30,
      identitySeconds: 30,
      recoverySeconds: 60,
    }).ok,
  );
  assert(engine.admin(admin, "adaptive-assign", "assign").ok);
  assert(engine.admin(admin, "adaptive-mail", "start").ok);
  now += 5_000;
  engine.tick();
  now += 60_000;
  engine.tick();
  assert(engine.admin(admin, "adaptive-next", "next").ok);
  assert(engine.admin(admin, "adaptive-ddos", "start").ok);
  now += 5_000;
  engine.tick();
  const room = engine.rooms.get(admin.code)!;
  room.ddosNextSpawn = 1_000_000;
  for (const player of room.players) {
    player.traffic = [];
    if (player.role !== "defender") continue;
    for (let index = 0; index < 10; index += 1)
      player.traffic.push({
        id: `adaptive-${player.slot}-${index}`,
        kind: "red",
        angle: index * 0.5,
        born: -3_000,
        arrives: 1_000,
        ownerToken: player.token,
      });
  }
  now += 1_000;
  engine.tick();
  assert.equal(
    engine.snapshot(players[0])?.public.results.at(-1)?.winner,
    "impostor",
  );
  assert.equal(engine.snapshot(players[0])?.public.running, false);
});

test("la recuperación conserva la frase completa con dos y tres defensores", () => {
  for (const [capacity, expected] of [
    [3, ["CANCUNRECUPERA", "ELCONTROL"]],
    [4, ["CANCUN", "RECUPERA", "ELCONTROL"]],
  ] as const) {
    let now = 0;
    const engine = new GameEngine({ now: () => now, random: () => 0 });
    const created = engine.create(capacity);
    assert(created.session && created.snapshot?.admin);
    const players = created.snapshot.admin.invites.map((invite, index) => {
      const joined = engine.join({
        code: created.session!.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `Recuperación ${capacity}-${index + 1}`,
      });
      assert(joined.ok && joined.session);
      return joined.session;
    });
    const admin = created.session;
    assert(
      engine.admin(admin, `recovery-${capacity}-settings`, "settings", {
        ...DEFAULT_SETTINGS,
        mailSeconds: 60,
        ddosSeconds: 30,
        identitySeconds: 30,
        recoverySeconds: 60,
      }).ok,
    );
    assert(engine.admin(admin, `recovery-${capacity}-assign`, "assign").ok);
    const start = (id: string) => {
      assert(engine.admin(admin, id, "start").ok);
      now += 5_000;
      engine.tick();
    };
    start(`recovery-${capacity}-mail`);
    now += 60_000;
    engine.tick();
    assert(engine.admin(admin, `recovery-${capacity}-next-mail`, "next").ok);
    start(`recovery-${capacity}-ddos`);
    now += 30_000;
    engine.tick();
    assert(engine.admin(admin, `recovery-${capacity}-next-ddos`, "next").ok);
    start(`recovery-${capacity}-identity`);
    now += 30_000;
    engine.tick();
    assert(
      engine.admin(admin, `recovery-${capacity}-next-identity`, "next").ok,
    );
    start(`recovery-${capacity}-recovery`);

    const defenders = engine.rooms
      .get(admin.code)!
      .players.filter((player) => player.role === "defender")
      .sort(
        (left, right) =>
          (left.fragment?.order ?? 0) - (right.fragment?.order ?? 0),
      );
    assert.deepEqual(
      defenders.map((player) => player.fragment?.answer),
      expected,
    );
    for (const player of defenders) {
      const session = players.find(
        (candidate) => candidate.slot === player.slot,
      )!;
      assert(
        engine.action(session, {
          eventId: `solve-${capacity}-${player.slot}`,
          type: "recovery:solve",
          answer: player.fragment!.answer,
        }).ok,
      );
    }
    assert.equal(engine.snapshot(admin)?.public.recovery.done, true);
  }
});

test("restoreLobby rechaza capacidades fuera de 3–6 sin crear salas parciales", () => {
  const engine = new GameEngine();
  const input = {
    code: "4321",
    adminToken: `adm_${"a".repeat(24)}`,
    invites: [],
  };
  assert.equal(
    engine.restoreLobby({
      ...input,
      capacity: 2 as unknown as 3,
    }).ok,
    false,
  );
  assert.equal(
    engine.restoreLobby({
      ...input,
      capacity: 7 as unknown as 6,
    }).ok,
    false,
  );
  assert.equal(engine.rooms.size, 0);
});

test("las rondas terminadas congelan parámetros y la recuperación anuncia el total del roster antes de iniciar", () => {
  let now = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0 });
  const created = engine.create(6);
  assert(created.session && created.snapshot?.admin);
  const admin = created.session;
  for (const invite of created.snapshot.admin.invites.slice(0, 3))
    assert(
      engine.join({
        code: admin.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `Persona ${invite.slot}`,
      }).ok,
    );
  assert(engine.admin(admin, "fix-assign", "assign").ok);
  assert(engine.admin(admin, "fix-start", "start").ok);
  assert(engine.admin(admin, "fix-stop", "stop").ok);
  assert.equal(
    engine.admin(admin, "finished-settings", "settings", DEFAULT_SETTINGS).ok,
    false,
  );
  for (const id of [
    "fix-next-ddos",
    "fix-next-identity",
    "fix-next-recovery",
  ]) {
    assert(engine.admin(admin, id, "next").ok);
    if (id !== "fix-next-recovery")
      assert(engine.admin(admin, `${id}-stop`, "stop").ok);
  }
  assert.equal(engine.snapshot(admin)?.public.stage, "briefing");
  assert.equal(engine.snapshot(admin)?.public.recovery.total, 2);
  assert(
    engine.admin(admin, "prepared-settings", "settings", DEFAULT_SETTINGS).ok,
  );
});
