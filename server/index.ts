import express, { type Express } from "express";
import { createServer, type Server as HttpServer } from "node:http";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server as SocketIOServer, type Socket } from "socket.io";
import type { ViteDevServer } from "vite";
import { GameEngine } from "./engine.js";
import type {
  Ack,
  AdminCommand,
  GameAction,
  Session,
  Settings,
} from "../shared/types.js";

export interface AppOptions {
  engine?: GameEngine;
  root?: string;
  env?: string;
  adminKey?: string;
}

export interface AppBundle {
  app: Express;
  server: HttpServer;
  httpServer: HttpServer;
  io: SocketIOServer;
  engine: GameEngine;
  vite?: ViteDevServer;
  close: () => Promise<void>;
}

type SocketData = {
  session?: Session;
  watchCode?: string;
};

type AckCallback = (ack: unknown) => void;

type RestoreLobbyInput = {
  code: string;
  capacity: 3 | 4 | 5 | 6;
  adminToken: string;
  invites: { slot: number; invite: string; department: string }[];
};

type RestorableEngine = GameEngine & {
  restoreLobby: (input: RestoreLobbyInput) => import("../shared/types.js").Ack;
};

type LegacyRoom = {
  code?: unknown;
  session?: { code?: unknown; token?: unknown };
  players?: unknown;
};

function constantTimeEqual(
  candidate: unknown,
  expected: string | undefined,
): boolean {
  if (typeof candidate !== "string" || !expected) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  if (candidateBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(candidateBytes, expectedBytes);
}

function readLegacyLobby(root: string, engine: GameEngine): string | undefined {
  const file = path.join(root, ".delivery", "room.json");
  if (!existsSync(file)) return undefined;

  let legacy: LegacyRoom;
  try {
    legacy = JSON.parse(readFileSync(file, "utf8")) as LegacyRoom;
  } catch {
    return undefined;
  }
  if (!legacy || typeof legacy !== "object") return undefined;
  const code =
    typeof legacy.code === "string"
      ? legacy.code.trim()
      : typeof legacy.session?.code === "string"
        ? legacy.session.code.trim()
        : "";
  const adminToken =
    typeof legacy.session?.token === "string"
      ? legacy.session.token.trim()
      : "";
  if (!/^\d{4}$/.test(code) || !adminToken || !Array.isArray(legacy.players))
    return undefined;
  if (legacy.players.length !== 6) return undefined;

  const invites: RestoreLobbyInput["invites"] = [];
  for (const item of legacy.players) {
    if (!item || typeof item !== "object") return undefined;
    const player = item as {
      slot?: unknown;
      department?: unknown;
      url?: unknown;
    };
    const slot = typeof player.slot === "number" ? player.slot : NaN;
    const department = player.department;
    if (
      !Number.isInteger(slot) ||
      typeof department !== "string" ||
      !department.trim() ||
      typeof player.url !== "string"
    )
      return undefined;
    try {
      const url = new URL(player.url);
      const segments = url.pathname.split("/").filter(Boolean);
      const invite = new URLSearchParams(url.hash.replace(/^#/, "")).get(
        "invite",
      );
      if (
        segments.length !== 3 ||
        segments[0] !== "jugar" ||
        segments[1] !== code ||
        segments[2] !== String(slot) ||
        !invite
      )
        return undefined;
      invites.push({ slot, invite, department: department.trim() });
    } catch {
      return undefined;
    }
  }
  invites.sort((left, right) => left.slot - right.slot);
  if (invites.some((invite, index) => invite.slot !== index + 1))
    return undefined;

  const restore = (engine as RestorableEngine).restoreLobby;
  if (typeof restore !== "function") return undefined;
  const ack = restore.call(engine, {
    code,
    capacity: 6,
    adminToken,
    invites,
  });
  return ack.ok ? code : undefined;
}

function loadOperatorKey(root: string): string {
  const directory = path.join(root, ".delivery");
  const file = path.join(directory, "operator.json");
  let adminKey: string | undefined;
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as {
        adminKey?: unknown;
      };
      if (typeof parsed.adminKey === "string" && parsed.adminKey.length > 0)
        adminKey = parsed.adminKey;
    } catch {
      adminKey = undefined;
    }
  }
  if (!adminKey) adminKey = randomBytes(32).toString("base64url");
  mkdirSync(directory, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ adminKey }, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(file, 0o600);
  return adminKey;
}

