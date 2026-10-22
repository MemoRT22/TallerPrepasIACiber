import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../server/engine.js";
import {
  DEFAULT_SETTINGS,
  type GameAction,
  type Session,
} from "../shared/types.js";

function setup(capacity: 3 | 4 | 5 | 6 = 3) {
  let now = 0;
  let event = 0;
  const engine = new GameEngine({ now: () => now, random: () => 0.1 });
  const created = engine.create(capacity);
  assert(created.session && created.snapshot?.admin);
  const admin = created.session;
  const players = created.snapshot.admin.invites.map((invite, index) => {
    const joined = engine.join({
      code: admin.code,
      slot: invite.slot,
      invite: invite.invite,
      name: `Ritmo ${capacity}-${index + 1}`,
    });
    assert(joined.session);
    return joined.session;
  });
  const command = (command: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `cmd-${event++}`, command);
  const action = (session: Session, action: Omit<GameAction, "eventId">) =>
    engine.action(session, { eventId: `act-${event++}`, ...action });
  const advance = (milliseconds: number) => {
    now += milliseconds;
    engine.tick();
  };
  assert(command("assign").ok);
  return {
    engine,
    admin,
    players,
    command,
    action,
    advance,
    room: engine.rooms.get(admin.code)!,
  };
}

function start(fixture: ReturnType<typeof setup>) {
  assert(fixture.command("start").ok);
  assert.equal(
    fixture.engine.snapshot(fixture.admin)?.public.stage,
    "countdown",
  );
  fixture.advance(5_000);
  assert.equal(
    fixture.engine.snapshot(fixture.admin)?.public.stage,
    "playing",
  );
}

function finish(
  fixture: ReturnType<typeof setup>,
  phase: "mail" | "ddos" | "identity" | "recovery",
) {
  const seconds = {
    mail: DEFAULT_SETTINGS.mailSeconds,
    ddos: DEFAULT_SETTINGS.ddosSeconds,
    identity: DEFAULT_SETTINGS.identitySeconds,
    recovery: DEFAULT_SETTINGS.recoverySeconds,
  }[phase];
  fixture.advance(seconds * 1000);
  const state = fixture.engine.snapshot(fixture.admin)!.public;
  assert.equal(state.phase, phase);
  assert.equal(state.stage, "finished");
  assert.equal(state.remaining, 0);
  assert.equal(state.clock, seconds * 1000);
}

test("los cuatro tiempos exprés suman 480 segundos y son los defaults públicos", () => {
  assert.deepEqual(
    {
      mailSeconds: DEFAULT_SETTINGS.mailSeconds,
      ddosSeconds: DEFAULT_SETTINGS.ddosSeconds,
      identitySeconds: DEFAULT_SETTINGS.identitySeconds,
      recoverySeconds: DEFAULT_SETTINGS.recoverySeconds,
    },
    {
      mailSeconds: 150,
      ddosSeconds: 90,
      identitySeconds: 120,
      recoverySeconds: 120,
    },
  );
  assert.equal(
    DEFAULT_SETTINGS.mailSeconds +
      DEFAULT_SETTINGS.ddosSeconds +
      DEFAULT_SETTINGS.identitySeconds +
      DEFAULT_SETTINGS.recoverySeconds,
    480,
  );
  const fixture = setup();
  assert.deepEqual(
    fixture.engine.snapshot(fixture.admin)?.public.settings,
    DEFAULT_SETTINGS,
  );
});

