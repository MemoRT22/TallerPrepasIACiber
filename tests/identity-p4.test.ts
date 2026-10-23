import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../server/engine.js";
import {
  ADVANCED_REGISTRY_VARIANTS,
  IDENTITY_EVENT,
  IDENTITY_PROFILES,
  PORTRAIT_ASSETS,
  buildDossier,
  credentialOf,
  DOSSIER_KEYS,
  perturbClearance,
  perturbCode,
  perturbName,
  perturbValidity,
  registryEvidence,
} from "../shared/identityCatalog.js";
import {
  DEFAULT_SETTINGS,
  type Credential,
  type GameAction,
  type Session,
  type Settings,
} from "../shared/types.js";

function setup(
  capacity: 3 | 4 | 5 | 6 = 6,
  identitySeconds = DEFAULT_SETTINGS.identitySeconds,
  initialSeed = 91,
) {
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
  assert(
    engine.admin(admin, "settings-p4", "settings", {
      ...DEFAULT_SETTINGS,
      identitySeconds,
    } as Settings).ok,
  );
  const impostor = players.find(
    (session) => engine.snapshot(session)!.player!.role === "impostor",
  )!;
  const defenders = players.filter(
    (session) => session.token !== impostor.token,
  );
  const room = engine.rooms.get(admin.code)!;
  const internal = (session: Session) =>
    room.players.find((player) => player.token === session.token)!;
  const startIdentity = () => {
    assert(command("start").ok);
    advance(5_000);
    for (const seconds of [
      DEFAULT_SETTINGS.mailSeconds,
      DEFAULT_SETTINGS.ddosSeconds,
    ]) {
      advance(seconds * 1_000);
      assert(command("next").ok);
      assert(command("start").ok);
      advance(5_000);
    }
    assert.equal(room.phase, "identity");
    assert.equal(room.stage, "playing");
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
    internal,
    startIdentity,
  };
}

type Fixture = ReturnType<typeof setup>;

type Pair = { reference: Credential; presented: Credential };

function differing(card: Pair): string[] {
  return (Object.keys(card.reference) as Array<keyof Credential>).filter(
    (key) => card.reference[key] !== card.presented[key],
  );
}

/** Jugador «solo visual»: permite si ambas credenciales se ven idénticas. */
function visualDecision(card: Pair): boolean {
  return differing(card).length === 0;
}

test("el catálogo es local, ficticio y sin retratos sintéticos sin permiso", () => {
  assert.equal(IDENTITY_PROFILES.length, 8);
  assert.equal(new Set(IDENTITY_PROFILES.map((p) => p.code)).size, 8);
  assert.equal(new Set(IDENTITY_PROFILES.map((p) => p.employeeId)).size, 8);
  assert.equal(new Set(IDENTITY_PROFILES.map((p) => p.portrait)).size, 8);
  assert.deepEqual(PORTRAIT_ASSETS, {});
  for (const profile of IDENTITY_PROFILES) {
    const reference = credentialOf(profile);
    for (const [changed, field] of [
      [perturbName(profile.name), "name"],
      [perturbCode(profile.code), "code"],
      [perturbClearance(profile.clearance), "clearance"],
      [perturbValidity(profile.validity), "validity"],
    ] as const)
      assert.notEqual(changed, reference[field]);
    assert.equal(perturbCode(profile.code).length, 4);
    assert.match(perturbValidity(profile.validity), /^\d\d\/\d\d$/);
  }
});

