import test from "node:test";
import assert from "node:assert/strict";
import { cityNarrative } from "../shared/cityNarrative.js";
import { GameEngine } from "../server/engine.js";
import {
  DEPARTMENTS,
  type Capacity,
  type CityChapter,
  type DepartmentState,
} from "../shared/types.js";

const departments = (
  status: DepartmentState["status"] = "operational",
  count = 6,
) => DEPARTMENTS.slice(0, count).map((d) => ({ id: d.id, status }));
const chapter = (
  phase: CityChapter["phase"],
  outcome: CityChapter["outcome"],
  status: DepartmentState["status"] = "operational",
): CityChapter => ({ phase, outcome, services: departments(status) });
const project = (
  chapters: CityChapter[] = [],
  status: DepartmentState["status"] = "operational",
) =>
  cityNarrative({
    departments: departments(status),
    chapters,
    phase: "voting",
    stage: "finished",
    recovery: { completed: 0, total: 5 },
  });

test("P6: estabilidad inicial y fórmula pública determinista, acotada y sin segunda puntuación", () => {
  assert.equal(project().stability, 100);
  assert.equal(project().status, "normal");
  const bad = chapter("mail", "affected", "down");
  assert.equal(project([bad]).stability, 40); // 100 - 12 - 24*2.
  const damaged = project([
    bad,
    chapter("ddos", "affected", "down"),
    chapter("identity", "affected", "down"),
  ]);
  assert.equal(damaged.stability, 16);
  assert.equal(damaged.status, "critical");
  assert.deepEqual(project([bad]), project([JSON.parse(JSON.stringify(bad))]));
  for (const status of ["operational", "warning", "down"] as const)
    for (const outcome of ["contained", "affected", "interrupted"] as const) {
      const value = project([chapter("mail", outcome, status)]).stability;
      assert(Number.isInteger(value) && value >= 0 && value <= 100);
    }
  assert(!("scores" in damaged));
});

test("P6: resistencia atenúa huellas y deuda; recuperación agregada restaura sin identificar fragmentos", () => {
  const chapters = [chapter("mail", "affected", "down")];
  const hurt = project(chapters);
  const resisted = project([...chapters, chapter("ddos", "contained")]);
  assert.equal(resisted.stability, 76);
  assert(resisted.stability > hurt.stability);
  const healed = project([
    ...chapters,
    chapter("ddos", "contained"),
    chapter("identity", "contained"),
  ]);
  assert.equal(healed.stability, 100);
  assert(healed.services.every((s) => s.memory === "recovered"));
  let last = hurt.stability;
  for (let completed = 0; completed <= 5; completed++) {
    const state = cityNarrative({
      departments: departments(),
      chapters,
      phase: "recovery",
      stage: "playing",
      recovery: { completed, total: 5 },
    });
    assert(state.stability >= last);
    assert.equal(new Set(state.services.map((s) => s.intensity)).size, 1);
    if (completed > 0 && completed < 5)
      assert.equal(state.status, "recovering");
    if (completed === 5)
      assert(state.services.every((s) => s.memory === "recovered"));
    last = state.stability;
  }
  assert.equal(last, 100);
  assert.equal(
    project([
      ...chapters,
      {
        phase: "recovery",
        outcome: "restored",
        services: [],
        recoveryProgress: 1,
      },
    ]).stability,
    100,
  );
});

test("P6: entrada pública en riesgo/caída, capítulos duplicados y campos privados no contaminan", () => {
  const data = {
    departments: departments("warning"),
    chapters: [] as CityChapter[],
    phase: "ddos" as const,
    stage: "playing" as const,
    recovery: { completed: 0, total: 5 },
  };
  assert.equal(cityNarrative(data).stability, 76);
  assert.equal(cityNarrative(data).status, "risk");
  assert.equal(
    cityNarrative({ ...data, departments: departments("down") }).status,
    "critical",
  );
  const extra = {
    ...data,
    roles: ["impostor"],
    token: "secret",
    target: "agua",
    answer: "hidden",
    departments: data.departments.map((d) => ({
      ...d,
      accepted: true,
      role: "impostor",
      token: "secret",
    })),
  };
  assert.deepEqual(cityNarrative(data), cityNarrative(extra));
  const ch = chapter("mail", "affected", "warning");
  assert.deepEqual(project([ch, ch]), project([ch]));
  assert.deepEqual(
    project([chapter("mail", "affected")]).services.map((s) => s.memory),
    Array(6).fill("none"),
  );
});

function fixture(capacity: Capacity = 6) {
  let now = 0,
    event = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0.37 });
  const created = engine.create(capacity);
  const admin = created.session!;
  const players = created.snapshot!.admin!.invites.map(
    (i) =>
      engine.join({
        code: admin.code,
        slot: i.slot,
        invite: i.invite,
        name: `P${i.slot}`,
      }).session!,
  );
  const command = (command: Parameters<typeof engine.admin>[2]) => {
    const result = engine.admin(admin, `cmd-${event++}`, command);
    assert(result.ok, result.error);
    return result;
  };
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  const room = engine.rooms.get(admin.code)!;
  const snapshot = () => engine.snapshot(admin)!.public;
  const start = () => {
    command("start");
    advance(5_000);
  };
  const next = () => {
    command("next");
    start();
  };
  command("assign");
  return {
    engine,
    admin,
    players,
    room,
    command,
    advance,
    snapshot,
    start,
    next,
    event: () => `a-${event++}`,
  };
}