test("el flujo exprés completo conserva rol, privacidad y cierre con 3–6 jugadores", () => {
  const phases = [
    ["mail", DEFAULT_SETTINGS.mailSeconds],
    ["ddos", DEFAULT_SETTINGS.ddosSeconds],
    ["identity", DEFAULT_SETTINGS.identitySeconds],
    ["recovery", DEFAULT_SETTINGS.recoverySeconds],
  ] as const;

  for (const capacity of [3, 4, 5, 6] as const) {
    const fixture = setup(capacity);
    const roles = fixture.players.map(
      (player) => fixture.engine.snapshot(player)?.player?.role,
    );
    assert.equal(roles.filter((role) => role === "impostor").length, 1);

    for (const [phase, seconds] of phases) {
      start(fixture);
      const playing = fixture.engine.snapshot(fixture.admin)!.public;
      assert.equal(playing.phase, phase);
      assert.equal(playing.duration, seconds);

      if (phase === "mail") {
        const card = fixture.engine.snapshot(fixture.players[1])!.player!.mail[0];
        assert(fixture.command("pause").ok);
        fixture.advance(15_000);
        assert.equal(
          fixture.engine.snapshot(fixture.admin)?.public.clock,
          0,
        );
        assert(fixture.command("resume").ok);
        finish(fixture, phase);
        assert.equal(
          fixture.action(fixture.players[1], {
            type: "mail:classify",
            cardId: card.id,
            accept: true,
          }).ok,
          false,
        );
      } else {
        finish(fixture, phase);
      }

      assert.deepEqual(
        fixture.players.map(
          (player) => fixture.engine.snapshot(player)?.player?.role,
        ),
        roles,
      );
      const publicJson = JSON.stringify(
        fixture.engine.snapshot(fixture.admin)!.public,
      );
      assert(!publicJson.includes('"role"'));
      assert(!publicJson.includes('"token"'));

      if (phase !== "recovery") {
        assert(fixture.command("next").ok);
      }
    }

    assert(fixture.command("voting").ok);
    const suspect = fixture.room.players[0].department;
    for (const player of fixture.players)
      assert(
        fixture.action(player, {
          type: "vote",
          suspect,
          reason: "Señal observada durante las misiones.",
        }).ok,
      );
    assert(fixture.command("reveal").ok);
    assert.equal(
      fixture.engine.snapshot(fixture.admin)?.public.phase,
      "revealed",
    );
  }
});

test("correo exprés reparte cuatro mensajes iniciales y diez automáticos como máximo", () => {
  const fixture = setup();
  start(fixture);
  assert(
    fixture.room.players.every(
      (player) => player.mail.length === 4 && player.mailReceived === 4,
    ),
  );

  fixture.advance(120_000);
  assert(
    fixture.room.players.every(
      (player) => player.mail.length === 10 && player.mailReceived === 10,
    ),
  );

  fixture.advance(10_000);
  const impostor = fixture.room.players.find(
    (player) => player.role === "impostor",
  )!;
  const target = fixture.room.players.find(
    (player) => player.role === "defender",
  )!;
  const impostorSession = fixture.players.find(
    (player) => player.slot === impostor.slot,
  )!;
  assert.equal(
    fixture.action(impostorSession, {
      type: "mail:send",
      target: target.department,
      templateId: "fake-security",
    }).ok,
    false,
  );
});

test("DDoS cambia de intervalo exactamente en los tres tercios de 90 segundos", () => {
  const fixture = setup();
  start(fixture);
  finish(fixture, "mail");
  assert(fixture.command("next").ok);
  start(fixture);

  assert.equal(fixture.room.ddosNextSpawn, 2_000);
  fixture.advance(30_000);
  assert.equal(fixture.room.ddosNextSpawn, 31_500);
  fixture.advance(30_000);
  assert.equal(fixture.room.ddosNextSpawn, 61_100);
  assert.equal(fixture.engine.snapshot(fixture.admin)?.public.remaining, 30);
});

test("Identidad conserva ventanas progresivas 10/8/6 en la ronda de 120 segundos", () => {
  const fixture = setup();
  for (const phase of ["mail", "ddos"] as const) {
    start(fixture);
    finish(fixture, phase);
    assert(fixture.command("next").ok);
  }
  start(fixture);

  const target = fixture.room.players.find(
    (player) => player.role === "defender",
  )!;
  assert.equal(target.card!.expires - fixture.room.clock, 10_000);

  fixture.advance(40_000);
  assert.equal(target.card!.expires - fixture.room.clock, 8_000);

  fixture.advance(40_000);
  assert.equal(target.card!.expires - fixture.room.clock, 6_000);
});
