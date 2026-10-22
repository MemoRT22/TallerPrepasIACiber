import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../server/engine.js";
import {
  DEFAULT_SETTINGS,
  type GameAction,
  type Session,
} from "../shared/types.js";

function setup(capacity: 5 | 6 = 6) {
  let time = 0;
  let seed = 27;
  const engine = new GameEngine({
    now: () => time,
    random: () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    },
  });
  const created = engine.create(capacity);
  assert(created.session && created.snapshot?.admin);
  const admin = created.session;
  const invites = created.snapshot.admin.invites;
  const players: Session[] = invites.map((v) => {
    const result = engine.join({
      code: admin.code,
      slot: v.slot,
      invite: v.invite,
      name: `Prueba ${v.slot}`,
    });
    assert(result.session);
    return result.session;
  });
  let event = 0;
  const command = (command: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `cmd-${event++}`, command);
  const action = (session: Session, action: Omit<GameAction, "eventId">) =>
    engine.action(session, { eventId: `act-${event++}`, ...action });
  const advance = (ms: number) => {
    time += ms;
    engine.tick();
  };
  assert(command("assign").ok);
  const room = engine.rooms.get(admin.code)!;
  const impostor = players.find(
    (p) => engine.snapshot(p)?.player?.role === "impostor",
  )!;
  const defenders = players.filter((p) => p.token !== impostor.token);
  const phase = (desired: "mail" | "ddos" | "identity" | "recovery") => {
    assert(command("start").ok);
    advance(5_000);
    for (const name of ["mail", "ddos", "identity"] as const) {
      if (desired === name) break;
      advance(
        (name === "mail"
          ? DEFAULT_SETTINGS.mailSeconds
          : name === "ddos"
            ? DEFAULT_SETTINGS.ddosSeconds
            : DEFAULT_SETTINGS.identitySeconds) * 1000,
      );
      assert(command("next").ok);
      assert(command("start").ok);
      advance(5_000);
    }
  };
  return {
    engine,
    admin,
    invites,
    players,
    impostor,
    defenders,
    command,
    action,
    advance,
    room,
    phase,
  };
}

test("cinco puestos producen exactamente cinco dependencias públicas", () => {
  const f = setup(5);
  assert.equal(f.engine.snapshot(f.admin)?.public.departments.length, 5);
  assert.equal(f.engine.snapshot(f.admin)?.public.recovery.total, 4);
});

test("reabrir una invitación durante una ronda conserva identidad y token", () => {
  const f = setup();
  f.phase("mail");
  const invitation = f.invites[1];
  const previous = f.players[1];
  const before = f.engine.snapshot(previous)!;
  const restored = f.engine.join({
    code: previous.code,
    slot: invitation.slot,
    invite: invitation.invite,
    name: "Otro nombre",
  });
  assert.equal(restored.ok, true);
  assert.equal(restored.session?.token, previous.token);
  assert.equal(restored.snapshot?.player?.name, before.player?.name);
  assert.deepEqual(restored.snapshot?.player?.mail, before.player?.mail);
  assert.equal(
    f.engine.join({
      code: previous.code,
      slot: invitation.slot,
      invite: "incorrecto",
      name: "Otro nombre",
    }).ok,
    false,
  );
});

test("rechazar todos los correos no alcanza el 80% y los automáticos no dan victoria atacante", () => {
  const f = setup();
  f.phase("mail");
  for (const defender of f.defenders) {
    for (const mail of f.engine.snapshot(defender)!.player!.mail)
      assert(
        f.action(defender, {
          type: "mail:classify",
          cardId: mail.id,
          accept: false,
        }).ok,
      );
  }
  f.advance(300_000);
  const result = f.engine.snapshot(f.admin)!.public.results[0];
  assert.equal(result.winner, "inconclusive");
  assert(result.metric < 80);
});

test("tres correos propios aceptados dan victoria inmediata y los envíos respetan cooldown", () => {
  const f = setup();
  f.phase("mail");
  const target = f.room.players.find((p) => p.token === f.defenders[0].token)!;
  for (let i = 0; i < 3; i++) {
    assert(
      f.action(f.impostor, {
        type: "mail:send",
        target: target.department,
        templateId: "fake-security",
      }).ok,
    );
    if (i === 0)
      assert.equal(
        f.action(f.impostor, {
          type: "mail:send",
          target: target.department,
          templateId: "fake-security",
        }).ok,
        false,
      );
    const mail = target.mail.at(-1)!;
    assert(
      f.action(f.defenders[0], {
        type: "mail:classify",
        cardId: mail.id,
        accept: true,
      }).ok,
    );
    if (i < 2) f.advance(20_000);
  }
  assert.equal(
    f.engine.snapshot(f.admin)!.public.results[0].winner,
    "impostor",
  );
  assert.equal(f.engine.snapshot(f.admin)!.public.running, false);
});

