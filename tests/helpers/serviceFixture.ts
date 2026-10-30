import assert from "node:assert/strict";
import { GameEngine } from "../../server/engine";
import type { GameAction, Session } from "../../shared/types";
export function serviceFixture(capacity: 3 | 4 | 5 | 6 = 3) {
  let now = 0,
    sequence = 0,
    players: Session[] = [];
  const engine = new GameEngine({ now: () => now, random: () => 0.2 });
  const created = engine.create(capacity),
    admin = created.session!;
  engine.bind(admin, "operator");
  const room = engine.rooms.get(admin.code)!;
  const snapshot = (s = admin) => engine.snapshot(s)!;
  const command = (cmd: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `c${sequence++}`, cmd);
  const action = (s: Session, value: Omit<GameAction, "eventId">) =>
    engine.action(s, { eventId: `a${sequence++}`, ...value });
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  const internal = (s: Session) =>
    room.players.find((p) => p.token === s.token)!;
  const join = () => {
    players = snapshot().admin!.invites.map((invite) => {
      const joined = engine.join({
        code: admin.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `E2 ${invite.slot}`,
      });
      assert(joined.session);
      engine.bind(joined.session, `p${invite.slot}`);
      return joined.session;
    });
    assert(command("assign").ok);
  };
  const start = (phase: "mail" | "ddos" | "identity" | "recovery") => {
    for (const current of ["mail", "ddos", "identity", "recovery"] as const) {
      assert(command("start").ok);
      advance(5000);
      if (current === phase) return;
      assert(command("stop").ok);
      assert(command("next").ok);
    }
  };
  join();
  return {
    engine,
    admin,
    room,
    snapshot,
    command,
    action,
    advance,
    internal,
    start,
    join,
    get players() {
      return players;
    },
    get defenders() {
      return players.filter((s) => internal(s).role === "defender");
    },
  };
}
