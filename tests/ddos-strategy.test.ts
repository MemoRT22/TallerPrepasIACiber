import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../server/engine.js";
import {
  DEFAULT_SETTINGS,
  type Capacity,
  type GameAction,
  type Session,
} from "../shared/types.js";
import { ddosPressureStage, ddosSpawnInterval } from "../shared/ddosRules.js";

function setup(capacity: Capacity = 4, duration = 90, seedValue = 51) {
  let now = 0,
    event = 0,
    seed = seedValue;
  const engine = new GameEngine({
    now: () => now,
    random: () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    },
  });
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
  const command = (value: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `c-${event++}`, value);
  const action = (
    session: Session,
    value: Omit<GameAction, "eventId">,
    id = `a-${event++}`,
  ) => engine.action(session, { eventId: id, ...value });
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  assert(command("assign").ok);
  assert(
    engine.admin(admin, "settings", "settings", {
      ...DEFAULT_SETTINGS,
      ddosSeconds: duration,
    }).ok,
  );
  assert(command("start").ok);
  advance(5_000);
  assert(command("stop").ok);
  assert(command("next").ok);
  assert(command("start").ok);
  advance(5_000);
  const room = engine.rooms.get(admin.code)!;
  const internal = (session: Session) =>
    room.players.find((p) => p.token === session.token)!;
  const impostor = players.find((s) => internal(s).role === "impostor")!;
  const defenders = players.filter((s) => s !== impostor);
  const quiet = () => {
    room.ddosNextSpawn = Number.MAX_SAFE_INTEGER;
    for (const p of room.players) {
      p.traffic = [];
      p.inactivityEligible = false;
      p.nextIdleAt = 0;
    }
  };
  const point = (session: Session, kind: "red" | "blue", travel = 4_000) => {
    const p = internal(session);
    const item = {
      id: `${room.roundNonce}-test-${room.ddosSequence++}`,
      kind,
      angle: 0,
      born: room.clock,
      arrives: room.clock + travel,
      ownerToken: session.token,
    };
    p.traffic.push(item);
    if (kind === "blue") p.blueEmitted += 1;
    return item;
  };
  const solve = () =>
    action(impostor, {
      type: "ddos:challenge-solve",
      answer: internal(impostor).ddosChallenge!.answer,
    });
  const wave = (target = internal(defenders[0]).department, id?: string) =>
    action(impostor, { type: "ddos:wave", target }, id);
  return {
    engine,
    admin,
    players,
    defenders,
    impostor,
    room,
    internal,
    action,
    command,
    advance,
    quiet,
    point,
    solve,
    wave,
  };
}

test("P5: intensidad proporcional en 30/31/60/90/600 s y frecuencia original", () => {
  for (const duration of [30, 31, 60, 90, 600]) {
    const third = (duration * 1_000) / 3;
    assert.equal(ddosPressureStage(third - 1, duration * 1_000), 0);
    assert.equal(ddosSpawnInterval(third, duration * 1_000), 1_500);
    assert.equal(ddosSpawnInterval(2 * third, duration * 1_000), 1_100);
    const f = setup(3, duration);
    const count = new Set<string>();
    let max = 0;
    for (let clock = 0; clock < duration * 1_000; clock += 200) {
      for (const s of f.players) {
        const p = f.internal(s);
        max = Math.max(max, p.traffic.length);
        for (const point of [...p.traffic]) {
          count.add(point.id);
          if (point.kind === "red")
            assert(f.action(s, { type: "ddos:tap", pointId: point.id }).ok);
        }
      }
      f.advance(200);
    }
    assert(max <= 4, `paquetes normales concurrentes: ${max}`);
    assert(
      count.size > duration,
      "se mantuvo el flujo de todas las terminales",
    );
    assert.equal(f.room.stage, "finished");
    assert.notEqual(f.room.results.at(-1)!.winner, "impostor");
  }
});

