import test from "node:test";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../server/index.js";
import { GameEngine } from "../server/engine.js";
import { DEFAULT_SETTINGS, type Ack, type Snapshot } from "../shared/types.js";

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
  payload: unknown,
): Promise<Ack> {
  return (await socket.timeout(3000).emitWithAck(event, payload)) as Ack;
}

test(
  "ocho clientes reales recorren la partida sin filtrar información privada al monitor",
  { timeout: 15000 },
  async (t) => {
    let time = 0;
    let seed = 47;
    const engine = new GameEngine({
      now: () => time,
      random: () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      },
    });
    const bundle = await createApp({
      engine,
      env: "production",
      root: process.cwd(),
      adminKey: TEST_ADMIN_KEY,
    });
    await new Promise<void>((resolve) =>
      bundle.server.listen(0, "127.0.0.1", resolve),
    );
    const address = bundle.server.address();
    assert(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}`;
    const sockets: Socket[] = [];
    t.after(async () => {
      sockets.forEach((s) => s.disconnect());
      await bundle.close();
    });
    const health = await fetch(`${url}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    const manifest = await fetch(`${url}/manus-routes.json`);
    assert.equal(manifest.status, 200);
    const routes = (await manifest.json()) as { routes: { path: string }[] };
    assert(routes.routes.some((r) => r.path === "/jugar/:code/:slot"));
    const admin = await connect(url);
    sockets.push(admin);
    const created = await emit(admin, "create", {
      capacity: 6,
      adminKey: TEST_ADMIN_KEY,
    });
    assert(created.session && created.snapshot?.admin);
    const code = created.session.code;
    const publicClient = await connect(url);
    sockets.push(publicClient);
    const publicSnapshots: Snapshot[] = [];
    publicClient.on("state", (s: Snapshot) => publicSnapshots.push(s));
    assert((await emit(publicClient, "watch", { code })).ok);
    assert.equal(
      (
        await emit(publicClient, "admin", {
          eventId: "forge-public",
          command: "assign",
          token: created.session.token,
        })
      ).ok,
      false,
    );
    const players: { socket: Socket; join: Ack }[] = [];
    for (const invite of created.snapshot.admin.invites) {
      const socket = await connect(url);
      sockets.push(socket);
      const join = await emit(socket, "join", {
        code,
        slot: invite.slot,
        invite: invite.invite,
        name: `Estudiante ${invite.slot}`,
      });
      assert(join.ok && join.session && join.snapshot?.player);
      assert.equal(join.snapshot.admin, undefined);
      players.push({ socket, join });
    }
    const assigned = await emit(admin, "admin", {
      eventId: "assign",
      command: "assign",
    });
    assert(assigned.ok);
    assert.equal(assigned.snapshot?.public.playersCount, 6);
    assert.equal(assigned.snapshot?.public.connectedCount, 6);
    const privateStates: Snapshot[] = [];
    for (const { socket, join } of players) {
      const resumed = await emit(socket, "resume", join.session);
      assert(resumed.snapshot?.player);
      privateStates.push(resumed.snapshot);
    }
    assert.equal(
      privateStates.filter((s) => s.player?.role === "impostor").length,
      1,
    );
    assert.equal(
      (
        await emit(players[0].socket, "resume", {
          ...players[0].join.session,
          kind: "admin",
        })
      ).ok,
      false,
    );
    assert(
      (await emit(admin, "admin", { eventId: "start", command: "start" })).ok,
    );
    assert(
      (await emit(admin, "admin", { eventId: "pause", command: "pause" })).ok,
    );
    time += 10_000;
    engine.tick();
    const player = await emit(
      players[0].socket,
      "resume",
      players[0].join.session,
    );
    assert.equal(player.snapshot?.public.stage, "countdown");
    assert.equal(player.snapshot?.player?.mail.length, 0);
    assert.equal(
      (
        await emit(players[0].socket, "action", {
          eventId: "paused-act",
          type: "mail:classify",
          cardId: "countdown-card",
          accept: true,
        })
      ).ok,
      false,
    );
    assert(
      (await emit(admin, "admin", { eventId: "resume", command: "resume" })).ok,
    );
    time += 5_000;
    engine.tick();
    const phaseDurations = [
      DEFAULT_SETTINGS.mailSeconds,
      DEFAULT_SETTINGS.ddosSeconds,
      DEFAULT_SETTINGS.identitySeconds,
    ];
    for (let i = 0; i < phaseDurations.length; i++) {
      time += phaseDurations[i] * 1000;
      engine.tick();
      const next = await emit(admin, "admin", {
        eventId: `next-${i}`,
        command: "next",
      });
      assert(next.ok, next.error);
      assert(
        (
          await emit(admin, "admin", {
            eventId: `start-${i}`,
            command: "start",
          })
        ).ok,
      );
      time += 5_000;
      engine.tick();
    }
    for (const { socket, join } of players) {
      const own = await emit(socket, "resume", join.session);
      const fragment = own.snapshot?.player?.fragment;
      if (fragment) {
        const answer = fragment.cipher
          .split("")
          .map((c) =>
            String.fromCharCode(65 + ((c.charCodeAt(0) - 65 + 23) % 26)),
          )
          .join("");
        assert(
          (
            await emit(socket, "action", {
              eventId: `fragment-${join.session!.slot}`,
              type: "recovery:solve",
              answer,
            })
          ).ok,
        );
      }
    }
    const finishedRecovery = await emit(publicClient, "watch", { code });
    assert.equal(finishedRecovery.snapshot?.public.recovery.done, true);
    for (const snapshot of publicSnapshots) {
      const serialized = JSON.stringify(snapshot);
      for (const forbidden of [
        '"player"',
        '"admin"',
        '"token"',
        '"role"',
        '"node"',
        '"senderToken"',
        '"logs"',
        '"impostorName"',
        '"mail"',
        '"traffic"',
      ])
        assert(
          !new RegExp(`${forbidden}\\s*:`).test(serialized),
          `Filtración pública: ${forbidden}`,
        );
    }
    assert(
      (await emit(admin, "admin", { eventId: "open-vote", command: "voting" }))
        .ok,
    );
    assert.equal(
      (
        await emit(players[0].socket, "admin", {
          eventId: "premature-reveal",
          command: "reveal",
        })
      ).ok,
      false,
    );
    for (const { socket, join } of players)
      assert(
        (
          await emit(socket, "action", {
            eventId: `vote-${join.session!.slot}`,
            type: "vote",
            suspect: "agua",
            reason: "Observé decisiones y cambios de estado.",
          })
        ).ok,
      );
    const revealed = await emit(admin, "admin", {
      eventId: "reveal",
      command: "reveal",
    });
    assert(revealed.ok && revealed.snapshot?.public.reveal);
    assert.equal(revealed.snapshot.public.reveal.votes.length, 0);
    assert.equal(revealed.snapshot.public.reveal.logs.length, 0);
    assert.equal(revealed.snapshot.admin!.closingAudit!.votes.length, 6);
    assert(revealed.snapshot.admin!.closingAudit!.logs.length > 0);
    // Cambiar una sesión docente a espectador revoca autorización en ese socket.
    assert((await emit(admin, "watch", { code })).ok);
    assert.equal(
      (
        await emit(admin, "admin", {
          eventId: "downgraded",
          command: "restart",
        })
      ).ok,
      false,
    );
  },
);