test("cada variante del registro conserva una pista verificable y nunca dicta la respuesta", () => {
  const profile = IDENTITY_PROFILES[0];
  const regular = registryEvidence(profile, "regular");
  assert.equal(regular.evidence.length, 3);
  for (const variant of [
    "regular",
    "extraordinary",
    ...ADVANCED_REGISTRY_VARIANTS,
  ] as const) {
    const text = JSON.stringify(registryEvidence(profile, variant));
    assert(
      !/falsa|auténtica|autentica|fake|legit|suplant|impostor/i.test(text),
    );
  }
  for (const variant of ADVANCED_REGISTRY_VARIANTS)
    assert.notDeepEqual(
      registryEvidence(profile, variant).evidence,
      regular.evidence,
    );
  for (const key of DOSSIER_KEYS) {
    const dossier = buildDossier(2, key);
    const mismatched = dossier.record.filter(
      (field, index) => field.value !== dossier.draft[index].value,
    );
    assert.deepEqual(
      mismatched.map((field) => field.key),
      [key],
    );
  }
});

test("el ritmo escala por tercios: obvias, sutiles y comunicado avanzado", () => {
  const f = setup();
  f.startIdentity();
  const seen = { obvious: 0, subtle: 0, advanced: 0, decoy: 0 };
  const subtleFields = new Set<string>();
  for (let step = 0; step < 118; step += 1) {
    for (const session of f.players) {
      const player = f.internal(session);
      const card = player.card;
      if (!card) continue;
      const stage = Math.min(
        2,
        Math.floor(
          f.room.clock / ((DEFAULT_SETTINGS.identitySeconds * 1000) / 3),
        ),
      );
      const diff = differing(card);
      if (card.tier === "legit") {
        assert.deepEqual(diff, []);
        if (card.context?.urgent) {
          seen.decoy += 1;
          assert(
            stage >= 1,
            "la legítima urgente no aparece en el primer tercio",
          );
        }
      } else if (card.tier === "obvious") {
        seen.obvious += 1;
        assert(diff.includes("avatar"));
      } else if (card.tier === "subtle") {
        seen.subtle += 1;
        assert.equal(diff.length, 1);
        assert(["code", "name", "clearance", "validity"].includes(diff[0]));
        subtleFields.add(diff[0]);
      } else {
        seen.advanced += 1;
        assert.deepEqual(diff, [], "la avanzada coincide en todo lo visible");
        assert.equal(card.context?.urgent, true);
      }
      if (card.tier === "subtle" || card.tier === "obvious")
        assert(
          stage >= 1 || card.tier === "obvious",
          "las sutiles no llegan en el primer tercio",
        );
      if (stage >= 1 && card.tier === "obvious" && card.source === "auto")
        // Solo pueden quedar obvias generadas antes del cambio de tercio.
        assert(card.expires <= f.room.clock + 10_000);
      assert(
        f.action(session, {
          type: "identity:decide",
          cardId: card.id,
          accept: card.legit,
        }).ok,
      );
    }
    f.advance(1_000);
    if (f.room.roundFinished) break;
  }
  assert(seen.obvious > 0 && seen.subtle > 0);
  assert(
    seen.decoy > 0,
    "hay legítimas urgentes que impiden usar la urgencia como regla",
  );
  assert.equal(
    subtleFields.size,
    4,
    "las sutiles rotan código, nombre, nivel y vigencia",
  );
  assert(
    seen.advanced >= f.defenders.length,
    "cada defensor recibe el comunicado",
  );
});

test("el comunicado llega una vez, es público y anónimo, y se retira solo", () => {
  const f = setup();
  f.startIdentity();
  assert.equal(f.engine.snapshot(f.admin)!.public.identity, undefined);
  f.advance(59_000);
  assert.equal(f.engine.snapshot(f.admin)!.public.identity, undefined);
  f.advance(1_000);
  const publicState = f.engine.snapshot(f.admin)!.public;
  assert.equal(
    publicState.identity?.event?.transcript,
    IDENTITY_EVENT.transcript,
  );
  assert.deepEqual(Object.keys(publicState.identity!.event!).sort(), [
    "id",
    "remaining",
    "speaker",
    "transcript",
  ]);
  const secrets = JSON.stringify(publicState);
  for (const token of f.players.map((s) => s.token))
    assert(!secrets.includes(token));
  // Cada terminal activa recibe exactamente una tarjeta del comunicado.
  for (const session of f.players) {
    const player = f.internal(session);
    const events = [player.card, ...player.pendingCards].filter(
      (c) => c?.isEvent,
    );
    assert.equal(events.length + (player.identityEventOwed ? 1 : 0), 1);
  }
  f.advance(14_000);
  assert.equal(f.engine.snapshot(f.admin)!.public.identity, undefined);
  const delivered = f.room.logs.filter((l) => l.type === "identity_event");
  assert.equal(delivered.length, 1);
  f.advance(20_000);
  assert.equal(
    f.room.logs.filter((l) => l.type === "identity_event").length,
    1,
  );
});