function callbackResult(callback: unknown, result: unknown): void {
  if (typeof callback === "function") (callback as AckCallback)(result);
}

export async function createApp(options: AppOptions = {}): Promise<AppBundle> {
  const root = options.root ?? process.cwd();
  const env = options.env ?? process.env.NODE_ENV ?? "development";
  const configuredAdminKey = options.adminKey ?? process.env.CANCUN_ADMIN_KEY;
  const adminKey =
    typeof configuredAdminKey === "string" && configuredAdminKey.length > 0
      ? configuredAdminKey
      : undefined;
  const app = express();
  const server = createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: true, credentials: false },
  });
  const engine = options.engine ?? new GameEngine({ autoTick: false });
  let vite: ViteDevServer | undefined;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/health", (_request, response) => response.json({ ok: true }));

  if (env === "production") {
    const clientDir = path.join(root, "dist", "client");
    app.use(express.static(clientDir, { index: "index.html" }));
    const indexFile = path.join(clientDir, "index.html");
    if (existsSync(indexFile))
      app.get("*", (_request, response) => response.sendFile(indexFile));
  } else {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      root,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const broadcastRoom = (code: string): void => {
    if (!engine.rooms.has(code)) return;
    for (const socket of io.sockets.sockets.values()) {
      const data = socket.data as SocketData;
      if (data.session?.code === code) {
        const snapshot = engine.snapshot(data.session);
        if (snapshot) socket.emit("state", snapshot);
        else {
          engine.unbind(socket.id);
          delete data.session;
          socket.emit("session:ended", { code, reason: "activity_reset" });
          socket.disconnect(true);
        }
      } else if (data.watchCode === code) {
        const publicState = engine.getPublicSnapshot(code);
        if (publicState) socket.emit("state", { public: publicState });
      }
    }
  };
  const broadcastChanged = (codes: string[]): void => {
    for (const code of codes) broadcastRoom(code);
  };

  const bindSession = (socket: Socket, session: Session): void => {
    const data = socket.data as SocketData;
    const sameSession =
      data.session?.code === session.code &&
      data.session?.token === session.token &&
      data.session?.kind === session.kind;
    if (!sameSession) engine.unbind(socket.id);
    const previous = engine.bind(session, socket.id);
    if (previous) io.sockets.sockets.get(previous)?.disconnect(true);
    data.session = { ...session };
    delete data.watchCode;
  };
  const clearBinding = (socket: Socket): void => {
    engine.unbind(socket.id);
    const data = socket.data as SocketData;
    delete data.session;
  };

  io.on("connection", (socket) => {
    socket.data = {} as SocketData;
    socket.on(
      "create",
      (
        payload: {
          capacity?: unknown;
          adminKey?: unknown;
          autoStart?: unknown;
        },
        callback?: AckCallback,
      ) => {
        const data = socket.data as SocketData;
        const boundAdmin =
          data.session?.kind === "admin" &&
          engine.snapshot(data.session) !== null;
        const boundAdminSnapshot =
          boundAdmin && data.session ? engine.snapshot(data.session) : null;
        const activeAssignedAdmin =
          boundAdminSnapshot?.public.assigned === true &&
          boundAdminSnapshot.public.phase !== "revealed";
        const boundPlayer = data.session?.kind === "player";
        const watching = typeof data.watchCode === "string";
        const authorized =
          !boundPlayer &&
          !watching &&
          !activeAssignedAdmin &&
          (boundAdmin || constantTimeEqual(payload?.adminKey, adminKey));
        const ack = authorized
          ? engine.handleCreate({
              capacity: payload?.capacity,
              autoStart: payload?.autoStart === true,
            })
          : {
              ok: false,
              error: "Se requiere una clave docente válida.",
            };
        if (ack.ok && ack.session) bindSession(socket, ack.session);
        callbackResult(callback, ack);
        if (ack.ok && ack.session) broadcastRoom(ack.session.code);
      },
    );
    socket.on(
      "join",
      (
        payload: {
          code?: unknown;
          name?: unknown;
          slot?: unknown;
          invite?: unknown;
        },
        callback?: AckCallback,
      ) => {
        let ack = engine.handleJoin(payload ?? {});
        if (ack.ok && ack.session) {
          bindSession(socket, ack.session);
          const snapshot = engine.snapshot(ack.session);
          if (snapshot) ack = { ...ack, snapshot } satisfies Ack;
        }
        callbackResult(callback, ack);
        if (ack.ok && ack.session) broadcastRoom(ack.session.code);
      },
    );
    socket.on("resume", (payload: Session, callback?: AckCallback) => {
      let ack = engine.handleResume(payload);
      if (ack.ok && ack.session) {
        bindSession(socket, ack.session);
        const snapshot = engine.snapshot(ack.session);
        if (snapshot) ack = { ...ack, snapshot } satisfies Ack;
      }
      callbackResult(callback, ack);
      if (ack.ok && ack.session) broadcastRoom(ack.session.code);
    });
    socket.on(
      "watch",
      (payload: { code?: unknown }, callback?: AckCallback) => {
        const ack = engine.handleWatch(payload ?? {});
        if (ack.ok && ack.snapshot?.public) {
          clearBinding(socket);
          (socket.data as SocketData).watchCode = ack.snapshot.public.code;
        }
        callbackResult(callback, ack);
        if (ack.ok && ack.snapshot?.public)
          socket.emit("state", { public: ack.snapshot.public });
      },
    );
    socket.on(
      "admin",
      (
        request: {
          eventId?: unknown;
          command?: unknown;
          settings?: Settings;
          capacity?: unknown;
        },
        callback?: AckCallback,
      ) => {
        const data = socket.data as SocketData;
        const session = data.session;
        const ack = session
          ? engine.handleAdmin(session, request ?? {})
          : { ok: false, error: "No hay una sesión docente autorizada." };
        callbackResult(callback, ack);
        if (ack.ok && session) broadcastRoom(session.code);
      },
    );
    socket.on("action", (action: GameAction, callback?: AckCallback) => {
      const data = socket.data as SocketData;
      const session = data.session;
      const ack = session
        ? engine.handleAction(session, action)
        : { ok: false, error: "No hay una sesión de jugador autorizada." };
      callbackResult(callback, ack);
      if (ack.ok && session) broadcastRoom(session.code);
    });
    socket.on("disconnect", () => {
      const data = socket.data as SocketData;
      const code = data.session?.code ?? data.watchCode;
      engine.unbind(socket.id);
      if (code && engine.rooms.has(code)) broadcastRoom(code);
    });
  });

  engine.start(broadcastChanged);
  const close = async (): Promise<void> => {
    engine.stop();
    if (vite) await vite.close();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close(() => resolve());
    });
  };
  return { app, server, httpServer: server, io, engine, vite, close };
}

async function startServer(): Promise<void> {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const adminKey =
    typeof process.env.CANCUN_ADMIN_KEY === "string" &&
    process.env.CANCUN_ADMIN_KEY.length > 0
      ? process.env.CANCUN_ADMIN_KEY
      : loadOperatorKey(root);
  const engine = new GameEngine({ autoTick: false });
  const restoredCode = readLegacyLobby(root, engine);
  const bundle = await createApp({ root, engine, adminKey });
  const port = Number(process.env.PORT ?? 3000);
  if (restoredCode)
    console.log(`Sala restaurada ${restoredCode}; lobby nueva lista.`);
  bundle.server.listen(port, "0.0.0.0");
}

const mainFile = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === mainFile) void startServer();