test("P5: mezcla reproducible próxima a 60/40, azul se deja pasar sin inactividad", () => {
  const f = setup(6, 600);
  let blue = 0,
    red = 0;
  const seen = new Set<string>();
  for (let t = 0; t < 600_000; t += 200) {
    for (const s of f.players)
      for (const p of [...f.internal(s).traffic]) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          if (p.kind === "blue") blue++;
          else red++;
        }
        if (p.kind === "red")
          assert(f.action(s, { type: "ddos:tap", pointId: p.id }).ok);
      }
    f.advance(200);
  }
  assert(blue / (blue + red) > 0.56 && blue / (blue + red) < 0.64);
  for (const s of f.defenders) {
    assert.equal(f.internal(s).saturation, 0);
    assert.equal(f.internal(s).inactivityPenalties, 0);
    assert(f.internal(s).blueSuccess > 0);
  }
});

test("P5: escudo único y deduplicado, conserva señales y funciona en los tres tramos", () => {
  for (const elapsed of [0, 30_000, 60_000, 89_000]) {
    const f = setup();
    f.quiet();
    f.advance(elapsed);
    const d = f.defenders[0];
    const p = f.internal(d);
    f.point(d, "red");
    const ids = p.traffic.map((p) => p.id);
    assert(f.action(d, { type: "ddos:shield" }, "same-shield").ok);
    assert(f.action(d, { type: "ddos:shield" }, "same-shield").ok);
    assert.deepEqual(
      p.traffic.map((p) => p.id),
      ids,
    );
    assert.equal(f.engine.snapshot(d)!.player!.ddosDefense!.remaining, 4);
    assert.equal(f.action(d, { type: "ddos:shield" }).ok, false);
    assert.equal(f.action(f.impostor, { type: "ddos:shield" }).ok, false);
    assert.equal(
      f.room.logs.filter((l) => l.type === "shield_activate").length,
      1,
    );
  }
});

test("P5: protección exacta [activación, +4000), azul intacto e impacto único", () => {
  const f = setup();
  f.quiet();
  const d = f.defenders[0];
  const p = f.internal(d);
  const first = f.point(d, "red", 3_999);
  f.point(d, "red", 4_000);
  f.point(d, "blue", 3_999);
  assert(f.action(d, { type: "ddos:shield" }).ok);
  f.advance(3_999);
  assert.equal(p.saturation, 0);
  assert.equal(p.ddosAbsorbed, 1);
  assert.equal(p.blueSuccess, 1);
  assert(f.engine.snapshot(d)!.player!.ddosDefense!.remaining > 0);
  f.advance(1);
  assert.equal(p.saturation, 1);
  assert.equal(f.engine.snapshot(d)!.player!.ddosDefense!.remaining, 0);
  f.advance(100);
  assert.equal(p.saturation, 1);
  assert.equal(p.ddosAbsorbed, 1);
  assert.equal(f.action(d, { type: "ddos:tap", pointId: first.id }).ok, false);
  f.advance(4_900);
  assert.equal(
    p.saturation,
    0,
    "se conserva la recuperación de cinco segundos",
  );
});

test("P5: absorción usa el tiempo del impacto, independiente de la granularidad del tick", () => {
  const f = setup();
  f.quiet();
  const d = f.defenders[0];
  f.point(d, "red", 3_999);
  assert(f.action(d, { type: "ddos:shield" }).ok);
  f.advance(4_100);
  assert.equal(f.internal(d).saturation, 0);
  assert.equal(f.internal(d).ddosAbsorbed, 1);
});

test("P5: pausa congela escudo y oleada; reiniciar limpia capacidades y señales antiguas", () => {
  const f = setup();
  f.quiet();
  const d = f.defenders[0];
  assert(f.solve().ok);
  assert(f.wave().ok);
  f.advance(100);
  assert(f.action(d, { type: "ddos:shield" }).ok);
  f.advance(1_000);
  const before = f.engine.snapshot(d)!.player!.ddosDefense!;
  const ids = f.internal(d).traffic.map((p) => p.id);
  assert(f.command("pause").ok);
  f.advance(20_000);
  assert.deepEqual(f.engine.snapshot(d)!.player!.ddosDefense, before);
  assert.equal(f.wave().ok, false);
  assert.equal(f.action(d, { type: "ddos:shield" }).ok, false);
  assert(f.command("resume").ok);
  f.advance(2_900);
  assert.equal(f.internal(d).ddosAbsorbed, 3);
  assert(f.command("restart").ok);
  assert(f.command("start").ok);
  f.advance(5_000);
  assert.equal(f.internal(d).ddosShieldUsed, false);
  assert.equal(f.internal(d).ddosAbsorbed, 0);
  assert.equal(f.internal(f.impostor).ddosChallenge!.solved, false);
  assert.equal(f.internal(f.impostor).ddosChallenge!.waveUsed, false);
  assert.equal(f.engine.snapshot(f.admin)!.public.ddos, undefined);
  assert.equal(f.action(d, { type: "ddos:tap", pointId: ids[0] }).ok, false);
});