test("el comunicado no desplaza la tarjeta activa ni cubre jugadores ausentes o bloqueados", () => {
  const f = setup();
  f.startIdentity();
  const absent = f.internal(f.defenders[0]);
  const blocked = f.internal(f.defenders[1]);
  absent.connected = false;
  blocked.blocked = true;
  const active = new Map(
    f.room.players.map((player) => [player.token, player.card?.id]),
  );
  f.advance(60_000);
  for (const player of f.room.players) {
    if (player === absent || player === blocked) {
      assert(![player.card, ...player.pendingCards].some((c) => c?.isEvent));
      continue;
    }
    if (player.card?.isEvent) continue;
    // La tarjeta activa que ya se resolvía conserva su identidad.
    assert(
      player.card === null ||
        player.card.id === active.get(player.token) ||
        player.card.expires > 0,
    );
    assert(player.pendingCards.length <= 2);
  }
});

test("verificar: dos usos, costo con reloj del servidor y evidencia solo para esa tarjeta", () => {
  const f = setup();
  f.startIdentity();
  const session = f.defenders[0];
  const player = f.internal(session);
  const first = player.card!;
  assert.equal(
    f.engine.snapshot(session)!.player!.identityVerificationsRemaining,
    2,
  );
  assert.equal(
    f.action(session, { type: "identity:verify", cardId: "otra" }).ok,
    false,
  );
  assert.equal(player.identityVerificationsRemaining, 2);

  const ok = f.action(session, { type: "identity:verify", cardId: first.id });
  assert(ok.ok);
  assert.equal(player.identityVerificationsRemaining, 1);
  let view = f.engine.snapshot(session)!.player!.card!;
  assert.equal(view.verification?.pending, true);
  assert.equal(
    view.verification?.evidence,
    undefined,
    "sin evidencia antes de tiempo",
  );
  assert(!JSON.stringify(view).includes(first.registry.heading));

  // No hay verificaciones simultáneas ni repetidas sobre la misma tarjeta.
  assert.equal(
    f.action(session, { type: "identity:verify", cardId: first.id }).ok,
    false,
  );
  assert.equal(player.identityVerificationsRemaining, 1);
  // Mientras consulta no se puede decidir.
  assert.equal(
    f.action(session, {
      type: "identity:decide",
      cardId: first.id,
      accept: first.legit,
    }).ok,
    false,
  );
  f.advance(1_499);
  assert.equal(
    f.engine.snapshot(session)!.player!.card!.verification?.pending,
    true,
  );
  f.advance(1);
  view = f.engine.snapshot(session)!.player!.card!;
  assert.equal(view.verification?.pending, false);
  assert.equal(view.verification?.evidence?.length, 3);
  assert.equal(view.verification?.heading, first.registry.heading);
  assert(
    !/falsa|auténtica|autentica|fake|legit/i.test(
      JSON.stringify(view.verification),
    ),
  );

  // Al decidir, la evidencia no pasa a la tarjeta siguiente.
  assert(
    f.action(session, {
      type: "identity:decide",
      cardId: first.id,
      accept: first.legit,
    }).ok,
  );
  const next = f.engine.snapshot(session)!.player!.card!;
  assert.notEqual(next.id, first.id);
  assert.equal(next.verification, undefined);

  // Segundo y tercer intento: el límite es de dos por ronda.
  assert(f.action(session, { type: "identity:verify", cardId: next.id }).ok);
  f.advance(1_500);
  assert(
    f.action(session, {
      type: "identity:decide",
      cardId: next.id,
      accept: f.internal(session).card!.legit,
    }).ok,
  );
  const third = f.internal(session).card!;
  const denied = f.action(session, {
    type: "identity:verify",
    cardId: third.id,
  });
  assert.equal(denied.ok, false);
  assert.match(denied.error!, /No quedan verificaciones/);
  assert.equal(
    f.engine.snapshot(session)!.player!.identityVerificationsRemaining,
    0,
  );
});

