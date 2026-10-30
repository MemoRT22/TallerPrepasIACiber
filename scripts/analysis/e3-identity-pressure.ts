/** Offline E3 audit. Never imported by the application; no production rules are changed. */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { GameEngine } from "../../server/engine";
import {
  DEFAULT_SETTINGS,
  type GameAction,
  type Session,
} from "../../shared/types";

export function identityFixture(capacity: 3 | 4 | 5 | 6 = 3, initialSeed = 91) {
  let now = 0,
    event = 0,
    seed = initialSeed;
  const engine = new GameEngine({
    now: () => now,
    random: () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
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
        name: `Actor E3 ${invite.slot}`,
      }).session!,
  );
  const command = (cmd: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `e3-c-${event++}`, cmd);
  const action = (
    session: Session,
    value: Omit<GameAction, "eventId">,
    id?: string,
  ) => engine.action(session, { eventId: id ?? `e3-a-${event++}`, ...value });
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  assert(command("assign").ok);
  assert(command("start").ok);
  advance(5_000);
  for (let i = 0; i < 2; i++) {
    assert(command("stop").ok);
    assert(command("next").ok);
    assert(command("start").ok);
    advance(5_000);
  }
  const room = engine.rooms.get(admin.code)!;
  assert.equal(room.phase, "identity");
  const internal = (session: Session) =>
    room.players.find((p) => p.token === session.token)!;
  const defenders = players.filter((s) => internal(s).role === "defender");
  const impostor = players.find((s) => internal(s).role === "impostor")!;
  return {
    engine,
    room,
    admin,
    players,
    defenders,
    impostor,
    internal,
    action,
    command,
    advance,
  };
}

type Policy = {
  id: string;
  windowMs: number;
  graceMs: number;
  exemptPending: boolean;
};
export const POLICIES: readonly Policy[] = [
  { id: "actual_5s", windowMs: 5_000, graceMs: 0, exemptPending: false },
  { id: "ventana_8s", windowMs: 8_000, graceMs: 0, exemptPending: false },
  {
    id: "tolerancia_2s_por_tarjeta",
    windowMs: 5_000,
    graceMs: 2_000,
    exemptPending: false,
  },
  {
    id: "eximir_consulta_pendiente",
    windowMs: 5_000,
    graceMs: 0,
    exemptPending: true,
  },
];
type Observation = {
  time: number;
  cardId?: string;
  eligible: boolean;
  pending: boolean;
};

/** Counterfactual replay of inactivity only, on the exact same engine action trace. */
export class IdleReplay {
  penalties = 0;
  private deadline?: number;
  private cardId?: string;
  private shownAt = 0;
  constructor(readonly policy: Policy) {}
  observe(value: Observation, validAction = false) {
    if (!value.eligible || !value.cardId) {
      this.deadline = undefined;
      this.cardId = undefined;
      return;
    }
    const newCard = value.cardId !== this.cardId;
    if (newCard) {
      this.cardId = value.cardId;
      this.shownAt = value.time;
    }
    if (this.deadline === undefined || (newCard && this.policy.graceMs > 0))
      this.deadline = value.time + this.policy.windowMs + this.policy.graceMs;
    if (validAction) {
      this.deadline = value.time + this.policy.windowMs;
      if (this.policy.graceMs)
        this.deadline = Math.max(
          this.deadline,
          this.shownAt + this.policy.windowMs + this.policy.graceMs,
        );
      return;
    }
    while (value.time >= this.deadline) {
      if (!(this.policy.exemptPending && value.pending)) this.penalties++;
      this.deadline += this.policy.windowMs;
    }
  }
}

const PROFILES = [
  {
    id: "oraculo_3s",
    delayMs: 3_000,
    query: true,
    visual: false,
    allowAll: false,
    attack: false,
  },
  {
    id: "oraculo_6s",
    delayMs: 6_000,
    query: true,
    visual: false,
    allowAll: false,
    attack: false,
  },
  {
    id: "oraculo_9s",
    delayMs: 9_000,
    query: true,
    visual: false,
    allowAll: false,
    attack: false,
  },
  {
    id: "solo_visual_3s_con_ataque",
    delayMs: 3_000,
    query: false,
    visual: true,
    allowAll: false,
    attack: true,
  },
  {
    id: "permitir_todo_3s_con_ataque",
    delayMs: 3_000,
    query: false,
    visual: false,
    allowAll: true,
    attack: true,
  },
] as const;
const percent = (n: number, d: number) =>
  d ? Math.round((n / d) * 10_000) / 100 : 0;

