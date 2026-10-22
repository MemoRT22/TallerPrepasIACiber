import test from "node:test";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { GameEngine } from "../server/engine.js";
import { createApp } from "../server/index.js";
import type { Ack, Session } from "../shared/types.js";

const ADMIN_KEY = "rejoin-test-admin-key";

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

function engineFixture(randomValue = 0) {
  let now = 0;
  const engine = new GameEngine({ now: () => now, random: () => randomValue });
  const created = engine.create(3, true);
  assert(created.ok && created.session && created.snapshot?.admin);
  const admin = created.session;
  engine.bind(admin, "admin");
  const players: Session[] = [];
  for (const invite of created.snapshot.admin.invites) {
    const joined = engine.join({
      code: admin.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `Rejoin ${invite.slot}`,
    });
    assert(joined.ok && joined.session);
    players.push(joined.session);
    engine.bind(joined.session, `player-${invite.slot}`);
  }
  return {
    engine,
    admin,
    players,
    advance(ms: number) {
      now += ms;
      engine.tick();
    },
  };
}

test(
  "Socket.io resume midronda queda esperando, rechaza acciones y vuelve con el mismo rol en next",
  { timeout: 15_000 },
  async (t) => {
    let now = 0;
    const engine = new GameEngine({ now: () => now, random: () => 0 });
    const bundle = await createApp({
      engine,
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
    t.after(async () => {
      sockets.forEach((socket) => socket.disconnect());
      await bundle.close();
    });

    const adminSocket = await connect(url);
    sockets.push(adminSocket);
    const created = await emit(adminSocket, "create", {
      capacity: 3,
      autoStart: true,
      adminKey: ADMIN_KEY,
    });
    assert(created.ok && created.session && created.snapshot?.admin);

    const players: { socket: Socket; join: Ack }[] = [];
    for (const invite of created.snapshot.admin.invites) {
      const socket = await connect(url);
      sockets.push(socket);
      const join = await emit(socket, "join", {
        code: created.session.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `Socket rejoin ${invite.slot}`,
      });
      assert(join.ok && join.session && join.snapshot?.player);
      players.push({ socket, join });
    }
    const target = players[0];
    const role = target.join.snapshot!.player!.role;
    target.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 25));

    now = 20_000;
    engine.tick();
    now = 25_000;
    engine.tick();

    const replacement = await connect(url);
    sockets.push(replacement);
    const resumed = await emit(replacement, "resume", target.join.session);
    assert(resumed.ok && resumed.snapshot?.player);
    assert.equal(resumed.snapshot.player.waitingForNextRound, true);
    const assignedRole = resumed.snapshot.player.role;
    assert(assignedRole);
    assert.deepEqual(resumed.snapshot.player.mail, []);
    assert.deepEqual(resumed.snapshot.player.traffic, []);
    const denied = await emit(replacement, "action", {
      eventId: "forged-waiting-action",
      type: "mail:send",
      templateId: "fake-support",
      target: "agua",
    });
    assert.equal(denied.ok, false);

    const repeated = await emit(replacement, "resume", target.join.session);
    assert(repeated.ok && repeated.snapshot?.player);
    assert.equal(repeated.snapshot.player.waitingForNextRound, true);
    const repeatedDenied = await emit(replacement, "action", {
      eventId: "forged-after-second-resume",
      type: "mail:send",
      templateId: "fake-support",
      target: "agua",
    });
    assert.equal(repeatedDenied.ok, false);

    now = 325_000;
    engine.tick();
    const next = await emit(adminSocket, "admin", {
      eventId: "next-after-mail",
      command: "next",
    });
    assert(next.ok, next.error);
    const active = await emit(replacement, "resume", target.join.session);
    assert(active.ok && active.snapshot?.player);
    assert.equal(active.snapshot.player.waitingForNextRound, undefined);
    assert.equal(active.snapshot.player.role, assignedRole);
  },
);

test("reset-all revoca la sesión antigua y conserva solo la modalidad QR", () => {
  const fixture = engineFixture();
  fixture.engine.unbind("player-1");
  const reset = fixture.engine.admin(fixture.admin, "reset", "reset-all");
  assert(reset.ok && reset.snapshot);
  assert.equal(reset.snapshot.public.autoStart, true);
  assert.equal(reset.snapshot.public.assigned, false);
  assert.equal(
    fixture.engine.resume(fixture.players[0]).errorCode,
    "session_revoked",
  );
});