test("verificar no consume usos cuando quedan menos de tres segundos y respeta tarjetas de seis", () => {
  const f = setup();
  f.startIdentity();
  f.advance(80_000 - f.room.clock); // último tercio: ventanas de 6 s
  const session = f.defenders[0];
  const player = f.internal(session);
  assert.equal(f.room.clock, 80_000);
  const card = player.card ?? player.pendingCards[0];
  assert(card);
  // Se reactiva una tarjeta de 6 s para medir el margen.
  player.card = card;
  card.shown = true;
  card.expires = f.room.clock + 6_000;
  f.advance(3_001);
  const tooLate = f.action(session, {
    type: "identity:verify",
    cardId: card.id,
  });
  assert.equal(tooLate.ok, false);
  assert.match(tooLate.error!, /pocos segundos/);
  assert.equal(player.identityVerificationsRemaining, 2);

  // Con 6 s completos: tras 1,5 s de consulta aún quedan 4,5 s para decidir.
  const fresh = f.internal(f.defenders[1]);
  const second = fresh.card!;
  second.expires = f.room.clock + 6_000;
  assert(
    f.action(f.defenders[1], { type: "identity:verify", cardId: second.id }).ok,
  );
  f.advance(1_500);
  assert(second.expires - f.room.clock >= 4_500);
  assert(
    f.action(f.defenders[1], {
      type: "identity:decide",
      cardId: second.id,
      accept: second.legit,
    }).ok,
  );
});

test("una tarjeta que expira durante la verificación no transfiere la evidencia", () => {
  const f = setup();
  f.startIdentity();
  const session = f.defenders[0];
  const player = f.internal(session);
  const card = player.card!;
  assert(f.action(session, { type: "identity:verify", cardId: card.id }).ok);
  card.expires = f.room.clock + 500;
  f.advance(500);
  assert.equal(
    f.action(session, {
      type: "identity:decide",
      cardId: card.id,
      accept: true,
    }).ok,
    false,
  );
  const next = f.engine.snapshot(session)!.player!.card;
  assert.notEqual(next?.id, card.id);
  assert.equal(next?.verification, undefined);
  assert.equal(
    player.identityVerificationsRemaining,
    1,
    "el uso quedó consumido",
  );
});

test("la pausa congela la consulta y la reconexión conserva su estado", () => {
  const f = setup();
  f.startIdentity();
  const session = f.defenders[0];
  const card = f.internal(session).card!;
  assert(f.action(session, { type: "identity:verify", cardId: card.id }).ok);
  f.advance(500);
  assert(f.command("pause").ok);
  f.advance(10_000);
  const frozen = f.engine.snapshot(session)!.player!.card!.verification!;
  assert.equal(frozen.pending, true);
  assert.equal(Math.round(frozen.remaining * 1000), 1_000);
  assert.equal(
    f.action(session, { type: "identity:verify", cardId: card.id }).ok,
    false,
  );
  assert(f.command("resume").ok);
  const resumed = f.engine.resume(session);
  assert(resumed.ok);
  assert.equal(resumed.snapshot?.player?.card?.verification?.pending, true);
  f.advance(1_000);
  assert.equal(
    f.engine.snapshot(session)!.player!.card!.verification?.pending,
    false,
  );
});