test("P5: reto variable privado, respuestas inválidas, fallo y espera lógica", () => {
  const answers = new Set<string>(),
    variants = new Set<string>();
  for (const seed of [1, 2, 4, 8, 16, 32, 64, 128]) {
    const f = setup(4, 90, seed),
      p = f.internal(f.impostor),
      c = p.ddosChallenge!;
    answers.add(c.answer);
    variants.add(JSON.stringify(c.patterns));
    assert.equal(
      f.engine.snapshot(f.defenders[0])!.player!.ddosChallenge,
      undefined,
    );
    const publicJson = JSON.stringify(f.engine.snapshot(f.admin)!.public);
    for (const value of ["patterns", "answer", "waveUsed", f.impostor.token])
      assert(!publicJson.includes(value));
    const privateView = f.engine.snapshot(f.impostor)!.player!.ddosChallenge!;
    assert(!JSON.stringify(privateView).includes('"answer"'));
    assert.equal(
      c.patterns.filter((p) => p.requests.every((n) => n / p.clients > 20))
        .length,
      1,
    );
    assert.equal(
      f.action(f.defenders[0], {
        type: "ddos:challenge-solve",
        answer: c.answer,
      }).ok,
      false,
    );
    assert.equal(
      f.action(f.impostor, { type: "ddos:challenge-solve", answer: "unknown" })
        .ok,
      false,
    );
    const wrong = c.patterns.find((p) => p.id !== c.answer)!.id;
    assert.equal(
      f.action(f.impostor, { type: "ddos:challenge-solve", answer: wrong }).ok,
      false,
    );
    assert.equal(f.solve().ok, false);
    assert.equal(c.solved, false);
    assert(f.command("pause").ok);
    f.advance(8_000);
    assert.equal(
      f.engine.snapshot(f.impostor)!.player!.ddosChallenge!.retryIn,
      3,
    );
    assert(f.command("resume").ok);
    f.advance(3_000);
    assert(f.solve().ok);
    assert.equal(f.solve().ok, false);
  }
  assert(answers.size > 1);
  assert(variants.size > 3);
});

test("P5: oleada autoritativa de tres señales separadas, una ejecución y sin origen público", () => {
  const f = setup();
  f.quiet();
  const d = f.defenders[0];
  assert.equal(f.wave().ok, false);
  assert(f.solve().ok);
  assert.equal(
    f.action(d, { type: "ddos:wave", target: f.internal(d).department }).ok,
    false,
  );
  assert.equal(f.wave("missing").ok, false);
  assert.equal(f.wave(f.internal(f.impostor).department).ok, false);
  assert(f.wave(f.internal(d).department, "wave-once").ok);
  const points = [...f.internal(d).traffic];
  assert.equal(points.length, 3);
  assert.equal(new Set(points.map((p) => p.id)).size, 3);
  for (const point of points) {
    assert.equal(point.kind, "red");
    assert.equal(point.arrives - point.born, 4_000);
  }
  for (let i = 0; i < points.length; i++)
    for (let j = 0; j < i; j++) {
      const a = Math.abs(points[i].angle - points[j].angle);
      assert(Math.min(a, Math.PI * 2 - a) >= 0.65);
    }
  assert(f.wave(f.internal(d).department, "wave-once").ok);
  assert.equal(f.internal(d).traffic.length, 3);
  assert.equal(f.wave().ok, false);
  assert.deepEqual(f.engine.snapshot(f.admin)!.public.ddos, {
    waveAlert: true,
  });
  const alert = JSON.stringify(f.engine.snapshot(f.admin)!.public.ddos);
  for (const secret of [
    "target",
    "origin",
    "patterns",
    f.internal(d).department,
    f.impostor.token,
  ])
    assert(!alert.includes(secret));
  f.advance(6_000);
  assert.equal(f.engine.snapshot(f.admin)!.public.ddos, undefined);
});