test("la salida de una sala no pausa ni bloquea el roster de otra", () => {
  const first = engineFixture();
  first.engine.unbind("other-player");
  const firstState = first.engine.snapshot(first.admin);
  assert(firstState);
  assert.equal(firstState.public.paused, false);
  assert.equal(
    firstState.admin?.players.some((player) => player.waitingForNextRound),
    false,
  );
});

test("el bloqueo de reincorporación es igual para el impostor y conserva su rol", () => {
  const fixture = engineFixture(0);
  const before = fixture.engine.snapshot(fixture.players[0]);
  assert.equal(before?.player?.role, "impostor");
  fixture.advance(1_000);
  fixture.engine.unbind("player-1");
  const resumed = fixture.engine.resume(fixture.players[0]);
  assert(resumed.ok && resumed.snapshot?.player);
  assert.equal(resumed.snapshot.player.waitingForNextRound, true);
  assert.equal(resumed.snapshot.player.role, "impostor");
  assert.equal(
    fixture.engine.action(fixture.players[0], {
      eventId: "impostor-waiting-action",
      type: "ddos:tap",
      pointId: "forged",
    }).ok,
    false,
  );
});

test("regreso después del contador del siguiente juego tiene contenido inmediato sin duplicarlo", () => {
  for (const phase of ["mail", "ddos", "identity"] as const) {
    const fixture = engineFixture();
    fixture.advance(25_000);
    const target = fixture.players[1];
    const role = fixture.engine.snapshot(target)!.player!.role;
    fixture.engine.unbind("player-2");
    if (phase === "mail")
      assert(
        fixture.engine.admin(fixture.admin, `${phase}-restart`, "restart").ok,
      );
    else {
      assert(
        fixture.engine.admin(fixture.admin, `${phase}-stop-mail`, "stop").ok,
      );
      assert(
        fixture.engine.admin(fixture.admin, `${phase}-next-ddos`, "next").ok,
      );
      if (phase === "identity") {
        assert(
          fixture.engine.admin(fixture.admin, `${phase}-stop-ddos`, "stop").ok,
        );
        assert(
          fixture.engine.admin(fixture.admin, `${phase}-next-identity`, "next")
            .ok,
        );
      }
    }
    assert(fixture.engine.admin(fixture.admin, `${phase}-start`, "start").ok);
    fixture.advance(6_000);
    assert.equal(
      fixture.engine.snapshot(fixture.admin)!.public.stage,
      "playing",
    );
    assert(fixture.engine.resume(target).ok);
    fixture.engine.bind(target, `late-${phase}`);
    const before = fixture.engine.snapshot(target)!;
    assert.equal(before.player!.waitingForNextRound, undefined);
    assert.equal(before.player!.role, role);
    if (phase === "mail") assert.equal(before.player!.mail.length, 4);
    if (phase === "ddos") {
      assert.equal(before.player!.traffic.length, 1);
      assert.equal(before.player!.traffic[0].born, before.public.clock);
      assert.equal(
        before.player!.traffic[0].arrives - before.player!.traffic[0].born,
        4_000,
      );
    }
    if (phase === "identity") {
      assert(before.player!.card);
      assert.equal(before.player!.pendingCards, 2);
      assert(before.player!.card!.expires > before.public.clock);
    }
    fixture.engine.bind(target, `late-${phase}`);
    const repeated = fixture.engine.snapshot(target)!.player!;
    assert.deepEqual(repeated, before.player);
    const action =
      phase === "mail"
        ? {
            type: "mail:classify" as const,
            cardId: repeated.mail[0].id,
            accept: true,
          }
        : phase === "ddos"
          ? { type: "ddos:tap" as const, pointId: repeated.traffic[0].id }
          : {
              type: "identity:decide" as const,
              cardId: repeated.card!.id,
              accept: false,
            };
    assert(
      fixture.engine.action(target, {
        eventId: `late-action-${phase}`,
        ...action,
      }).ok,
    );
  }
});