test("un jugador solo visual falla únicamente las avanzadas y verificar las resuelve", () => {
  const f = setup();
  f.startIdentity();
  const verified = new Set<string>();
  const wrongByTier: Record<string, number> = {};
  const decide = (session: Session, accept: boolean) => {
    const card = f.internal(session).card;
    if (!card) return;
    if (accept !== card.legit)
      wrongByTier[card.tier] = (wrongByTier[card.tier] ?? 0) + 1;
    f.action(session, { type: "identity:decide", cardId: card.id, accept });
  };
  for (let step = 0; step < 238 && !f.room.roundFinished; step += 1) {
    const waiting: Session[] = [];
    for (const session of f.defenders) {
      const player = f.internal(session);
      const card = player.card;
      if (!card) continue;
      if (
        card.tier === "advanced" &&
        player.identityVerificationsRemaining > 0 &&
        card.expires - f.room.clock >= 3_000
      ) {
        assert(
          f.action(session, { type: "identity:verify", cardId: card.id }).ok,
        );
        waiting.push(session);
        verified.add(card.id);
      } else decide(session, visualDecision(card));
    }
    if (waiting.length) {
      f.advance(1_500);
      for (const session of waiting) {
        const card = f.internal(session).card!;
        const evidence =
          f.engine.snapshot(session)!.player!.card!.verification!.evidence!;
        const baseline = registryEvidence(
          IDENTITY_PROFILES.find(
            (p) => p.employeeId === card.reference.employeeId,
          )!,
          "regular",
        ).evidence;
        // La evidencia contradice lo que la credencial daba por bueno.
        assert.notDeepEqual(evidence, baseline);
        decide(session, false);
      }
    }
    f.advance(500);
  }
  assert.deepEqual(
    wrongByTier,
    {},
    "con la regla visual + verificar no se falla",
  );
  assert(verified.size > 0);
});

test("ninguna foto convincente concede acceso: las avanzadas solas no comprometen una dependencia", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = setup(capacity);
    f.startIdentity();
    // Todos aceptan todo lo que luzca igual y nunca verifican.
    for (let step = 0; step < 240 && !f.room.roundFinished; step += 1) {
      for (const session of f.defenders) {
        const card = f.internal(session).card;
        if (card)
          f.action(session, {
            type: "identity:decide",
            cardId: card.id,
            accept: visualDecision(card),
          });
      }
      f.advance(500);
    }
    for (const session of f.defenders) {
      const player = f.internal(session);
      assert.equal(
        player.blocked,
        false,
        "dos avanzadas no bastan para bloquear",
      );
      assert(player.infiltrations <= 2);
    }
    const result = f.engine.snapshot(f.admin)!.public.results.at(-1)!;
    assert.notEqual(result.winner, "impostor");
  }
});

