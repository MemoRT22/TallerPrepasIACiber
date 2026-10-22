import assert from "node:assert/strict";
import test from "node:test";
import {
  GameEngine,
  IMPOSTOR_TEMPLATES,
  OFFICIAL_TEMPLATES,
} from "../server/engine.js";
import type { GameAction, Session } from "../shared/types.js";

type Fixture = {
  engine: GameEngine;
  admin: Session;
  players: Session[];
  room: any;
  now: () => number;
  advance: (ms: number) => void;
  command: (
    command: Parameters<GameEngine["admin"]>[2],
    id?: string,
  ) => ReturnType<GameEngine["admin"]>;
  action: (
    session: Session,
    action: Omit<GameAction, "eventId">,
    id?: string,
  ) => ReturnType<GameEngine["action"]>;
};

function fixture(capacity = 4): Fixture {
  let time = 0;
  const engine = new GameEngine({ now: () => time, random: () => 0.37 });
  const created = engine.create(capacity as 3 | 4 | 5 | 6);
  assert(created.session?.kind === "admin");
  const admin = created.session;
  const players = (created.snapshot?.admin?.invites ?? []).map((invite) => {
    const joined = engine.join({
      code: admin.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `Prueba ${invite.slot}`,
    });
    assert(joined.session?.kind === "player");
    return joined.session;
  });
  let event = 0;
  const command = (
    commandName: Parameters<GameEngine["admin"]>[2],
    id = `admin-${++event}`,
  ) => engine.admin(admin, id, commandName);
  const action = (
    session: Session,
    payload: Omit<GameAction, "eventId">,
    id = `action-${++event}`,
  ) => engine.action(session, { eventId: id, ...payload });
  assert(command("assign").ok);
  return {
    engine,
    admin,
    players,
    room: engine.rooms.get(admin.code)!,
    now: () => time,
    advance: (ms) => {
      time += ms;
      engine.tick();
    },
    command,
    action,
  };
}

function startMail(fx: Fixture): void {
  assert(fx.command("start").ok);
  fx.advance(5_000);
  assert.equal(fx.room.stage, "playing");
  assert.equal(fx.room.phase, "mail");
}

function startDdos(fx: Fixture, seconds = 20): void {
  fx.room.settings.mailSeconds = 1;
  fx.room.settings.ddosSeconds = seconds;
  startMail(fx);
  fx.advance(1_000);
  assert.equal(fx.room.stage, "finished");
  assert(fx.command("next").ok);
  assert(fx.command("start").ok);
  fx.advance(5_000);
  assert.equal(fx.room.phase, "ddos");
  assert.equal(fx.room.stage, "playing");
  fx.room.ddosNextSpawn = Number.MAX_SAFE_INTEGER;
  for (const player of fx.room.players) player.traffic = [];
}

function startIdentity(fx: Fixture): void {
  fx.room.settings.mailSeconds = 1;
  fx.room.settings.ddosSeconds = 1;
  fx.room.settings.identitySeconds = 20;
  startMail(fx);
  fx.advance(1_000);
  assert(fx.command("next").ok);
  assert(fx.command("start").ok);
  fx.advance(5_000);
  fx.advance(1_000);
  assert.equal(fx.room.stage, "finished");
  assert(fx.command("next").ok);
  assert(fx.command("start").ok);
  fx.advance(5_000);
  assert.equal(fx.room.phase, "identity");
  assert.equal(fx.room.stage, "playing");
}

function playerFor(fx: Fixture, session: Session): any {
  return fx.room.players.find((player: any) => player.token === session.token)!;
}

function sessionWithRole(fx: Fixture, role: "defender" | "impostor"): Session {
  return fx.players.find(
    (session) => fx.engine.snapshot(session)?.player?.role === role,
  )!;
}

function addPoint(fx: Fixture, session: Session, kind: "blue" | "red"): string {
  const player = playerFor(fx, session);
  const id = `manual-${kind}-${fx.room.ddosSequence++}`;
  player.traffic.push({
    id,
    kind,
    angle: 0,
    born: fx.room.clock,
    arrives: fx.room.clock + 4_000,
    ownerToken: player.token,
  });
  return id;
}

function trafficCount(fx: Fixture, session: Session): number {
  return playerFor(fx, session).traffic.length;
}

