import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { io } from "socket.io-client";
import { createApp } from "../server/index.js";
import type { Ack } from "../shared/types.js";

test(
  "P8: Socket.IO real soporta ~900 ms de retardo TCP sin duplicar comandos",
  { timeout: 15000 },
  async (t) => {
    const app = await createApp({
      root: process.cwd(),
      env: "production",
      adminKey: "p8-local-test",
    });
    await new Promise<void>((resolve) =>
      app.server.listen(0, "127.0.0.1", resolve),
    );
    const address = app.server.address();
    assert(address && typeof address === "object");
    const peers = new Set<net.Socket>(),
      timers = new Set<ReturnType<typeof setTimeout>>();
    const forward = (target: net.Socket, data: Buffer) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!target.destroyed) target.write(data);
      }, 450);
      timers.add(timer);
    };
    const proxy = net.createServer((client) => {
      const upstream = net.connect(address.port, "127.0.0.1");
      peers.add(client);
      peers.add(upstream);
      client.on("data", (data) => forward(upstream, data));
      upstream.on("data", (data) => forward(client, data));
      client.on("error", () => {});
      upstream.on("error", () => {});
      client.on("close", () => upstream.destroy());
      upstream.on("close", () => client.destroy());
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    const endpoint = proxy.address();
    assert(endpoint && typeof endpoint === "object");
    const client = io(`http://127.0.0.1:${endpoint.port}`, {
      transports: ["websocket"],
      reconnection: false,
    });
    t.after(async () => {
      client.disconnect();
      for (const timer of timers) clearTimeout(timer);
      for (const peer of peers) peer.destroy();
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
      await app.close();
    });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    const rpc = async (event: string, payload: unknown) =>
      (await client.timeout(3000).emitWithAck(event, payload)) as Ack;
    const start = Date.now();
    const created = await rpc("create", {
      capacity: 3,
      adminKey: "p8-local-test",
    });
    assert(created.ok && created.snapshot);
    assert(Date.now() - start >= 800);
    const payload = {
      eventId: "p8-duplicate-capacity",
      command: "capacity",
      capacity: 6,
    };
    assert((await rpc("admin", payload)).ok);
    const replay = await rpc("admin", payload);
    assert(replay.ok);
    assert.equal(replay.snapshot!.public.capacity, 6);
    assert.equal(replay.snapshot!.admin!.invites.length, 6);
    assert.equal(replay.snapshot!.public.playersCount, 0);
  },
);