export function runCase(
  capacity: 3 | 4 | 5 | 6,
  seed: number,
  profile: (typeof PROFILES)[number],
) {
  const f = identityFixture(capacity, seed);
  const models = f.players.map(() => POLICIES.map((p) => new IdleReplay(p)));
  const shownAt = new Map<string, number>();
  let wrong = 0,
    decisions = 0,
    normalSent = 0,
    advancedSent = 0;
  const observe = (index: number, validAction = false) => {
    const player = f.internal(f.players[index]);
    const card = player.card;
    if (card?.shown && !shownAt.has(card.id))
      shownAt.set(card.id, f.room.clock);
    // On a timeout, advanceInactivity runs before finishRound. An early hacker
    // victory in advanceIdentity disables it first. Preserve that event order.
    const timeoutTick =
      f.room.roundFinished &&
      f.room.clock === DEFAULT_SETTINGS.identitySeconds * 1_000 &&
      f.room.results.find((r) => r.phase === "identity")?.winner !== "impostor";
    const eligible =
      (f.room.stage === "playing" || timeoutTick) &&
      player.connected &&
      !player.blocked &&
      !!card?.shown;
    const observation = {
      time: f.room.clock,
      cardId: card?.id,
      eligible,
      pending:
        card?.verifyReadyAt !== undefined && f.room.clock < card.verifyReadyAt,
    };
    for (const model of models[index]) model.observe(observation, validAction);
  };
  const act = (session: Session, value: Omit<GameAction, "eventId">) => {
    const ack = f.action(session, value);
    if (
      ack.ok &&
      ["identity:decide", "identity:verify", "identity:send"].includes(
        value.type,
      )
    )
      observe(f.players.indexOf(session), true);
    return ack;
  };
  f.players.forEach((_, i) => observe(i));
  // Seeded scripted attacker. This is a test oracle, not student behaviour.
  if (profile.attack)
    assert(
      f.action(f.impostor, {
        type: "identity:challenge-solve",
        answer: f.internal(f.impostor).identityChallenge!.answer,
      }).ok,
    );
  while (!f.room.roundFinished) {
    for (const session of f.players) {
      const p = f.internal(session),
        card = p.card;
      if (!card) continue;
      const age = f.room.clock - shownAt.get(card.id)!;
      if (
        profile.query &&
        p.identityVerificationsRemaining > 0 &&
        card.verifyReadyAt === undefined &&
        age >= 1_000
      )
        act(session, { type: "identity:verify", cardId: card.id });
      if (
        age >= profile.delayMs &&
        !(card.verifyReadyAt !== undefined && f.room.clock < card.verifyReadyAt)
      ) {
        const accept = profile.allowAll
          ? true
          : profile.visual
            ? JSON.stringify(card.reference) === JSON.stringify(card.presented)
            : card.legit;
        const ok = act(session, {
          type: "identity:decide",
          cardId: card.id,
          accept,
        });
        if (ok.ok && p.role === "defender") {
          decisions++;
          if (accept !== card.legit) wrong++;
        }
      }
      if (f.room.roundFinished) break;
    }
    if (profile.attack && !f.room.roundFinished) {
      const hacker = f.internal(f.impostor);
      if (
        f.room.clock >= 40_000 &&
        !hacker.identityChallenge!.advancedUsed &&
        f.room.clock >= hacker.identityCooldownUntil
      ) {
        if (f.action(f.impostor, { type: "identity:send-advanced" }).ok)
          advancedSent++;
      } else if (f.room.clock >= hacker.identityCooldownUntil) {
        if (act(f.impostor, { type: "identity:send", alteration: "code" }).ok)
          normalSent++;
      }
    }
    if (!f.room.roundFinished) {
      f.advance(100);
      f.players.forEach((_, i) => observe(i));
    }
  }
  // Check replay against the real unmodified engine, including card replacement.
  f.players.forEach((s, i) =>
    assert.equal(
      models[i][0].penalties,
      f.internal(s).inactivityPenalties,
      `${profile.id}/${capacity}/${seed}/baseline`,
    ),
  );
  const defenders = f.defenders.map((s) => f.internal(s));
  const legitShown = defenders.reduce((sum, p) => sum + p.legitShown, 0);
  const authorized = defenders.reduce((sum, p) => sum + p.legitAuthorized, 0);
  const blocked = defenders.filter((p) => p.blocked).length;
  const targets = f.engine.snapshot(f.admin)!.public.sabotageTarget;
  const results = POLICIES.map((policy, at) => {
    const penalties = f.defenders.reduce(
      (sum, s) => sum + models[f.players.indexOf(s)][at].penalties,
      0,
    );
    const metric = percent(authorized, legitShown + penalties);
    const winner =
      targets > 0 && blocked >= targets
        ? "impostor"
        : metric >= 70
          ? "defenders"
          : "inconclusive";
    return { policy: policy.id, penalties, metric, winner };
  });
  const actual = f.room.results.find((r) => r.phase === "identity")!;
  assert.equal(results[0].metric, actual.metric);
  assert.equal(results[0].winner, actual.winner);
  assert.deepEqual(results[3], { ...results[0], policy: POLICIES[3].id });
  const expirationLogs = f.room.logs.filter(
    (l) =>
      l.phase === "identity" &&
      l.type === "identity_expire" &&
      defenders.some((p) => p.department === l.department),
  );
  const expired = expirationLogs.length;
  const expiredLegit = expirationLogs.filter((l) =>
    l.detail.includes("result=legitimate_lost"),
  ).length;
  return {
    capacity,
    seed,
    profile: profile.id,
    missionSeconds: f.room.clock / 1000,
    legitShown,
    authorized,
    decisions,
    wrong,
    expired,
    expiredLegit,
    unansweredLegit:
      legitShown -
      authorized -
      defenders.reduce((sum, p) => sum + p.identityLost, 0),
    infiltrations: defenders.reduce((sum, p) => sum + p.infiltrations, 0),
    blocked,
    targets,
    queries: defenders.reduce(
      (sum, p) => sum + 2 - p.identityVerificationsRemaining,
      0,
    ),
    normalSent,
    advancedSent,
    results,
  };
}

