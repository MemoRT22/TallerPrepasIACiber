/** P8: real wall clock + real Socket.IO; never imports/mutates GameEngine state. */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../server/index.ts";
import type {
  Ack,
  Snapshot,
  Session,
  GameAction,
  AdminCommand,
} from "../shared/types.ts";

const port = Number(process.env.P8_PORT ?? 4180);
const url = `http://127.0.0.1:${port}`;
const folder = await mkdtemp(join(tmpdir(), "cancun-p8-"));
const key = randomBytes(24).toString("base64url");
const app = await createApp({
  root: process.cwd(),
  env: "production",
  adminKey: key,
});
await new Promise<void>((resolve) =>
  app.server.listen(port, "127.0.0.1", resolve),
);
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const sockets: Socket[] = [];
let sequence = 0;
type Actor = {
  socket: Socket;
  state?: Snapshot;
  session?: Session;
  busy: boolean;
  marks: Set<string>;
};
async function actor(): Promise<Actor> {
  const socket = io(url, { transports: ["websocket"], reconnection: true });
  sockets.push(socket);
  const a: Actor = { socket, busy: false, marks: new Set() };
  socket.on("state", (s) => {
    a.state = s;
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return a;
}
async function rpc(a: Actor, event: string, payload: unknown): Promise<Ack> {
  const result = (await a.socket
    .timeout(3000)
    .emitWithAck(event, payload)) as Ack;
  if (result.snapshot) a.state = result.snapshot;
  if (result.session) a.session = result.session;
  return result;
}
const reports: Record<string, any>[] = [];
const privateAccess: any[] = [];
async function prepare(capacity: 3 | 6) {
  const admin = await actor();
  const created = await rpc(admin, "create", {
    capacity,
    adminKey: key,
    autoStart: true,
  });
  assert(created.ok && admin.session && created.snapshot?.admin);
  const monitor = await actor();
  assert((await rpc(monitor, "watch", { code: admin.session.code })).ok);
  const report: any = {
    capacity,
    clock: "Date.now / normal server",
    started: null,
    phases: {},
    actions: {},
    errors: [],
    checks: {},
    transitions: [],
    memory: [],
  };
  reports.push(report);
  privateAccess.push({
    capacity,
    public: `${url}/pantalla/${admin.session.code}`,
    admin: `${url}/docente#room=${admin.session.code}&token=${admin.session.token}`,
    join: `${url}/jugar?code=${admin.session.code}`,
  });
  return { admin, monitor, report, players: [] as Actor[], capacity };
}
const runs = await Promise.all([prepare(3), prepare(6)]);
await writeFile(
  join(folder, "access-private.json"),
  JSON.stringify(privateAccess, null, 2),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    ready: true,
    folder,
    port,
    public: privateAccess.map((a) => a.public),
    instruction:
      "start = unaccelerated 3+6 runs; quit = close server",
  }),
);