test("P6: consolida solo proyección pública; transiciones mantienen huellas y reinician bloqueo operativo", () => {
  const f = fixture();
  f.start();
  const p = f.room.players[0];
  p.mailMistakes = 3;
  p.publicMailRisk = 3;
  p.blocked = true;
  f.command("stop");
  const final = f.snapshot();
  assert.equal(final.city!.services[0].memory, "scarred");
  const stability = final.city!.stability;
  f.command("next");
  assert.equal(p.blocked, false);
  assert.equal(f.snapshot().departments[0].status, "operational");
  assert.equal(f.snapshot().city!.stability, stability);
  assert.equal(f.snapshot().city!.services[0].memory, "scarred");
  assert.equal(f.room.cityChapters.length, 1);
  // All clients receive exactly the same public projection.
  for (const session of f.players)
    assert.deepEqual(
      f.engine.snapshot(session)!.public.city,
      f.snapshot().city,
    );
  const original = f.snapshot().city;
  for (const player of f.room.players) {
    player.ddosChallenge = {
      patterns: [],
      answer: "PRIVATE",
      solved: true,
      waveUsed: true,
      retryAt: 9e9,
    };
    player.identityIncoming = 10;
    player.mailMistakes = 100;
  }
  assert.deepEqual(f.snapshot().city, original);
});

test("P6: pausa, reconexión y repetición son idempotentes; reset-all limpia solo narrativa y grupo", () => {
  const f = fixture(3);
  f.start();
  f.room.players[0].mailMistakes = 2;
  f.command("stop");
  f.next();
  f.room.players[0].saturation = 5;
  f.command("pause");
  const before = f.snapshot().city;
  f.advance(20000);
  assert.deepEqual(f.snapshot().city, before);
  f.command("resume");
  f.engine.bind(f.players[0], "socket-old");
  f.engine.unbind("socket-old");
  f.engine.bind(f.players[0], "socket-new");
  assert.deepEqual(f.snapshot().city, before);
  f.command("stop");
  assert.equal(f.room.cityChapters.length, 2);
  f.command("restart");
  assert.equal(f.room.cityChapters.length, 1);
  assert.equal(f.room.cityChapters[0].phase, "mail");
  f.start();
  f.command("stop");
  assert.equal(f.room.cityChapters.filter((c) => c.phase === "ddos").length, 1);
  const oldScore = { ...f.room.scores };
  f.snapshot();
  f.snapshot();
  assert.deepEqual(f.room.scores, oldScore);
  f.command("reset-all");
  assert.equal(f.snapshot().city!.stability, 100);
  assert.equal(f.room.cityChapters.length, 0);
  assert(f.snapshot().city!.services.every((s) => s.memory === "none"));
});

test("P6: 3–6 participantes, cuatro misiones, restauración progresiva y revelación sin cambiar puntuación", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = fixture(capacity);
    assert.equal(f.snapshot().city!.services.length, capacity);
    assert.equal(f.snapshot().city!.stability, 100);
    f.start();
    f.room.players[0].mailMistakes = 3;
    f.command("stop");
    f.next();
    f.room.players[0].saturation = 8;
    f.command("stop");
    f.next();
    f.room.players[0].identityIncoming = 2;
    f.command("stop");
    f.next();
    const scores = { ...f.room.scores };
    const hurt = f.snapshot().city!.stability;
    let last = hurt;
    for (const session of f.players) {
      const p = f.room.players.find((p) => p.token === session.token)!;
      if (!p.fragment) continue;
      assert(
        f.engine.action(session, {
          eventId: f.event(),
          type: "recovery:solve",
          answer: p.fragment.plaintext,
        }).ok,
      );
      const current = f.snapshot().city!;
      assert(current.stability >= last);
      last = current.stability;
    }
    assert.equal(last, 100);
    assert(f.snapshot().city!.services.some((s) => s.memory === "recovered"));
    assert.equal(f.room.cityChapters.length, 4);
    assert.deepEqual(f.room.scores, scores); // P7 scoring is deliberately not added.
    f.command("voting");
    for (const session of f.players)
      assert(
        f.engine.action(session, {
          eventId: f.event(),
          type: "vote",
          suspect: f.room.players[0].department,
          reason: "Observación del grupo",
        }).ok,
      );
    f.command("reveal");
    assert.equal(f.snapshot().city!.stability, 100);
    assert.equal(f.snapshot().phase, "revealed");
    const publicCity = JSON.stringify(f.snapshot().city);
    for (const word of [
      "token",
      "answer",
      "target",
      "impostor",
      "player",
      "PRIVATE",
    ])
      assert(!publicCity.includes(word), word);
  }
});
