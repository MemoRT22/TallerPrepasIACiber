import test from "node:test";
import assert from "node:assert/strict";
import {
  GameEngine,
  IMPOSTOR_TEMPLATES,
  OFFICIAL_TEMPLATES,
} from "../server/engine.js";
import type { GameAction, Session, Settings } from "../shared/types.js";

function setup(capacity: 3 | 4 | 5 | 6 = 4, mailSeconds = 150) {
  let now = 0;
  let event = 0;
  let seed = 37;
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
        name: `Correo ${invite.slot}`,
      }).session!,
  );
  const command = (
    value: Parameters<typeof engine.admin>[2],
    settings?: Settings,
  ) => engine.admin(admin, `c-${event++}`, value, settings);
  const action = (session: Session, value: Omit<GameAction, "eventId">) =>
    engine.action(session, { eventId: `a-${event++}`, ...value });
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  if (mailSeconds !== 150)
    assert(
      command("settings", {
        ...engine.snapshot(admin)!.public.settings,
        mailSeconds,
      }).ok,
    );
  assert(command("assign").ok);
  assert(command("start").ok);
  advance(5_000);
  const impostor = players.find(
    (session) => engine.snapshot(session)!.player!.role === "impostor",
  )!;
  const defenders = players.filter(
    (session) => session.token !== impostor.token,
  );
  const room = engine.rooms.get(admin.code)!;
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
  };
}

test("inspeccionar revela evidencia sin clasificar y se limita a dos usos", () => {
  const f = setup();
  const defender = f.defenders[0];
  const before = f.engine.snapshot(defender)!.player!;
  const first = before.mail[0];
  assert.equal(before.mailInspectionsRemaining, 2);
  assert.equal(first.inspection, undefined);
  assert(f.action(defender, { type: "mail:inspect", cardId: first.id }).ok);
  const inspected = f.engine.snapshot(defender)!.player!;
  assert.equal(inspected.mail.length, before.mail.length);
  assert.equal(
    f.room.players.find((player) => player.token === defender.token)!
      .mailDecisions,
    0,
  );
  assert.equal(inspected.mailInspectionsRemaining, 1);
  assert(inspected.mail[0].inspection?.evidence.length);
  const privateJson = JSON.stringify(inspected.mail[0]);
  for (const forbidden of [
    "malicious",
    "source",
    "senderToken",
    "kind",
    "tactic",
  ])
    assert(!privateJson.includes(forbidden));
  assert.equal(
    f.action(defender, { type: "mail:inspect", cardId: first.id }).ok,
    false,
  );
  assert.equal(
    f.engine.snapshot(defender)!.player!.mailInspectionsRemaining,
    1,
  );

  const internalPlayer = f.room.players.find(
    (player) => player.token === defender.token,
  )!;
  const internalFirst = internalPlayer.mail.find(
    (mail) => mail.id === first.id,
  )!;
  assert(
    f.action(defender, {
      type: "mail:classify",
      cardId: first.id,
      accept: !internalFirst.malicious,
    }).ok,
  );
  assert.equal(internalPlayer.mailDecisions, 1);
  assert.equal(internalPlayer.mailCorrect, 1);
  const second = f.engine.snapshot(defender)!.player!.mail[0];
  assert(f.action(defender, { type: "mail:inspect", cardId: second.id }).ok);
  assert.equal(
    f.engine.snapshot(defender)!.player!.mailInspectionsRemaining,
    0,
  );
  const third = f.engine.snapshot(defender)!.player!.mail[1];
  assert.equal(
    f.action(defender, { type: "mail:inspect", cardId: third.id }).ok,
    false,
  );
});