test("el congelamiento de correos y el corte temporal impiden decisiones posteriores", () => {
  const f = setup();
  f.phase("mail");
  f.advance(280_000);
  const received = f.room.players.map((p) => p.mailReceived);
  assert.equal(
    f.action(f.impostor, {
      type: "mail:send",
      target: f.room.players[0].department,
      templateId: "fake-security",
    }).ok,
    false,
  );
  f.advance(20_100);
  assert.deepEqual(
    f.room.players.map((p) => p.mailReceived),
    received,
  );
  const card = f.engine.snapshot(f.defenders[0])!.player!.mail[0];
  assert.equal(
    f.action(f.defenders[0], {
      type: "mail:classify",
      cardId: card.id,
      accept: true,
    }).ok,
    false,
  );
  assert.equal(f.engine.snapshot(f.admin)!.public.clock, 300_000);
});

test("inyección de identidad usa destino aleatorio y sustituye una automática sin mover la activa", () => {
  const f = setup();
  f.phase("identity");
  const activeIds = new Map(f.room.players.map((p) => [p.token, p.card?.id]));
  const previousIds = new Set(
    f.room.players.flatMap((p) => p.pendingCards.map((c) => c.id)),
  );
  assert(
    f.action(f.impostor, { type: "identity:send", alteration: "code" }).ok,
  );
  const target = f.room.players.find((p) =>
    p.pendingCards.some((c) => !previousIds.has(c.id)),
  );
  assert(target && target.role === "defender");
  assert.equal(target.card?.id, activeIds.get(target.token));
  assert.equal(target.pendingCards.length, 2);
  const injected = target.pendingCards.find((c) => !previousIds.has(c.id))!;
  assert.notEqual(injected.reference.code, injected.presented.code);
  assert.equal(injected.legit, false);
  assert.equal(
    f.action(f.impostor, { type: "identity:send", alteration: "symbol" }).ok,
    false,
  );
});

test("una dependencia comprometida no puede seguir autorizando ni muestra nuevas tarjetas", () => {
  const f = setup();
  f.phase("identity");
  const previousIds = new Set(
    f.room.players.flatMap((p) => p.pendingCards.map((c) => c.id)),
  );
  assert(
    f.action(f.impostor, { type: "identity:send", alteration: "avatar" }).ok,
  );
  const target = f.room.players.find((p) =>
    p.pendingCards.some((c) => !previousIds.has(c.id)),
  )!;
  const session = f.players.find((p) => p.token === target.token)!;
  const oldId = target.card!.id;
  target.infiltrations = 2;
  assert(
    f.action(session, { type: "identity:decide", cardId: oldId, accept: false })
      .ok,
  );
  const falseCard = target.card!;
  assert.equal(falseCard.legit, false);
  assert(
    f.action(session, {
      type: "identity:decide",
      cardId: falseCard.id,
      accept: true,
    }).ok,
  );
  assert.equal(target.blocked, true);
  assert.equal(
    f.action(session, {
      type: "identity:decide",
      cardId: falseCard.id,
      accept: true,
    }).ok,
    false,
  );
  const shown = target.legitShown;
  f.advance(20_000);
  assert.equal(target.legitShown, shown);
  assert.equal(target.card, null);
});

test("agotar recuperación no se anuncia como recuperación completada", () => {
  const f = setup();
  f.phase("recovery");
  const impostorState = f.engine.snapshot(f.impostor)!.player!;
  assert.equal(impostorState.decoy, true);
  assert.equal(impostorState.fragment, undefined);
  assert(
    f.action(f.impostor, { type: "recovery:solve", answer: "CUALQUIER COSA" })
      .ok,
  );
  assert.equal(f.engine.snapshot(f.admin)!.public.recovery.completed, 0);
  f.advance(300_000);
  assert.equal(f.engine.snapshot(f.admin)!.public.recovery.done, false);
  assert.equal(f.engine.snapshot(f.admin)!.public.running, false);
  assert(f.command("voting").ok);
});

test("cada defensor solo completa su fragmento y el impostor no afecta el total", () => {
  const f = setup();
  f.phase("recovery");
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
  assert.equal(f.engine.snapshot(f.admin)!.public.recovery.completed, 5);
  assert.equal(f.engine.snapshot(f.admin)!.public.running, false);
  assert.equal(f.engine.snapshot(f.admin)!.public.reveal, undefined);
});

test("una acción de un correo previo al reinicio no afecta el nuevo mazo", () => {
  const f = setup();
  f.phase("mail");
  const old = f.engine.snapshot(f.defenders[0])!.player!.mail[0].id;
  assert(f.command("restart").ok);
  assert(f.command("start").ok);
  f.advance(5_000);
  assert.equal(
    f.action(f.defenders[0], {
      type: "mail:classify",
      cardId: old,
      accept: true,
    }).ok,
    false,
  );
  assert.equal(f.engine.snapshot(f.defenders[0])!.player!.mail.length, 6);
});