test("el expediente del impostor es privado, tiene reintento y desbloquea una sola suplantación", () => {
  const f = setup();
  assert.equal(
    f.action(f.impostor, { type: "identity:challenge-solve", answer: "name" })
      .ok,
    false,
  );
  f.startIdentity();
  for (const defender of f.defenders) {
    const state = f.engine.snapshot(defender)!.player!;
    assert.equal(state.identityChallenge, undefined);
    assert.equal(
      f.action(defender, { type: "identity:challenge-solve", answer: "name" })
        .ok,
      false,
    );
    assert.equal(
      f.action(defender, { type: "identity:send-advanced" }).ok,
      false,
    );
  }
  assert.equal(
    JSON.stringify(f.engine.snapshot(f.admin)!.public).includes("dossier"),
    false,
  );
  const internal = f.internal(f.impostor);
  const challenge = internal.identityChallenge!;
  const view = f.engine.snapshot(f.impostor)!.player!.identityChallenge!;
  assert(!JSON.stringify(view).includes('"answer"'));
  assert.equal(view.record.length, 5);

  // Sin resolver no hay suplantación.
  assert.equal(
    f.action(f.impostor, { type: "identity:send-advanced" }).ok,
    false,
  );
  const wrong = DOSSIER_KEYS.find((key) => key !== challenge.answer)!;
  assert.equal(
    f.action(f.impostor, { type: "identity:challenge-solve", answer: wrong })
      .ok,
    false,
  );
  assert.equal(
    f.action(f.impostor, {
      type: "identity:challenge-solve",
      answer: challenge.answer,
    }).ok,
    false,
    "un fallo impone una espera de reintento",
  );
  assert(f.engine.snapshot(f.impostor)!.player!.identityChallenge!.retryIn > 0);
  f.advance(3_000);
  assert.equal(
    f.action(f.impostor, { type: "identity:challenge-solve", answer: "nada" })
      .ok,
    false,
  );
  assert(
    f.action(f.impostor, {
      type: "identity:challenge-solve",
      answer: challenge.answer,
    }).ok,
  );
  assert.equal(
    f.action(f.impostor, {
      type: "identity:challenge-solve",
      answer: challenge.answer,
    }).ok,
    false,
    "un solo desbloqueo por ronda",
  );
  // El primer tercio es para aprender: todavía no se puede enviar.
  assert(f.room.clock < 40_000);
  assert.equal(
    f.action(f.impostor, { type: "identity:send-advanced" }).ok,
    false,
  );
  assert.equal(challenge.advancedAvailable, true);
});

test("la suplantación avanzada va a un defensor disponible, una sola vez, sin tocar su tarjeta activa", () => {
  for (const capacity of [3, 6] as const) {
    const f = setup(capacity);
    f.startIdentity();
    const internal = f.internal(f.impostor);
    assert(
      f.action(f.impostor, {
        type: "identity:challenge-solve",
        answer: internal.identityChallenge!.answer,
      }).ok,
    );
    f.advance(40_000);
    const active = new Map(f.room.players.map((p) => [p.token, p.card?.id]));
    const before = new Set(
      f.room.players.flatMap((p) => p.pendingCards.map((c) => c.id)),
    );
    const sent = f.action(f.impostor, { type: "identity:send-advanced" });
    assert(sent.ok);
    const targets = f.room.players.filter((p) =>
      p.pendingCards.some((c) => !before.has(c.id)),
    );
    assert.equal(targets.length, 1);
    const target = targets[0];
    assert.equal(target.role, "defender");
    assert.equal(target.card?.id, active.get(target.token));
    assert(target.pendingCards.length <= 2);
    const injected = target.pendingCards.find((c) => !before.has(c.id))!;
    assert.equal(injected.tier, "advanced");
    assert.equal(injected.source, "player");
    assert.deepEqual(differing(injected), []);
    assert(!target.pendingCards.some((c) => c.isEvent && c.id === injected.id));
    // Una sola suplantación y ningún rastro público.
    f.advance(11_000);
    assert.equal(
      f.action(f.impostor, { type: "identity:send-advanced" }).ok,
      false,
    );
    assert.equal(
      f.room.logs.filter((l) => l.type === "identity_send_advanced").length,
      1,
    );
    const publicJson = JSON.stringify(f.engine.snapshot(f.admin)!.public);
    assert(!publicJson.includes(target.department + "-advanced"));
    assert(
      !/advanced|synthetic|suplant/i.test(
        publicJson.replace(/Identidad sintética/g, ""),
      ),
    );
  }
});