test("contenido ambiguo usa evidencia razonable y dominios reservados sin pista única", () => {
  const templates = [...OFFICIAL_TEMPLATES, ...IMPOSTOR_TEMPLATES];
  assert(templates.every((template) => template.sender.endsWith(".example")));
  assert(
    templates.every((template) => !JSON.stringify(template).includes("http")),
  );
  assert(
    OFFICIAL_TEMPLATES.some(
      (template) => !template.sender.endsWith("@cancun.example"),
    ),
  );
  assert(
    IMPOSTOR_TEMPLATES.some((template) =>
      template.sender.endsWith("@cancun.example"),
    ),
  );
  assert(
    templates.every(
      (template) =>
        template.preview.length > 20 &&
        template.inspection.evidence.length >= 2,
    ),
  );
  const evidence = templates
    .flatMap((template) => template.inspection.evidence)
    .join(" ")
    .toLowerCase();
  for (const giveaway of [
    "es fraudulento",
    "es legítimo",
    "respuesta correcta",
  ])
    assert(!evidence.includes(giveaway));
});

test("tácticas, destinos y cooldown son autoritativos y privados", () => {
  const f = setup();
  const impostorView = f.engine.snapshot(f.impostor)!.player!;
  assert.equal(impostorView.mailSendCooldown, 30);
  assert.deepEqual(
    new Set(
      impostorView.templates
        .filter((template) => template.kind === "attack")
        .map((template) => template.tactic),
    ),
    new Set(["urgency", "authority", "impersonation"]),
  );
  for (const defender of f.defenders)
    assert(
      f.engine
        .snapshot(defender)!
        .player!.templates.every((template) => template.kind === "official"),
    );
  const target = f.room.players.find(
    (player) => player.token === f.defenders[0].token,
  )!;
  assert.equal(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-director",
      target: f.room.players.find(
        (player) => player.token === f.impostor.token,
      )!.department,
    }).ok,
    false,
  );
  assert.equal(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "plantilla-inexistente",
      target: target.department,
    }).ok,
    false,
  );
  assert(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-director",
      target: target.department,
    }).ok,
  );
  assert.equal(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-provider",
      target: target.department,
    }).ok,
    false,
  );
  assert.equal(
    f.action(f.defenders[0], {
      type: "mail:send",
      templateId: "fake-provider",
      target: f.room.players.find(
        (player) => player.token === f.defenders[1].token,
      )!.department,
    }).ok,
    false,
  );
  const publicJson = JSON.stringify(f.engine.snapshot(f.admin)!.public);
  for (const secret of [
    "fake-director",
    "authority",
    "Dirección de Operaciones",
  ])
    assert(!publicJson.includes(secret));
  f.advance(29_999);
  assert.equal(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-provider",
      target: target.department,
    }).ok,
    false,
  );
  f.advance(1);
  assert(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-provider",
      target: target.department,
    }).ok,
  );
});

const MAIL_DURATION_CASES = [
  { duration: 60, cooldown: 19 },
  { duration: 61, cooldown: 20 },
  { duration: 75, cooldown: 27 },
  { duration: 80, cooldown: 29 },
  { duration: 90, cooldown: 30 },
  { duration: 150, cooldown: 30 },
] as const;

test("cooldown proporcional permite tres envíos antes del cierre en todas las duraciones", () => {
  for (const { duration, cooldown } of MAIL_DURATION_CASES) {
    const f = setup(4, duration);
    const target = f.room.players.find(
      (player) => player.token === f.defenders[0].token,
    )!;
    const view = f.engine.snapshot(f.impostor)!.player!;
    assert.equal(view.mailSendCooldown, cooldown);
    assert(2 * cooldown * 1_000 < duration * 1_000 - 20_000);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert(
        f.action(f.impostor, {
          type: "mail:send",
          templateId: "fake-support",
          target: target.department,
        }).ok,
        `envío ${attempt + 1} rechazado con duración ${duration}`,
      );
      if (attempt < 2) f.advance(cooldown * 1_000);
    }
    assert(f.room.clock < duration * 1_000 - 20_000);
  }
});