test("asignación inicial exige conexiones pero la ronda asignada puede iniciar con ausentes", () => {
  const engine = new GameEngine();
  const created = engine.create(5);
  const admin = created.session!;
  const sessions = created.snapshot!.admin!.invites.map(
    (v) =>
      engine.join({
        code: admin.code,
        slot: v.slot,
        invite: v.invite,
        name: `Conexión ${v.slot}`,
      }).session!,
  );
  engine.bind(sessions[0], "test-socket");
  engine.unbind("test-socket");
  assert.equal(engine.admin(admin, "disconnected-assign", "assign").ok, false);
  engine.bind(sessions[0], "test-socket-2");
  assert(engine.admin(admin, "connected-assign", "assign").ok);
  engine.unbind("test-socket-2");
  assert.equal(engine.admin(admin, "disconnected-start", "start").ok, true);
});

test("IDs de jugador se deduplican por ronda y los ACK docentes devuelven el estado actual", () => {
  const f = setup();
  f.phase("mail");
  const session = f.defenders[0];
  const oldCard = f.engine.snapshot(session)!.player!.mail[0];
  assert(
    f.engine.action(session, {
      eventId: "same-id",
      type: "mail:classify",
      cardId: oldCard.id,
      accept: true,
    }).ok,
  );
  const restart = f.engine.admin(f.admin, "restart-once", "restart");
  assert(restart.ok);
  assert(f.engine.admin(f.admin, "start-after-restart", "start").ok);
  f.advance(5_000);
  const newCard = f.engine.snapshot(session)!.player!.mail[0];
  assert(
    f.engine.action(session, {
      eventId: "same-id",
      type: "mail:classify",
      cardId: newCard.id,
      accept: true,
    }).ok,
  );
  assert.equal(f.engine.snapshot(session)!.player!.mail.length, 5);
  f.advance(1000);
  const duplicateRestart = f.engine.admin(f.admin, "restart-once", "restart");
  assert.equal(duplicateRestart.snapshot!.public.clock, 1000);
  assert.equal(f.engine.snapshot(session)!.player!.mail.length, 5);
});

test("cada rojo eliminado por el impostor genera exactamente un rojo en un defensor activo", () => {
  const f = setup();
  f.phase("ddos");
  const impostor = f.room.players.find((p) => p.token === f.impostor.token)!;
  const point = impostor.traffic[0];
  point.kind = "red";
  const before = f.room.players
    .filter((p) => p.role === "defender")
    .reduce((sum, p) => sum + p.traffic.length, 0);
  assert(f.action(f.impostor, { type: "ddos:tap", pointId: point.id }).ok);
  const after = f.room.players
    .filter((p) => p.role === "defender")
    .reduce((sum, p) => sum + p.traffic.length, 0);
  assert.equal(after, before + 1);
  assert(!impostor.traffic.some((p) => p.id === point.id));
});

test("un impacto rojo llena un segmento y cinco segundos sin impacto liberan uno", () => {
  const f = setup();
  f.phase("ddos");
  f.room.ddosNextSpawn = 1_000_000;
  for (const p of f.room.players) p.traffic = [];
  const target = f.room.players.find((p) => p.token === f.defenders[0].token)!;
  target.traffic.push({
    id: "red-test",
    kind: "red",
    angle: 0,
    born: -3000,
    arrives: 1000,
    ownerToken: target.token,
  });
  f.advance(1000);
  assert.equal(target.saturation, 1);
  f.advance(4999);
  assert.equal(target.saturation, 1);
  f.advance(1);
  assert.equal(target.saturation, 0);
});

test("tres servidores denegados dan victoria inmediata pero la saturación del impostor nunca lo elimina", () => {
  const f = setup();
  f.phase("ddos");
  f.room.ddosNextSpawn = 1_000_000;
  for (const p of f.room.players) p.traffic = [];
  const targets = [f.impostor, ...f.defenders.slice(0, 3)];
  for (const session of targets) {
    const target = f.room.players.find((p) => p.token === session.token)!;
    for (let i = 0; i < 10; i++)
      target.traffic.push({
        id: `red-${target.slot}-${i}`,
        kind: "red",
        angle: i * 0.5,
        born: -3000,
        arrives: 1000,
        ownerToken: target.token,
      });
  }
  f.advance(1000);
  const impostor = f.room.players.find((p) => p.token === f.impostor.token)!;
  assert.equal(impostor.saturation, 10);
  assert.equal(impostor.blocked, false);
  assert.equal(
    f.engine.snapshot(f.admin)!.public.results.at(-1)?.winner,
    "impostor",
  );
  assert.equal(f.engine.snapshot(f.admin)!.public.running, false);
});