test("hacker mail: selector privado, oficiales del defensor, ambos templates y self-target sin mutación", () => {
  const fx = fixture();
  startMail(fx);
  const hacker = sessionWithRole(fx, "impostor");
  const defender = sessionWithRole(fx, "defender");
  const other = fx.players.find(
    (session) =>
      session.token !== hacker.token && session.token !== defender.token,
  )!;
  const hackerView = fx.engine.snapshot(hacker)!.player!;
  const defenderView = fx.engine.snapshot(defender)!.player!;
  assert.deepEqual(
    defenderView.templates.map((template) => template.id),
    OFFICIAL_TEMPLATES.map((template) => template.id),
  );
  assert.deepEqual(
    hackerView.templates.map((template) => template.id),
    [...OFFICIAL_TEMPLATES, ...IMPOSTOR_TEMPLATES].map(
      (template) => template.id,
    ),
  );
  const hackerInternal = playerFor(fx, hacker);
  const beforeSelfMail = hackerInternal.mail.length;
  const self = fx.action(hacker, {
    type: "mail:send",
    target: hackerInternal.department,
    templateId: IMPOSTOR_TEMPLATES[0].id,
  });
  assert.equal(self.ok, false);
  assert.equal(hackerInternal.mail.length, beforeSelfMail);
  assert.equal(hackerInternal.mailCooldownUntil, 0);
  const fake = fx.action(hacker, {
    type: "mail:send",
    target: playerFor(fx, defender).department,
    templateId: IMPOSTOR_TEMPLATES[0].id,
  });
  assert.equal(fake.ok, true);
  fx.advance(20_000);
  assert(
    fx.action(hacker, {
      type: "mail:send",
      target: playerFor(fx, other).department,
      templateId: OFFICIAL_TEMPLATES[0].id,
    }).ok,
  );
  const defenderFake = fx.action(defender, {
    type: "mail:send",
    target: playerFor(fx, other).department,
    templateId: IMPOSTOR_TEMPLATES[0].id,
  });
  assert.equal(defenderFake.ok, false);
  assert.equal(playerFor(fx, defender).mailCooldownUntil, 0);
  const publicJson = JSON.stringify(fx.engine.snapshot(fx.admin)!.public);
  assert(!publicJson.includes("senderToken"));
  assert(!publicJson.includes("ownerToken"));
});

test("DDoS rojo: 10.001ms inyecta uno, 10.000ms inyecta exactamente tres, azul no inyecta y cero no acepta", () => {
  const fx = fixture(4);
  startDdos(fx);
  const hacker = sessionWithRole(fx, "impostor");
  const defenders = fx.players.filter(
    (session) => session.token !== hacker.token,
  );
  fx.advance(9_999);
  const prePoint = addPoint(fx, hacker, "red");
  const beforePre = defenders.reduce(
    (sum, defender) => sum + trafficCount(fx, defender),
    0,
  );
  assert(fx.action(hacker, { type: "ddos:tap", pointId: prePoint }).ok);
  const afterPre = defenders.reduce(
    (sum, defender) => sum + trafficCount(fx, defender),
    0,
  );
  assert.equal(afterPre - beforePre, 1);

  assert(fx.command("restart").ok);
  assert(fx.command("start").ok);
  fx.advance(5_000);
  fx.room.ddosNextSpawn = Number.MAX_SAFE_INTEGER;
  for (const player of fx.room.players) player.traffic = [];
  fx.advance(10_000);
  const finalPoint = addPoint(fx, hacker, "red");
  assert(fx.action(hacker, { type: "ddos:tap", pointId: finalPoint }).ok);
  const finalCounts = defenders.map((defender) => trafficCount(fx, defender));
  assert.equal(
    finalCounts.reduce((sum, count) => sum + count, 0),
    3,
  );
  assert.equal(finalCounts.filter((count) => count > 0).length, 3);

  fx.advance(10_000);
  assert.equal(fx.room.stage, "finished");
  const beforeZero = defenders.reduce(
    (sum, defender) => sum + trafficCount(fx, defender),
    0,
  );
  const zeroPoint = addPoint(fx, hacker, "red");
  assert.equal(
    fx.action(hacker, { type: "ddos:tap", pointId: zeroPoint }).ok,
    false,
  );
  assert.equal(
    defenders.reduce((sum, defender) => sum + trafficCount(fx, defender), 0),
    beforeZero,
  );

  const blueFx = fixture(4);
  startDdos(blueFx);
  const blueHacker = sessionWithRole(blueFx, "impostor");
  const blueDefenders = blueFx.players.filter(
    (session) => session.token !== blueHacker.token,
  );
  blueFx.advance(10_000);
  const bluePoint = addPoint(blueFx, blueHacker, "blue");
  assert(
    blueFx.action(blueHacker, { type: "ddos:tap", pointId: bluePoint }).ok,
  );
  assert.equal(
    blueDefenders.reduce(
      (sum, defender) => sum + trafficCount(blueFx, defender),
      0,
    ),
    0,
  );
});