test("sin defensores disponibles la suplantación no se consume ni toca ausentes o bloqueados", () => {
  const f = setup(4);
  f.startIdentity();
  const internal = f.internal(f.impostor);
  assert(
    f.action(f.impostor, {
      type: "identity:challenge-solve",
      answer: internal.identityChallenge!.answer,
    }).ok,
  );
  f.advance(41_000);
  f.internal(f.defenders[0]).connected = false;
  f.internal(f.defenders[1]).blocked = true;
  const lone = f.internal(f.defenders[2]);
  lone.connected = false;
  const failed = f.action(f.impostor, { type: "identity:send-advanced" });
  assert.equal(failed.ok, false);
  assert.equal(internal.identityChallenge!.advancedUsed, false);
  lone.connected = true;
  const before = f.internal(f.defenders[0]).pendingCards.length;
  assert(f.action(f.impostor, { type: "identity:send-advanced" }).ok);
  assert.equal(internal.identityChallenge!.advancedUsed, true);
  assert.equal(f.internal(f.defenders[0]).pendingCards.length, before);
  assert(
    lone.pendingCards.some(
      (c) => c.tier === "advanced" && c.source === "player",
    ),
  );
});

test("la suplantación avanzada no sustituye el comunicado ni inyecciones propias", () => {
  const f = setup(3);
  f.startIdentity();
  const internal = f.internal(f.impostor);
  assert(
    f.action(f.impostor, {
      type: "identity:challenge-solve",
      answer: internal.identityChallenge!.answer,
    }).ok,
  );
  f.advance(61_000);
  assert.equal(f.room.identityEventDone, true);
  for (const defender of f.defenders) {
    const player = f.internal(defender);
    const [first, second] = player.pendingCards;
    const event =
      [player.card, ...player.pendingCards].find((c) => c?.isEvent) ?? first;
    event.isEvent = true;
    event.source = "auto";
    second.isEvent = false;
    second.source = "player";
    player.pendingCards = [event, second];
  }
  const before = f.room.players.map((p) => p.pendingCards.map((c) => c.id));
  const denied = f.action(f.impostor, { type: "identity:send-advanced" });
  assert.equal(denied.ok, false, "cola llena de tarjetas protegidas");
  assert.deepEqual(
    f.room.players.map((p) => p.pendingCards.map((c) => c.id)),
    before,
  );
  assert.equal(internal.identityChallenge!.advancedUsed, false);
  assert.equal(internal.identityChallenge!.advancedAvailable, true);

  // Con una pendiente automática sustituible se reemplaza solo esa.
  const chosen = f.internal(f.defenders[0]);
  chosen.pendingCards[1].source = "auto";
  f.internal(f.defenders[1]).blocked = true;
  const eventId = chosen.pendingCards[0].id;
  const activeId = chosen.card?.id;
  assert(f.action(f.impostor, { type: "identity:send-advanced" }).ok);
  assert.equal(chosen.pendingCards[0].id, eventId);
  assert.equal(chosen.pendingCards[1].tier, "advanced");
  assert.equal(chosen.pendingCards[1].source, "player");
  assert.equal(chosen.card?.id, activeId);
  assert.equal(chosen.pendingCards.length, 2);
});

test("la alerta pública es anónima, agregada en pulsos y breve", () => {
  const f = setup();
  f.startIdentity();
  f.advance(60_000);
  const victim = f.defenders[0];
  const player = f.internal(victim);
  let event = [player.card, ...player.pendingCards].find((c) => c?.isEvent);
  for (let guard = 0; guard < 6 && !event; guard += 1) {
    const current = player.card;
    if (current)
      f.action(victim, {
        type: "identity:decide",
        cardId: current.id,
        accept: current.legit,
      });
    event = [player.card, ...player.pendingCards].find((c) => c?.isEvent);
  }
  assert(event);
  while (player.card?.id !== event.id) {
    const current = player.card!;
    f.action(victim, {
      type: "identity:decide",
      cardId: current.id,
      accept: current.legit,
    });
  }
  assert(
    f.action(victim, {
      type: "identity:decide",
      cardId: event.id,
      accept: true,
    }).ok,
  );
  assert.equal(f.engine.snapshot(f.admin)!.public.identity?.alert, undefined);
  while (f.room.clock % 10_000 !== 0 || f.room.clock <= 60_000) f.advance(100);
  assert.equal(f.engine.snapshot(f.admin)!.public.identity?.alert, true);
  const publicJson = JSON.stringify(
    f.engine.snapshot(f.admin)!.public.identity,
  );
  assert(!publicJson.includes(player.department));
  assert(!publicJson.includes(player.token));
  f.advance(6_000);
  assert.equal(f.engine.snapshot(f.admin)!.public.identity?.alert, undefined);
});

