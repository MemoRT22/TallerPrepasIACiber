import assert from "node:assert/strict";
import { GameEngine } from "../../server/engine";
import type { CityMission, GameAction, Session } from "../../shared/types";

export function educationalFixture(capacity: 3 | 4 | 5 | 6 = 3) {
  let now = 0,
    event = 0,
    players: Session[] = [];
  const engine = new GameEngine({ now: () => now, random: () => 0.2 });
  const created = engine.create(capacity),
    admin = created.session!;
  engine.bind(admin, "operator");
  const room = engine.rooms.get(admin.code)!;
  const advance = (ms: number) => {
    now += ms;
    engine.tick();
  };
  const command = (cmd: Parameters<typeof engine.admin>[2]) =>
    engine.admin(admin, `c${event++}`, cmd);
  const action = (
    s: Session,
    value: Omit<GameAction, "eventId">,
    id?: string,
  ) => engine.action(s, { eventId: id ?? `a${event++}`, ...value });
  const internal = (s: Session) =>
    room.players.find((p) => p.token === s.token)!;
  const snapshot = (s: Session) => engine.snapshot(s)!;
  const joinGroup = () => {
    players = engine.snapshot(admin)!.admin!.invites.map((invite) => {
      const joined = engine.join({
        code: admin.code,
        slot: invite.slot,
        invite: invite.invite,
        name: `E1 ${invite.slot}`,
      });
      assert(joined.session);
      engine.bind(joined.session, `terminal-${invite.slot}`);
      return joined.session;
    });
    assert(command("assign").ok);
  };
  const start = (phase: CityMission) => {
    for (const current of ["mail", "ddos", "identity", "recovery"] as const) {
      assert(command("start").ok);
      advance(5000);
      assert.equal(room.phase, current);
      if (current === phase) return;
      assert(command("stop").ok);
      assert(command("next").ok);
    }
  };
  const stop = () => assert(command("stop").ok);
  const point = (s: Session, kind: "red" | "blue") => {
    const p = internal(s),
      id = `point-${event++}`;
    p.traffic.push({
      id,
      kind,
      angle: 0,
      born: room.clock,
      arrives: room.clock + 4000,
      ownerToken: s.token,
    });
    return id;
  };
  joinGroup();
  return {
    engine,
    room,
    admin,
    advance,
    command,
    action,
    internal,
    snapshot,
    joinGroup,
    start,
    stop,
    point,
    get players() {
      return players;
    },
    get defenders() {
      return players.filter((s) => internal(s).role === "defender");
    },
    get impostor() {
      return players.find((s) => internal(s).role === "impostor")!;
    },
  };
}