export function runStudy() {
  const cases: ReturnType<typeof runCase>[] = [];
  for (const capacity of [3, 4, 5, 6] as const)
    for (const seed of [7, 91, 2026])
      for (const profile of PROFILES)
        cases.push(runCase(capacity, seed, profile));
  const summary = PROFILES.flatMap((profile) =>
    POLICIES.map((policy) => {
      const group = cases.filter((c) => c.profile === profile.id);
      const rows = group.map(
        (c) => c.results.find((r) => r.policy === policy.id)!,
      );
      return {
        profile: profile.id,
        policy: policy.id,
        runs: group.length,
        meanMetric:
          Math.round(
            (rows.reduce((sum, r) => sum + r.metric, 0) / rows.length) * 100,
          ) / 100,
        penalties: rows.reduce((sum, r) => sum + r.penalties, 0),
        expired: group.reduce((sum, c) => sum + c.expired, 0),
        wrong: group.reduce((sum, c) => sum + c.wrong, 0),
        defendersWins: rows.filter((r) => r.winner === "defenders").length,
        impostorWins: rows.filter((r) => r.winner === "impostor").length,
        inconclusive: rows.filter((r) => r.winner === "inconclusive").length,
        minSeconds: Math.min(...group.map((c) => c.missionSeconds)),
        maxSeconds: Math.max(...group.map((c) => c.missionSeconds)),
      };
    }),
  );
  return {
    schema: 1,
    basis: "274e439d737190aeff7eb3fec8aa3f1e66482707",
    synthetic: true,
    note: "Offline replay with fixed decisions; not human evidence or a deployed balance change.",
    stepMs: 100,
    seeds: [7, 91, 2026],
    policyCount: POLICIES.length,
    policies: POLICIES,
    profiles: PROFILES,
    caseCount: cases.length,
    summary,
    cases,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.stdout.write(JSON.stringify(runStudy(), null, 2) + "\n");
