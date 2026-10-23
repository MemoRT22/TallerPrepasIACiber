import test from "node:test";
import assert from "node:assert/strict";
import { cipherCesar, GameEngine } from "../server/engine.js";
import {
  DEFAULT_SETTINGS,
  type GameAction,
  type Session,
} from "../shared/types.js";

function setup(capacity: 3 | 4 | 5 | 6 = 6, initialSeed = 71) {
  let now = 0;
  let seed = initialSeed;
  let event = 0;
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
    (invite) =>
      engine.join({
        code: admin.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `P${invite.slot}`,
      }).session!,
  );
  const command = (value: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `c-${event++}`, value);
  const action = (session: Session, value: Omit<GameAction, "eventId">) =>
    engine.action(session, { eventId: `a-${event++}`, ...value });
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  assert(command("assign").ok);
  const impostor = players.find(
    (session) => engine.snapshot(session)!.player!.role === "impostor",
  )!;
  const defenders = players.filter(
    (session) => session.token !== impostor.token,
  );
  const room = engine.rooms.get(admin.code)!;
  const toRecovery = () => {
    assert(command("start").ok);
    advance(5_000);
    for (const seconds of [
      DEFAULT_SETTINGS.mailSeconds,
      DEFAULT_SETTINGS.ddosSeconds,
      DEFAULT_SETTINGS.identitySeconds,
    ]) {
      advance(seconds * 1_000);
      assert(command("next").ok);
      assert(command("start").ok);
      advance(5_000);
    }
  };
  return {
    engine,
    admin,
    players,
    impostor,
    defenders,
    room,
    command,
    action,
    advance,
    toRecovery,
  };
}

test("el reto privado desbloquea una sola alteración sin filtrar identidades", () => {
  const f = setup();
  assert.equal(
    f.action(f.impostor, { type: "recovery:challenge-solve", answer: "ALERTA" })
      .ok,
    false,
  );
  f.toRecovery();
  const privateState = f.engine.snapshot(f.impostor)!.player!;
  assert(privateState.recoveryChallenge);
  assert.equal(privateState.fragment, undefined);
  for (const defender of f.defenders)
    assert.equal(
      f.engine.snapshot(defender)!.player!.recoveryChallenge,
      undefined,
    );
  assert.equal(
    "recoveryChallenge" in f.engine.snapshot(f.admin)!.public,
    false,
  );

  assert.equal(
    f.action(f.impostor, {
      type: "recovery:challenge-solve",
      answer: "INCORRECTA",
    }).ok,
    false,
  );
  assert.equal(
    f.engine.snapshot(f.impostor)!.player!.recoveryChallenge!.sabotageAvailable,
    false,
  );
  const internalImpostor = f.room.players.find(
    (player) => player.token === f.impostor.token,
  )!;
  assert(
    f.action(f.impostor, {
      type: "recovery:challenge-solve",
      answer: internalImpostor.recoveryChallenge!.answer,
    }).ok,
  );
  assert.equal(
    f.action(f.impostor, {
      type: "recovery:challenge-solve",
      answer: internalImpostor.recoveryChallenge!.answer,
    }).ok,
    false,
  );

  const solved = f.defenders[0];
  const solvedInternal = f.room.players.find(
    (player) => player.token === solved.token,
  )!;
  assert(
    f.action(solved, {
      type: "recovery:solve",
      answer: solvedInternal.fragment!.answer,
    }).ok,
  );
  assert.equal(
    f.action(f.impostor, {
      type: "recovery:sabotage",
      target: solvedInternal.department,
    }).ok,
    false,
  );

  const absent = f.room.players.find(
    (player) => player.token === f.defenders[2].token,
  )!;
  absent.connected = false;
  assert.equal(
    f.action(f.impostor, {
      type: "recovery:sabotage",
      target: absent.department,
    }).ok,
    false,
  );

  const target = f.defenders[1];
  const targetInternal = f.room.players.find(
    (player) => player.token === target.token,
  )!;
  const originalAnswer = targetInternal.fragment!.answer;
  assert(
    f.action(f.impostor, {
      type: "recovery:sabotage",
      target: targetInternal.department,
    }).ok,
  );
  assert.equal(targetInternal.fragment!.shift, 5);
  assert.equal(
    targetInternal.fragment!.cipher,
    cipherCesar(targetInternal.fragment!.plaintext, 5),
  );
  assert.equal(targetInternal.fragment!.answer, originalAnswer);
  const affectedSnapshot = f.engine.snapshot(target)!.player!.fragment!;
  assert.equal(affectedSnapshot.shift, undefined);
  assert.equal(affectedSnapshot.verifiedShift, undefined);
  assert.deepEqual(affectedSnapshot.candidateShifts, [3, 5, 7]);
  assert.deepEqual(
    Object.keys(f.engine.snapshot(f.admin)!.public.recovery).sort(),
    ["completed", "done", "integrityAlert", "total"],
  );
  assert.equal(f.engine.snapshot(target)!.player!.fragment!.altered, true);
  assert.equal(
    f.engine.snapshot(f.defenders[2])!.player!.fragment!.altered,
    false,
  );
  assert.equal(
    f.action(f.impostor, {
      type: "recovery:sabotage",
      target: f.room.players.find((p) => p.token === f.defenders[3].token)!
        .department,
    }).ok,
    false,
  );
  f.advance(6_000);
  assert.equal(
    f.engine.snapshot(f.admin)!.public.recovery.integrityAlert,
    undefined,
  );
  assert(
    f.action(target, { type: "recovery:solve", answer: originalAnswer }).ok,
  );
});

