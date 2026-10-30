// Reproducible examples from isolated synthetic engine fixtures; never runs in the application.
import assert from "node:assert/strict";
import type { Snapshot } from "../../shared/types";
import { educationalFixture as fixture } from "../../tests/helpers/educationalFixture";
const snapshots: Record<string, Snapshot> = {};
{
  const f = fixture();
  f.start("mail");
  const s = f.defenders[0],
    mail = f.internal(s).mail.find((m) => m.malicious)!;
  assert(f.action(s, { type: "mail:inspect", cardId: mail.id }).ok);
  assert(
    f.action(s, { type: "mail:classify", cardId: mail.id, accept: true }).ok,
  );
  f.stop();
  snapshots.mail = f.snapshot(s);
}
{
  const f = fixture();
  f.start("ddos");
  const s = f.defenders[0],
    blue = f.internal(s).traffic.find((p) => p.kind === "blue")!;
  assert(f.action(s, { type: "ddos:tap", pointId: blue.id }).ok);
  f.stop();
  snapshots.ddos = f.snapshot(s);
}
{
  const f = fixture();
  f.start("identity");
  const h = f.impostor;
  assert(
    f.action(h, {
      type: "identity:challenge-solve",
      answer: f.internal(h).identityChallenge!.answer,
    }).ok,
  );
  f.advance(40_000);
  assert(f.action(h, { type: "identity:send-advanced" }).ok);
  const s = f.defenders.find((s) =>
    f
      .internal(s)
      .pendingCards.some((c) => c.tier === "advanced" && c.source === "player"),
  )!;
  const card = f
    .internal(s)
    .pendingCards.find((c) => c.tier === "advanced" && c.source === "player")!;
  while (f.internal(s).card!.id !== card.id) {
    const current = f.internal(s).card!;
    assert(
      f.action(s, {
        type: "identity:decide",
        cardId: current.id,
        accept: current.legit,
      }).ok,
    );
  }
  assert(f.action(s, { type: "identity:verify", cardId: card.id }).ok);
  f.advance(1500);
  assert(
    f.action(s, { type: "identity:decide", cardId: card.id, accept: false }).ok,
  );
  f.stop();
  snapshots.identity = f.snapshot(s);
}
{
  const f = fixture();
  f.start("recovery");
  const s = f.defenders[0];
  for (const actor of f.defenders)
    assert(
      f.action(actor, {
        type: "recovery:solve",
        answer: f.internal(actor).fragment!.answer,
      }).ok,
    );
  snapshots.recovery = f.snapshot(s);
}
{
  const f = fixture();
  f.start("recovery");
  const s = f.defenders[0],
    h = f.impostor;
  assert(
    f.action(h, {
      type: "recovery:challenge-solve",
      answer: f.internal(h).recoveryChallenge!.answer,
    }).ok,
  );
  assert(
    f.action(h, { type: "recovery:sabotage", target: f.internal(s).department })
      .ok,
  );
  assert(f.action(s, { type: "recovery:verify" }).ok);
  f.stop();
  snapshots["recovery-verify"] = f.snapshot(s);
}
{
  const f = fixture();
  f.start("mail");
  f.stop();
  snapshots["no-evidence"] = f.snapshot(f.defenders[0]);
}
process.stdout.write(
  JSON.stringify(
    Object.entries(snapshots).map(([scenario, s]) => {
      const { roundId, ...evidence } = s.player!.educationalDebrief!;
      return { scenario, ...evidence };
    }),
    null,
    2,
  ) + "\n",
);