test("P5: objetivos ausentes, bloqueados y reincorporados se rechazan sin consumir oleada", () => {
  const f = setup(6);
  f.quiet();
  assert(f.solve().ok);
  const [off, blocked, waiting, valid] = f.defenders;
  f.internal(off).connected = false;
  f.internal(blocked).blocked = true;
  f.internal(waiting).waitUntilNextRound = f.room.roundNonce;
  for (const d of [off, blocked, waiting])
    assert.equal(f.wave(f.internal(d).department).ok, false);
  assert.equal(f.internal(f.impostor).ddosChallenge!.waveUsed, false);
  const targets = f.engine
    .snapshot(f.impostor)!
    .player!.ddosChallenge!.targets.map((p) => p.department);
  for (const d of [off, blocked, waiting])
    assert(!targets.includes(f.internal(d).department));
  assert(f.wave(f.internal(valid).department).ok);
});

test("P5: oleada completa y parcial se interceptan; escudo oportuno absorbe y temprano se agota", () => {
  for (const intercepted of [0, 1, 3])
    for (const shield of ["none", "early", "timely"]) {
      const f = setup();
      f.quiet();
      const d = f.defenders[0],
        p = f.internal(d);
      assert(f.solve().ok);
      if (shield === "early") {
        assert(f.action(d, { type: "ddos:shield" }).ok);
        f.advance(5_000);
      }
      assert(f.wave().ok);
      const signals = [...p.traffic];
      for (const signal of signals.slice(0, intercepted))
        assert(f.action(d, { type: "ddos:tap", pointId: signal.id }).ok);
      if (shield === "timely") {
        f.advance(500);
        assert(f.action(d, { type: "ddos:shield" }).ok);
        f.advance(3_500);
      } else f.advance(4_000);
      assert.equal(p.saturation, shield === "timely" ? 0 : 3 - intercepted);
      assert.equal(p.ddosAbsorbed, shield === "timely" ? 3 - intercepted : 0);
      assert.equal(p.blocked, false);
    }
});

test("P5: inactividad solo con naranja interceptable, escudo y azul no penalizan", () => {
  const f = setup();
  f.quiet();
  const d = f.defenders[0],
    p = f.internal(d);
  f.point(d, "blue", 20_000);
  f.advance(8_000);
  assert.equal(p.inactivityPenalties, 0);
  f.point(d, "red", 20_000);
  f.advance(100); // La señal de la fixture queda elegible en el primer tick.
  f.advance(4_999);
  const deadline = p.nextIdleAt;
  assert.equal(
    f.action(d, { type: "ddos:tap", pointId: "rejected" }).ok,
    false,
  );
  assert.equal(p.nextIdleAt, deadline);
  f.advance(1);
  assert.equal(p.inactivityPenalties, 1);
  assert(f.action(d, { type: "ddos:shield" }).ok);
  f.advance(3_999);
  assert.equal(p.inactivityPenalties, 1);
  f.advance(1);
  const armed = p.nextIdleAt;
  assert(armed > f.room.clock);
  f.advance(4_999);
  assert.equal(p.inactivityPenalties, 1);
  f.advance(1);
  assert.equal(p.inactivityPenalties, 2);
  p.traffic = [];
  const future = f.point(d, "red", 20_000);
  future.born = f.room.clock + 2_000;
  assert.equal(f.action(d, { type: "ddos:tap", pointId: future.id }).ok, false);
});

test("P5: límite de oleada, último segundo de escudo y rechazo tras finalizar", () => {
  for (const remaining of [4_000, 3_999, 1_000]) {
    const f = setup(3, 30);
    f.quiet();
    assert(f.solve().ok);
    f.advance(30_000 - remaining);
    assert.equal(f.wave().ok, remaining >= 4_000);
    const d = f.defenders[0];
    assert(f.action(d, { type: "ddos:shield" }).ok);
    f.advance(remaining);
    assert(f.room.roundFinished);
    for (const s of f.players) {
      assert.equal(f.action(s, { type: "ddos:shield" }).ok, false);
      assert.equal(
        f.action(s, { type: "ddos:wave", target: f.internal(d).department }).ok,
        false,
      );
      assert.equal(
        f.action(s, { type: "ddos:tap", pointId: "expired" }).ok,
        false,
      );
    }
  }
});