test("DDoS final: reparto cíclico total, exclusión offline/bloqueado, un destino recibe los tres y deduplicación", () => {
  const fx = fixture(5);
  startDdos(fx);
  const hacker = sessionWithRole(fx, "impostor");
  const defenders = fx.players.filter(
    (session) => session.token !== hacker.token,
  );
  const available = defenders.slice(0, 2);
  for (const player of fx.room.players) player.traffic = [];
  for (const excluded of defenders.slice(2)) {
    const internal = playerFor(fx, excluded);
    internal.connected = excluded === defenders[2] ? false : true;
    internal.blocked = excluded !== defenders[2];
  }
  fx.advance(10_000);
  const point = addPoint(fx, hacker, "red");
  assert(
    fx.action(hacker, { type: "ddos:tap", pointId: point }, "same-red").ok,
  );
  assert.equal(
    trafficCount(fx, available[0]) + trafficCount(fx, available[1]),
    3,
  );
  assert.equal(trafficCount(fx, defenders[2]), 0);
  assert.equal(trafficCount(fx, defenders[3]), 0);
  const duplicate = fx.action(
    hacker,
    { type: "ddos:tap", pointId: point },
    "same-red",
  );
  assert.equal(duplicate.ok, true);
  assert.equal(
    trafficCount(fx, available[0]) + trafficCount(fx, available[1]),
    3,
  );

  playerFor(fx, available[1]).blocked = true;
  const beforeSingle = trafficCount(fx, available[0]);
  const singlePoint = addPoint(fx, hacker, "red");
  assert(fx.action(hacker, { type: "ddos:tap", pointId: singlePoint }).ok);
  assert.equal(trafficCount(fx, available[0]), beforeSingle + 3);
  assert.equal(trafficCount(fx, available[1]), 1);
});

test("inactividad: 4.999/5.000/10 segundos, acción válida reinicia el periodo y duplicada/rechazada no", () => {
  const fx = fixture();
  startMail(fx);
  const defender = sessionWithRole(fx, "defender");
  fx.advance(4_999);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
  fx.advance(1);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 1);
  fx.advance(5_000);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 2);

  const card = fx.engine.snapshot(defender)!.player!.mail[0];
  assert(
    fx.action(
      defender,
      { type: "mail:classify", cardId: card.id, accept: true },
      "valid-reset",
    ).ok,
  );
  fx.advance(4_999);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 2);
  assert(
    fx.action(
      defender,
      { type: "mail:classify", cardId: card.id, accept: false },
      "valid-reset",
    ).ok,
  );
  fx.advance(1);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 3);

  const rejectedCard = fx.engine.snapshot(defender)!.player!.mail[0];
  assert.equal(
    fx.action(
      defender,
      { type: "mail:classify", cardId: "missing-card", accept: true },
      "rejected",
    ).ok,
    false,
  );
  fx.advance(4_999);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 3);
  fx.advance(1);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 4);
  assert(rejectedCard);
});

test("inactividad no cobra cola vacía, arma el primer item y continúa cada 5s", () => {
  const fx = fixture();
  startMail(fx);
  const defender = sessionWithRole(fx, "defender");
  for (const mail of [...fx.engine.snapshot(defender)!.player!.mail])
    assert(
      fx.action(defender, {
        type: "mail:classify",
        cardId: mail.id,
        accept: true,
      }).ok,
    );
  assert.equal(fx.engine.snapshot(defender)!.player!.mail.length, 0);
  fx.advance(19_999);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
  fx.advance(1);
  assert.equal(fx.engine.snapshot(defender)!.player!.mail.length > 0, true);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
  fx.advance(4_999);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
  fx.advance(1);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 1);
});

test("inactividad excluye countdown, pausa y offline, y reinicia contador en nueva fase", () => {
  const fx = fixture();
  assert(fx.command("start").ok);
  fx.advance(4_999);
  const defender = sessionWithRole(fx, "defender");
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
  fx.advance(1);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
  fx.advance(4_000);
  assert(fx.command("pause").ok);
  fx.advance(10_000);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
  assert(fx.command("resume").ok);
  fx.advance(1_000);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 1);

  playerFor(fx, defender).connected = false;
  fx.advance(10_000);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 1);
  assert(fx.command("restart").ok);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
  assert(fx.command("start").ok);
  fx.advance(5_000);
  assert.equal(fx.engine.snapshot(defender)!.player!.inactivityPenalties, 0);
});