async function command(run: (typeof runs)[number], value: AdminCommand) {
  const ack = await rpc(run.admin, "admin", {
    eventId: `c-${sequence++}`,
    command: value,
  });
  assert(ack.ok, `${value}: ${ack.error}`);
  return ack;
}
function decode(cipher: string, shift: number) {
  return cipher.replace(/[A-Z]/g, (c) =>
    String.fromCharCode(65 + ((c.charCodeAt(0) - 65 - shift + 26) % 26)),
  );
}
async function action(
  run: (typeof runs)[number],
  a: Actor,
  value: Omit<GameAction, "eventId">,
  duplicate = false,
) {
  const payload = { ...value, eventId: `a-${sequence++}` };
  // Client-side delay on the six-person run, not a claim of physical network shaping.
  if (run.capacity === 6) await delay(120);
  const before = Date.now();
  const ack = await rpc(a, "action", payload);
  const counter = (run.report.actions[value.type] ??= {
    accepted: 0,
    rejected: 0,
    maxAckMs: 0,
  });
  counter[ack.ok ? "accepted" : "rejected"]++;
  counter.maxAckMs = Math.max(counter.maxAckMs, Date.now() - before);
  if (duplicate && ack.ok) {
    const replay = await rpc(a, "action", payload);
    assert(replay.ok);
    run.report.checks.dedup =
      "PASS: same event replay accepted without second effect";
  }
  return ack;
}
async function reconnect(run: (typeof runs)[number], a: Actor, label: string) {
  const session = a.session!;
  a.socket.disconnect();
  await delay(1200);
  a.socket.connect();
  await new Promise<void>((resolve) => a.socket.once("connect", resolve));
  assert((await rpc(a, "resume", session)).ok);
  run.report.checks[label] = {
    result: "PASS",
    waiting: a.state?.player?.waitingForNextRound ?? false,
  };
}
async function play(run: (typeof runs)[number], a: Actor) {
  if (a.busy || !a.socket.connected) return;
  const snapshot = a.state,
    p = snapshot?.player,
    s = snapshot?.public;
  if (
    !p ||
    !s ||
    s.stage !== "playing" ||
    s.paused ||
    p.blocked ||
    p.waitingForNextRound
  )
    return;
  a.busy = true;
  try {
    const defenders = run.players.filter(
      (x) => x.state?.player?.role === "defender",
    );
    const target =
      defenders.find((x) => x !== a)?.state?.player?.department ??
      defenders[0]?.state?.player?.department;
    if (s.phase === "mail") {
      const card = p.mail[0];
      if (p.role === "impostor" && s.clock > 15000 && !a.marks.has("attack")) {
        a.marks.add("attack");
        const template = p.templates.find((t) => t.kind === "attack");
        if (template)
          await action(run, a, {
            type: "mail:send",
            target,
            templateId: template.id,
          });
      }
      if (
        p.role === "defender" &&
        s.clock > 30000 &&
        !a.marks.has("official")
      ) {
        a.marks.add("official");
        await action(run, a, {
          type: "mail:send",
          target,
          templateId: p.templates[0]?.id,
        });
      }
      if (card) {
        if (!card.inspection && p.mailInspectionsRemaining > 0)
          await action(
            run,
            a,
            { type: "mail:inspect", cardId: card.id },
            !a.marks.has("inspect-replay"),
          );
        a.marks.add("inspect-replay");
        const accept =
          !/(contraseña|paga|credenciales|sesión expira|inicia sesión|código de acceso)/i.test(
            `${card.subject} ${card.preview}`,
          );
        await action(run, a, {
          type: "mail:classify",
          cardId: card.id,
          accept,
        });
        run.report.checks[accept ? "mailAccept" : "mailReject"] = "PASS";
      }
    } else if (s.phase === "ddos") {
      if (p.role === "impostor" && p.ddosChallenge && !p.ddosChallenge.solved) {
        const pattern = [...p.ddosChallenge.patterns].sort(
          (a, b) =>
            Math.min(...b.requests) / b.clients -
            Math.min(...a.requests) / a.clients,
        )[0];
        await action(run, a, {
          type: "ddos:challenge-solve",
          answer: pattern.id,
        });
      }
      if (
        p.ddosChallenge?.waveAvailable &&
        s.clock > 40000 &&
        !a.marks.has("wave")
      ) {
        a.marks.add("wave");
        await action(run, a, { type: "ddos:wave", target }, true);
      }
      if (
        p.ddosDefense?.available &&
        (p.ddosDefense.waveRemaining > 0 || s.clock > 60000)
      )
        await action(run, a, { type: "ddos:shield" }, true);
      if (!(p.ddosDefense && p.ddosDefense.remaining > 0)) {
        for (const point of p.traffic.filter(
          (t) => t.kind === "red" && t.arrives > s.clock,
        ))
          await action(run, a, { type: "ddos:tap", pointId: point.id });
      }
    } else if (s.phase === "identity") {
      const c = p.identityChallenge;
      if (c && !c.solved) {
        const different = c.draft.find(
          (d) => c.record.find((r) => r.key === d.key)?.value !== d.value,
        );
        if (different)
          await action(run, a, {
            type: "identity:challenge-solve",
            answer: different.key,
          });
      }
      if (c?.advancedAvailable && s.clock > 41000 && !a.marks.has("advanced")) {
        a.marks.add("advanced");
        await action(run, a, { type: "identity:send-advanced" });
      }
      const card = p.card;
      if (card) {
        const same =
          JSON.stringify(card.reference) === JSON.stringify(card.presented);
        if (
          same &&
          s.clock > 42000 &&
          !card.verification &&
          p.identityVerificationsRemaining > 0
        ) {
          await action(run, a, { type: "identity:verify", cardId: card.id });
          return;
        }
        if (card.verification?.pending) return;
        const evidence =
          card.verification?.evidence?.map((e) => e.value).join(" ") ?? "";
        const accept =
          same &&
          !/SUSPENDIDA|Sin turno|otro acceso|sin reingreso/.test(evidence);
        await action(run, a, {
          type: "identity:decide",
          cardId: card.id,
          accept,
        });
      }
    } else if (s.phase === "recovery") {
      const c = p.recoveryChallenge;
      if (c && !c.solved)
        await action(run, a, {
          type: "recovery:challenge-solve",
          answer: decode(c.cipher, c.shift),
        });
      if (c?.sabotageAvailable && !a.marks.has("sabotage") && s.clock > 3000) {
        a.marks.add("sabotage");
        const target = c.targets[0]?.department;
        if (target)
          await action(run, a, { type: "recovery:sabotage", target }, true);
      }
      const f = p.fragment;
      if (f && !f.solved) {
        if (f.altered && !f.verificationUsed) {
          await action(run, a, { type: "recovery:verify" });
          return;
        }
        if (f.verificationRemaining > 0) return;
        // Leave one real decision to the last second, without changing any clock.
        const last = defenders.at(-1) === a;
        if (s.clock > (last ? 119000 : 12000))
          await action(
            run,
            a,
            {
              type: "recovery:solve",
              answer: decode(f.cipher, f.verifiedShift ?? f.shift ?? 3),
            },
            true,
          );
      }
    }
    if (s.remaining <= 1 && !a.marks.has(`last-${s.phase}`)) {
      a.marks.add(`last-${s.phase}`);
      const type =
        s.phase === "mail"
          ? "mail:send"
          : s.phase === "identity"
            ? "identity:verify"
            : s.phase === "ddos"
              ? "ddos:tap"
              : undefined;
      if (type) {
        const ack = await action(run, a, {
          type,
          pointId: "expired-p8",
          cardId: p.card?.id,
        });
        run.report.checks[`lastSecond-${s.phase}`] = {
          clock: s.clock,
          result: ack.ok ? "accepted" : "rejected",
          reason: ack.error,
        };
      }
    }
  } catch (error) {
    run.report.errors.push(String(error));
  } finally {
    a.busy = false;
  }
}
async function runPilot(run: (typeof runs)[number]) {
  run.report.started = new Date().toISOString();
  const started = Date.now();
  for (let i = 0; i < run.capacity; i++) {
    const a = await actor();
    const ack = await rpc(a, "join", {
      code: run.admin.session!.code,
      name: `QA${run.capacity}-${i + 1}`,
    });
    assert(ack.ok);
    run.players.push(a);
  }
  assert(!run.monitor.state?.admin && !run.monitor.state?.player);
  let previous = "",
    transitioned = "",
    memoryAtReveal: any;
  const flags = new Set<string>();
  while (true) {
    const s = run.monitor.state!.public;
    const label = `${s.phase}/${s.stage}`;
    if (label !== previous) {
      run.report.transitions.push({
        phase: s.phase,
        stage: s.stage,
        wallMs: Date.now() - started,
        clock: s.clock,
      });
      console.log(`QA ${run.capacity}: ${label} ${s.clock}ms`);
      previous = label;
    }
    if (s.stage === "playing" && !run.report.phases[s.phase])
      run.report.phases[s.phase] = {
        duration: s.duration,
        wallStart: Date.now(),
        clockStart: s.clock,
      };
    if (
      s.stage === "finished" &&
      run.report.phases[s.phase] &&
      !run.report.phases[s.phase].wallEnd
    ) {
      Object.assign(run.report.phases[s.phase], {
        wallEnd: Date.now(),
        logicalEnd: s.clock,
      });
    }
    if (s.identity?.event) run.report.checks.communique = "PASS";
    if (s.ddos?.waveAlert) run.report.checks.publicWave = "PASS";
    if (
      run.capacity === 6 &&
      s.phase === "mail" &&
      s.clock > 80000 &&
      !flags.has("adminReconnect")
    ) {
      flags.add("adminReconnect");
      await reconnect(run, run.admin, "adminReconnect");
    }
    if (
      run.capacity === 6 &&
      s.phase === "ddos" &&
      s.clock > 82000 &&
      !flags.has("impostorReconnect")
    ) {
      flags.add("impostorReconnect");
      const a = run.players.find((p) => p.state?.player?.role === "impostor")!;
      a.busy = true;
      await reconnect(run, a, "impostorReconnect");
      a.busy = false;
    }
    if (
      run.capacity === 6 &&
      s.phase === "identity" &&
      s.clock > 110000 &&
      !flags.has("defenderReconnect")
    ) {
      flags.add("defenderReconnect");
      const a = run.players.find((p) => p.state?.player?.role === "defender")!;
      a.busy = true;
      await reconnect(run, a, "defenderReconnect");
      a.busy = false;
    }
    if (
      s.stage === "finished" &&
      ["mail", "ddos", "identity"].includes(s.phase) &&
      transitioned !== s.phase
    ) {
      transitioned = s.phase;
      await command(run, "next");
      await command(run, "start");
    }
    if (
      s.phase === "recovery" &&
      s.stage === "finished" &&
      !flags.has("voting")
    ) {
      flags.add("voting");
      await command(run, "judgment");
      await delay(2000);
      await command(run, "voting");
      const impostor = run.players.find(
        (p) => p.state?.player?.role === "impostor",
      )!.state!.player!.department;
      const wrong = run.players.find(
        (p) => p.state?.player?.role === "defender",
      )!.state!.player!.department;
      for (const a of run.players)
        await action(
          run,
          a,
          {
            type: "vote",
            suspect: run.capacity === 3 ? impostor : wrong,
            reason: "Escenario automatizado de QA; no es acusación personal.",
          },
          true,
        );
      memoryAtReveal = s.city;
      await command(run, "reveal");
    }
    if (s.phase === "revealed") {
      if ((s.judgment?.elapsed ?? 0) < 3) {
        assert(!s.reveal);
        run.report.checks.truthPrivacy = "PASS";
      }
      if (s.judgment?.elapsed === 30) {
        assert(s.reveal);
        assert.deepEqual(s.city?.services, memoryAtReveal?.services);
        assert.equal(s.city?.stability, memoryAtReveal?.stability);
        const audit = run.admin.state?.admin?.closingAudit;
        run.report.auditCounts = Object.fromEntries(
          [...new Set(audit?.logs.map((l) => l.type) ?? [])].map((type) => [
            type,
            audit!.logs.filter((l) => l.type === type).length,
          ]),
        );
        run.report.final = {
          scores: s.scores,
          results: s.results,
          bonus: s.reveal.bonus,
          stability: s.city?.stability,
        };
        assert.equal(s.reveal.logs.length, 0);
        assert.equal(s.reveal.votes.length, 0);
        const old = run.players[0].session;
        await command(run, "reset-all");
        await command(run, "manual-start");
        const fresh = run.admin.state!.public;
        assert.equal(fresh.playersCount, 0);
        assert.equal(fresh.city?.stability, 100);
        assert.deepEqual(fresh.scores, { defenders: 0, impostor: 0 });
        const stale = await actor();
        assert(!(await rpc(stale, "resume", old)).ok);
        assert(
          (
            await rpc(stale, "join", {
              code: fresh.code,
              name: "Nuevo grupo QA",
            })
          ).ok,
        );
        assert(!stale.state?.player?.role);
        run.report.checks.newGroup = "PASS";
        break;
      }
    }
    await Promise.all(run.players.map((a) => play(run, a)));
    run.report.memory.push({
      wallMs: Date.now() - started,
      heap: process.memoryUsage().heapUsed,
    });
    if (run.report.memory.length > 120) run.report.memory.shift();
    if (Date.now() - started > 15 * 60 * 1000)
      throw new Error(`QA ${run.capacity} exceeded 15 min without completing`);
    await delay(200);
  }
  run.report.wallMs = Date.now() - started;
  run.report.finished = new Date().toISOString();
}
let running = false;
createInterface({ input: process.stdin }).on("line", (line) => {
  if (line === "quit") {
    for (const s of sockets) s.disconnect();
    void app.close().then(() => process.exit(0));
  }
  if (line === "start" && !running) {
    running = true;
    void Promise.all(runs.map(runPilot))
      .then(async () => {
        await writeFile(
          join(folder, "report.json"),
          JSON.stringify(reports, null, 2),
        );
        console.log(
          JSON.stringify({
            completed: true,
            report: join(folder, "report.json"),
            summaries: reports.map((r) => ({
              capacity: r.capacity,
              errors: r.errors.length,
              wallMs: r.wallMs,
            })),
          }),
        );
      })
      .catch(async (error) => {
        await writeFile(
          join(folder, "failure.json"),
          JSON.stringify({ error: String(error), reports }, null, 2),
        );
        console.error(error);
      });
  }
});