test("P5: reconexión no recarga escudo ni permite acciones en la ronda abandonada", () => {
  const f = setup();
  f.quiet();
  const d = f.defenders[0];
  f.engine.bind(d, "old-ddos");
  assert(f.action(d, { type: "ddos:shield" }).ok);
  f.engine.unbind("old-ddos");
  f.advance(10_000);
  f.engine.bind(d, "new-ddos");
  const state = f.engine.resume(d).snapshot!.player!;
  assert(state.waitingForNextRound);
  assert.equal(state.ddosDefense, undefined);
  assert(f.internal(d).ddosShieldUsed);
  assert.equal(f.internal(d).inactivityPenalties, 0);
  assert.equal(f.action(d, { type: "ddos:shield" }).ok, false);
  assert(f.command("restart").ok);
  assert(!f.internal(d).ddosShieldUsed);
});

test("P5: roles, bloqueo, desconexión, pausa y briefing rechazan acciones sin consumir recursos", () => {
  const f = setup();
  f.quiet();
  const d = f.defenders[0],
    p = f.internal(d);
  p.blocked = true;
  assert.equal(f.action(d, { type: "ddos:shield" }).ok, false);
  assert(!p.ddosShieldUsed);
  p.blocked = false;
  p.connected = false;
  assert.equal(f.action(d, { type: "ddos:shield" }).ok, false);
  assert(!p.ddosShieldUsed);
  p.connected = true;
  assert(f.command("pause").ok);
  assert.equal(f.solve().ok, false);
  assert.equal(f.action(d, { type: "ddos:shield" }).ok, false);
  assert(f.command("resume").ok);
  assert(f.solve().ok);
  assert(f.command("pause").ok);
  assert.equal(f.wave().ok, false);
  assert(!f.internal(f.impostor).ddosChallenge!.waveUsed);
  assert(f.command("restart").ok);
  assert.equal(f.wave().ok, false);
  assert.equal(f.action(d, { type: "ddos:shield" }).ok, false);
});

test("P5: las malas decisiones aún permiten victoria del impostor con cupos 3–6", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = setup(capacity);
    assert(f.solve().ok);
    assert(f.wave().ok);
    for (const d of f.defenders)
      assert(f.action(d, { type: "ddos:shield" }).ok);
    f.advance(90_000);
    assert.equal(f.room.results.at(-1)!.winner, "impostor");
    assert(
      f.room.players.filter((p) => p.role === "defender" && p.blocked).length >=
        Math.min(3, capacity - 1),
    );
  }
});

test("P5: cupos 3–6 conservan victoria defensora y continuidad a revelación con capacidades usadas", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = setup(capacity, 30);
    assert(f.solve().ok);
    assert(f.wave().ok);
    for (const d of f.defenders)
      assert(f.action(d, { type: "ddos:shield" }).ok);
    for (let step = 0; step < 150; step++) {
      for (const s of f.players)
        for (const point of [...f.internal(s).traffic])
          if (point.kind === "red")
            assert(f.action(s, { type: "ddos:tap", pointId: point.id }).ok);
      f.advance(200);
    }
    assert.equal(f.room.results.at(-1)!.winner, "defenders");
    assert(f.command("next").ok);
    assert.equal(f.room.phase, "identity");
    for (const d of f.players) {
      assert.equal(f.engine.snapshot(d)!.player!.ddosDefense, undefined);
      assert.equal(f.internal(d).ddosChallenge, undefined);
    }
    assert(f.command("start").ok);
    f.advance(5_000);
    f.advance(120_000);
    assert(f.command("next").ok);
    assert(f.command("start").ok);
    f.advance(5_000);
    for (const d of f.defenders)
      assert(
        f.action(d, {
          type: "recovery:solve",
          answer: f.internal(d).fragment!.plaintext,
        }).ok,
      );
    assert(f.command("voting").ok);
    for (const s of f.players)
      assert(
        f.action(s, {
          type: "vote",
          suspect: f.internal(f.impostor).department,
          reason: "Patrón observado",
        }).ok,
      );
    assert(f.command("reveal").ok);
    assert.equal(f.room.phase, "revealed");
  }
});