test("inactividad cuenta decisiones pendientes sin penalizar la espera correcta de tráfico azul", () => {
  const mailFx = fixture();
  startMail(mailFx);
  const hacker = sessionWithRole(mailFx, "impostor");
  mailFx.advance(5_000);
  assert.equal(mailFx.engine.snapshot(hacker)!.player!.inactivityPenalties, 1);
  assert.equal(
    mailFx.engine
      .snapshot(mailFx.admin)!
      .admin!.players.find((p) => p.id === "player-2")!.inactivityPenalties,
    1,
  );
  assert(
    !JSON.stringify(mailFx.engine.snapshot(mailFx.admin)!.public).includes(
      "inactivityPenalties",
    ),
  );

  const ddosFx = fixture();
  startDdos(ddosFx);
  const ddosDefender = sessionWithRole(ddosFx, "defender");
  const ddosPlayer = playerFor(ddosFx, ddosDefender);
  ddosPlayer.traffic.push({
    id: "idle-ddos-point",
    kind: "blue",
    angle: 0,
    born: ddosFx.room.clock,
    arrives: ddosFx.room.clock + 10_000,
    ownerToken: ddosPlayer.token,
  });
  ddosPlayer.inactivityEligible = true;
  ddosPlayer.nextIdleAt = ddosFx.room.clock + 5_000;
  ddosFx.advance(5_000);
  assert.equal(
    ddosFx.engine.snapshot(ddosDefender)!.player!.inactivityPenalties,
    0,
  );
  ddosPlayer.traffic.push({
    id: "idle-ddos-red-point",
    kind: "red",
    angle: 1,
    born: ddosFx.room.clock,
    arrives: ddosFx.room.clock + 10_000,
    ownerToken: ddosPlayer.token,
  });
  ddosPlayer.inactivityEligible = true;
  ddosPlayer.nextIdleAt = ddosFx.room.clock + 5_000;
  ddosFx.advance(5_000);
  assert.equal(
    ddosFx.engine.snapshot(ddosDefender)!.player!.inactivityPenalties,
    1,
  );

  const identityFx = fixture();
  startIdentity(identityFx);
  const identityDefender = sessionWithRole(identityFx, "defender");
  identityFx.advance(5_000);
  assert.equal(
    identityFx.engine.snapshot(identityDefender)!.player!.inactivityPenalties,
    1,
  );
});

test("penalizaciones de defensor entran solo al denominador de precisión de las tres fases", () => {
  const mailFx = fixture();
  startMail(mailFx);
  const mailDefender = sessionWithRole(mailFx, "defender");
  for (const player of mailFx.room.players) {
    player.mailReceived = 0;
    player.mailCorrect = 0;
    player.inactivityPenalties = 0;
  }
  playerFor(mailFx, mailDefender).mailReceived = 1;
  playerFor(mailFx, mailDefender).mailCorrect = 1;
  playerFor(mailFx, mailDefender).inactivityPenalties = 1;
  playerFor(mailFx, sessionWithRole(mailFx, "impostor")).inactivityPenalties =
    99;
  mailFx.room.settings.mailSeconds = 1;
  mailFx.advance(1_000);
  assert.equal(
    mailFx.engine.snapshot(mailFx.admin)!.public.results.at(-1)!.metric,
    50,
  );

  const ddosFx = fixture();
  startDdos(ddosFx);
  const ddosDefender = sessionWithRole(ddosFx, "defender");
  for (const player of ddosFx.room.players) {
    player.blueEmitted = 0;
    player.blueSuccess = 0;
    player.inactivityPenalties = 0;
  }
  playerFor(ddosFx, ddosDefender).blueEmitted = 1;
  playerFor(ddosFx, ddosDefender).blueSuccess = 1;
  playerFor(ddosFx, ddosDefender).inactivityPenalties = 1;
  ddosFx.room.settings.ddosSeconds = 1;
  ddosFx.advance(1_000);
  assert.equal(
    ddosFx.engine.snapshot(ddosFx.admin)!.public.results.at(-1)!.metric,
    50,
  );

  const identityFx = fixture();
  startIdentity(identityFx);
  const identityDefender = sessionWithRole(identityFx, "defender");
  for (const player of identityFx.room.players) {
    player.legitShown = 0;
    player.legitAuthorized = 0;
    player.inactivityPenalties = 0;
  }
  playerFor(identityFx, identityDefender).legitShown = 1;
  playerFor(identityFx, identityDefender).legitAuthorized = 1;
  playerFor(identityFx, identityDefender).inactivityPenalties = 1;
  identityFx.room.settings.identitySeconds = 1;
  identityFx.advance(1_000);
  assert.equal(
    identityFx.engine.snapshot(identityFx.admin)!.public.results.at(-1)!.metric,
    50,
  );
});