test("cooldown corto respeta pausa, deduplicación, cierre y reinicio", () => {
  const f = setup(4, 60);
  const target = f.room.players.find(
    (player) => player.token === f.defenders[0].token,
  )!;
  const send = {
    eventId: "short-round-send",
    type: "mail:send" as const,
    templateId: "fake-support",
    target: target.department,
  };
  const before = target.mail.length;
  assert(f.engine.action(f.impostor, send).ok);
  assert(f.engine.action(f.impostor, send).ok);
  assert.equal(target.mail.length, before + 1);
  assert.equal(f.engine.snapshot(f.impostor)!.player!.mailCooldown, 19);

  assert(f.command("pause").ok);
  f.advance(30_000);
  assert.equal(f.room.clock, 0);
  assert.equal(f.engine.snapshot(f.impostor)!.player!.mailCooldown, 19);
  assert.equal(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-security",
      target: target.department,
    }).ok,
    false,
  );
  assert(f.command("resume").ok);
  f.advance(18_999);
  assert.equal(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-security",
      target: target.department,
    }).ok,
    false,
  );
  f.advance(1);
  assert(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-security",
      target: target.department,
    }).ok,
  );
  f.advance(21_000);
  assert.equal(f.room.clock, 40_000);
  assert.equal(
    f.action(f.impostor, {
      type: "mail:send",
      templateId: "fake-director",
      target: target.department,
    }).ok,
    false,
  );

  assert(f.command("restart").ok);
  const restarted = f.engine.snapshot(f.impostor)!.player!;
  assert.equal(restarted.mailCooldown, 0);
  assert.equal(restarted.mailSendCooldown, 19);
});

test("tres aceptaciones fraudulentas dan victoria en cada duración admitida de borde", () => {
  for (const { duration, cooldown } of MAIL_DURATION_CASES) {
    const f = setup(4, duration);
    const defender = f.defenders[0];
    const target = f.room.players.find(
      (player) => player.token === defender.token,
    )!;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert(
        f.action(f.impostor, {
          type: "mail:send",
          templateId: ["fake-support", "fake-security", "fake-director"][
            attempt
          ],
          target: target.department,
        }).ok,
      );
      const injected = target.mail.at(-1)!;
      assert(
        f.action(defender, {
          type: "mail:classify",
          cardId: injected.id,
          accept: true,
        }).ok,
      );
      if (attempt < 2) f.advance(cooldown * 1_000);
    }
    assert.equal(
      f.engine.snapshot(f.admin)!.public.results[0].winner,
      "impostor",
    );
  }
});

test("tres aceptaciones siguen siendo alcanzables con 3 a 6 participantes", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = setup(capacity);
    const defender = f.defenders[0];
    const target = f.room.players.find(
      (player) => player.token === defender.token,
    )!;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert(
        f.action(f.impostor, {
          type: "mail:send",
          templateId: ["fake-support", "fake-security", "fake-director"][
            attempt
          ],
          target: target.department,
        }).ok,
      );
      const injected = target.mail.at(-1)!;
      assert(
        f.action(defender, {
          type: "mail:classify",
          cardId: injected.id,
          accept: true,
        }).ok,
      );
      if (attempt < 2) f.advance(30_000);
    }
    assert.equal(
      f.engine.snapshot(f.admin)!.public.results[0].winner,
      "impostor",
    );
  }
});

test("pausa conserva la investigación y reinicio restaura bandeja e inspecciones", () => {
  const f = setup();
  const defender = f.defenders[0];
  const card = f.engine.snapshot(defender)!.player!.mail[0];
  assert(f.action(defender, { type: "mail:inspect", cardId: card.id }).ok);
  assert(f.command("pause").ok);
  f.advance(20_000);
  const paused = f.engine.snapshot(defender)!.player!;
  assert.equal(paused.mailInspectionsRemaining, 1);
  assert(paused.mail[0].inspection);
  assert(f.command("resume").ok);
  assert(f.command("restart").ok);
  assert.equal(
    f.engine.snapshot(defender)!.player!.mailInspectionsRemaining,
    2,
  );
  assert.equal(f.engine.snapshot(defender)!.player!.mail.length, 0);
  assert(f.command("start").ok);
  f.advance(5_000);
  const restarted = f.engine.snapshot(defender)!.player!;
  assert.equal(restarted.mailInspectionsRemaining, 2);
  assert.equal(restarted.mail.length, 3);
  assert(restarted.mail.every((mail) => !mail.inspection));
});