test("duraciones personalizadas escalan el comunicado y los tercios sin romper las ventanas 10/8/6", () => {
  for (const seconds of [30, 31, 45, 60, 90, 300, 600]) {
    const f = setup(3, seconds);
    f.startIdentity();
    const half = (seconds * 1000) / 2;
    f.advance(half - 100 - f.room.clock + 0);
    assert.equal(f.room.identityEventDone, false);
    f.advance(100);
    assert.equal(f.room.identityEventDone, true, `evento a ${half} ms`);
    const limits = new Set<number>();
    for (let step = 0; step < seconds && !f.room.roundFinished; step += 1) {
      for (const session of f.players) {
        const card = f.internal(session).card;
        if (card && card.shown) limits.add(card.expires - f.room.clock);
        if (card)
          f.action(session, {
            type: "identity:decide",
            cardId: card.id,
            accept: card.legit,
          });
      }
      f.advance(1_000);
    }
    for (const limit of limits) assert(limit <= 10_000 && limit > 0);
  }
});

test("reinicio y cambio de fase limpian verificaciones, expediente y comunicado", () => {
  const f = setup();
  f.startIdentity();
  const session = f.defenders[0];
  assert(
    f.action(session, {
      type: "identity:verify",
      cardId: f.internal(session).card!.id,
    }).ok,
  );
  f.advance(65_000);
  assert.equal(f.room.identityEventDone, true);
  assert(f.command("restart").ok);
  assert.equal(f.room.identityEventDone, false);
  assert.equal(f.internal(session).identityVerificationsRemaining, 2);
  assert.equal(f.internal(f.impostor).identityChallenge, undefined);
  assert.equal(f.engine.snapshot(f.admin)!.public.identity, undefined);
  assert(f.command("start").ok);
  f.advance(5_000);
  assert(f.internal(f.impostor).identityChallenge);
  assert.equal(f.internal(session).identityVerificationsRemaining, 2);
  // Último segundo y paso a Recuperación.
  f.advance(DEFAULT_SETTINGS.identitySeconds * 1000 - 1_000);
  const last = f.internal(session).card;
  if (last) f.action(session, { type: "identity:verify", cardId: last.id });
  f.advance(1_000);
  assert.equal(f.room.roundFinished, true);
  assert.equal(
    f.action(session, { type: "identity:verify", cardId: "x" }).ok,
    false,
  );
  assert.equal(
    f.action(f.impostor, { type: "identity:send-advanced" }).ok,
    false,
  );
  assert(f.command("next").ok);
  assert.equal(f.room.phase, "recovery");
  assert.equal(f.internal(f.impostor).identityChallenge, undefined);
  assert.equal(f.internal(session).pendingCards.length, 0);
  assert.equal(f.engine.snapshot(f.admin)!.public.identity, undefined);
});

test("las acciones duplicadas se deduplican por evento", () => {
  const f = setup();
  f.startIdentity();
  const session = f.defenders[0];
  const card = f.internal(session).card!;
  const payload = {
    eventId: "same-verify",
    type: "identity:verify" as const,
    cardId: card.id,
  };
  assert(f.engine.action(session, payload).ok);
  assert(f.engine.action(session, payload).ok);
  assert.equal(f.internal(session).identityVerificationsRemaining, 1);
});