test("verificar cuesta tres segundos lógicos y la pausa congela la espera", () => {
  const f = setup();
  f.toRecovery();
  const internalImpostor = f.room.players.find(
    (p) => p.token === f.impostor.token,
  )!;
  assert(
    f.action(f.impostor, {
      type: "recovery:challenge-solve",
      answer: internalImpostor.recoveryChallenge!.answer,
    }).ok,
  );
  const target = f.defenders[0];
  const internal = f.room.players.find((p) => p.token === target.token)!;
  assert(
    f.action(f.impostor, {
      type: "recovery:sabotage",
      target: internal.department,
    }).ok,
  );
  assert(f.action(target, { type: "recovery:verify" }).ok);
  assert.equal(f.action(target, { type: "recovery:verify" }).ok, false);
  assert.equal(f.engine.snapshot(target)!.player!.fragment!.shift, undefined);
  assert.deepEqual(
    f.engine.snapshot(target)!.player!.fragment!.candidateShifts,
    [3, 5, 7],
  );
  assert.equal(
    f.action(target, {
      type: "recovery:solve",
      answer: internal.fragment!.answer,
    }).ok,
    false,
  );
  assert(f.command("pause").ok);
  f.advance(2_000);
  assert.equal(
    f.engine.snapshot(target)!.player!.fragment!.verificationRemaining,
    3,
  );
  assert(f.command("resume").ok);
  f.advance(3_000);
  assert.equal(f.engine.snapshot(target)!.player!.fragment!.verifiedShift, 5);
  assert.equal(
    f.engine.snapshot(target)!.player!.fragment!.candidateShifts,
    undefined,
  );
  assert(
    f.action(target, {
      type: "recovery:solve",
      answer: internal.fragment!.answer,
    }).ok,
  );
  assert(f.command("restart").ok);
  assert.equal(
    f.engine.snapshot(f.impostor)!.player!.recoveryChallenge,
    undefined,
  );
  assert.equal(
    f.engine.snapshot(f.admin)!.public.recovery.integrityAlert,
    undefined,
  );
});

test("el microreto se elige de un conjunto variable por partida", () => {
  const variants = new Set<string>();
  for (let seed = 1; seed <= 8; seed += 1) {
    const f = setup(3, seed);
    f.toRecovery();
    variants.add(
      f.engine.snapshot(f.impostor)!.player!.recoveryChallenge!.cipher,
    );
  }
  assert(variants.size > 1);
});

test("la recuperación con sabotaje continúa a votación y revelado de 3 a 6 jugadores", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = setup(capacity);
    f.toRecovery();
    const internalImpostor = f.room.players.find(
      (p) => p.token === f.impostor.token,
    )!;
    assert(
      f.action(f.impostor, {
        type: "recovery:challenge-solve",
        answer: internalImpostor.recoveryChallenge!.answer,
      }).ok,
    );
    const target = f.room.players.find(
      (p) => p.token === f.defenders[0].token,
    )!;
    assert(
      f.action(f.impostor, {
        type: "recovery:sabotage",
        target: target.department,
      }).ok,
    );
    for (const defender of f.defenders) {
      const internal = f.room.players.find((p) => p.token === defender.token)!;
      assert(
        f.action(defender, {
          type: "recovery:solve",
          answer: internal.fragment!.answer,
        }).ok,
      );
    }
    assert.equal(f.engine.snapshot(f.admin)!.public.recovery.done, true);
    assert(f.command("voting").ok);
    for (const player of f.players)
      assert(
        f.action(player, {
          type: "vote",
          suspect: internalImpostor.department,
          reason: "Señal observada",
        }).ok,
      );
    assert(f.command("reveal").ok);
    assert.equal(f.engine.snapshot(f.admin)!.public.phase, "revealed");
  }
});
