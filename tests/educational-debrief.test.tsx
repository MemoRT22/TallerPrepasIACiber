import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EducationalDebrief as Debrief } from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import EducationalDebrief from "../client/components/EducationalDebrief";
import Player from "../client/pages/Player";
import Dashboard from "../client/pages/Dashboard";
import type { GameConnection } from "../client/useGame";
import { educationalFixture as fixture } from "./helpers/educationalFixture";

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: true }) },
});
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: { origin: "http://localhost", search: "", hash: "" },
});
const observed = (value: Debrief | undefined) => {
  assert(value?.kind === "observed");
  return value;
};

test("E1: Correos conserva solo evidencia visible; inspección y decisión, primera de máxima prioridad", () => {
  for (const accept of [false, true]) {
    const f = fixture();
    f.start("mail");
    const s = f.defenders[0],
      p = f.internal(s),
      mail = p.mail[0];
    assert(
      f.action(s, { type: "mail:classify", cardId: "inexistente", accept })
        .ok === false,
    );
    assert.equal(p.educationalEvidence, undefined);
    assert(f.action(s, { type: "mail:inspect", cardId: mail.id }).ok);
    assert.equal(f.snapshot(s).player!.educationalDebrief, undefined);
    assert(
      f.action(s, { type: "mail:classify", cardId: mail.id, accept }, "once")
        .ok,
    );
    const selected = structuredClone(p.educationalEvidence);
    assert(
      f.action(s, { type: "mail:classify", cardId: mail.id, accept }, "once")
        .ok,
    );
    const next = p.mail[0];
    assert(f.action(s, { type: "mail:inspect", cardId: next.id }).ok);
    assert(
      f.action(s, { type: "mail:classify", cardId: next.id, accept: !accept })
        .ok,
    );
    assert.deepEqual(p.educationalEvidence, selected);
    f.stop();
    const d = observed(f.snapshot(s).player!.educationalDebrief);
    assert(d.decision.includes(accept ? "Aceptaste" : "Rechazaste"));
    assert(d.evidence.includes(mail.preview.slice(0, 40)));
    assert(
      d.evidence.includes(mail.inspectionDetails.evidence[0].slice(0, 40)),
    );
    assert(!JSON.stringify(d).includes("senderToken"));
  }
});

test("E1: mismo correo visible produce igual debrief con otra fuente o clasificación oculta, para ambos roles", () => {
  const results = [];
  for (const source of ["auto", "player"] as const)
    for (const malicious of [false, true])
      for (const role of ["defender", "impostor"] as const) {
        const f = fixture();
        f.start("mail");
        const s = role === "defender" ? f.defenders[0] : f.impostor;
        const mail = f.internal(s).mail[0];
        mail.source = source;
        mail.malicious = malicious;
        mail.senderToken = f.impostor.token;
        mail.preview = "Solicitud visible idéntica";
        assert(
          f.action(s, { type: "mail:classify", cardId: mail.id, accept: true })
            .ok,
        );
        f.stop();
        const { roundId, ...d } = f.snapshot(s).player!.educationalDebrief!;
        results.push(d);
      }
  for (const d of results) assert.deepEqual(d, results[0]);
});

test("E1: DDoS selecciona azul sobre naranja y escudo; eventos rechazados o pausados no cuentan", () => {
  const f = fixture();
  f.start("ddos");
  const s = f.defenders[0];
  assert(f.command("pause").ok);
  assert(!f.action(s, { type: "ddos:shield" }).ok);
  assert.equal(f.internal(s).educationalEvidence, undefined);
  assert(f.command("resume").ok);
  assert(f.action(s, { type: "ddos:shield" }).ok);
  const shield = structuredClone(f.internal(s).educationalEvidence);
  assert(!f.action(s, { type: "ddos:shield" }).ok);
  assert.deepEqual(f.internal(s).educationalEvidence, shield);
  assert(f.action(s, { type: "ddos:tap", pointId: f.point(s, "red") }).ok);
  assert(f.action(s, { type: "ddos:tap", pointId: f.point(s, "blue") }).ok);
  assert(f.action(s, { type: "ddos:tap", pointId: f.point(s, "red") }).ok);
  f.stop();
  assert(
    observed(f.snapshot(s).player!.educationalDebrief).decision.includes(
      "azul",
    ),
  );
  for (const kind of ["red", "blue"] as const) {
    const g = fixture();
    g.start("ddos");
    const own = g.defenders[0];
    assert(g.action(own, { type: "ddos:tap", pointId: g.point(own, kind) }).ok);
    g.stop();
    assert(
      observed(g.snapshot(own).player!.educationalDebrief).evidence.includes(
        kind === "red" ? "malicioso" : "legítima",
      ),
    );
  }
});

test("E1: escudo no presupone absorciones y saturación describe solo el servicio propio", () => {
  const f = fixture();
  f.start("ddos");
  const s = f.defenders[0];
  assert(f.action(s, { type: "ddos:shield" }).ok);
  f.stop();
  assert(
    !observed(f.snapshot(s).player!.educationalDebrief).consequence.includes(
      "absorbió",
    ),
  );
  const g = fixture();
  g.start("ddos");
  const own = g.defenders[0];
  assert(g.command("pause").ok);
  g.internal(own).saturation = g.room.settings.saturationLimit;
  assert(g.command("resume").ok);
  g.stop();
  assert(
    observed(g.snapshot(own).player!.educationalDebrief).decision.includes(
      "saturación",
    ),
  );
});

test("E1: Identidad diferencia lo visible de la consulta disponible; no confirma legitimidad oculta", () => {
  for (const query of [false, true])
    for (const correct of [false, true]) {
      const f = fixture();
      f.start("identity");
      const s = f.defenders[0],
        card = f.internal(s).card!;
      if (query) {
        assert(f.action(s, { type: "identity:verify", cardId: card.id }).ok);
        f.advance(1500);
      }
      assert(
        f.action(s, {
          type: "identity:decide",
          cardId: card.id,
          accept: correct ? card.legit : !card.legit,
        }).ok,
      );
      assert.equal(f.snapshot(s).player!.educationalDebrief, undefined);
      f.stop();
      const d = observed(f.snapshot(s).player!.educationalDebrief);
      assert.equal(d.evidence.includes("registro disponible"), query);
      assert(
        d.learning.includes("visualmente idéntica no garantiza autorización"),
      );
      assert(!d.evidence.includes("source="));
    }
  const values = [];
  for (const legit of [false, true]) {
    const f = fixture();
    f.start("identity");
    const s = f.defenders[0],
      card = f.internal(s).card!;
    card.presented = { ...card.reference };
    card.legit = legit;
    card.tier = legit ? "legit" : "advanced";
    assert(
      f.action(s, { type: "identity:decide", cardId: card.id, accept: true })
        .ok,
    );
    f.stop();
    const { roundId, ...d } = f.snapshot(s).player!.educationalDebrief!;
    values.push(d);
  }
  assert.deepEqual(values[0], values[1]);
});

test("E1: consultar no implica comprensión, respuesta completada ni decisión correcta", () => {
  const f = fixture();
  f.start("identity");
  const s = f.defenders[0],
    card = f.internal(s).card!;
  assert(f.action(s, { type: "identity:verify", cardId: card.id }).ok);
  assert(
    !f.action(s, { type: "identity:decide", cardId: card.id, accept: true }).ok,
  );
  f.stop();
  const d = observed(f.snapshot(s).player!.educationalDebrief);
  assert(d.decision.includes("Solicitaste"));
  assert(!d.evidence.includes("ACTIVA"));
  assert(d.consequence.includes("no demuestra"));
});

test("E1: Recuperación valida respuesta sin equiparar ejercicio con restauración; misma devolución para ambos roles", () => {
  const f = fixture();
  f.start("recovery");
  const s = f.defenders[0];
  assert(!f.action(s, { type: "recovery:solve", answer: "incorrecta" }).ok);
  assert.equal(f.internal(s).educationalEvidence, undefined);
  assert(
    f.action(s, {
      type: "recovery:solve",
      answer: f.internal(s).fragment!.answer,
    }).ok,
  );
  assert.equal(f.room.recoveryCompleted, 1);
  assert(
    f.action(f.impostor, {
      type: "recovery:challenge-solve",
      answer: f.internal(f.impostor).recoveryChallenge!.answer,
    }).ok,
  );
  f.stop();
  const own = observed(f.snapshot(s).player!.educationalDebrief),
    hacker = observed(f.snapshot(f.impostor).player!.educationalDebrief);
  assert.deepEqual(own, hacker);
  assert(own.consequence.includes("progreso colectivo"));
  assert(own.learning.includes("no criptografía segura moderna"));
  assert(!JSON.stringify(own).includes("sabotaje"));
});

test("E1: verificar clave solo afirma el inicio; autor y destino de alteración quedan fuera del debrief", () => {
  const f = fixture();
  f.start("recovery");
  const s = f.defenders[0];
  assert(
    f.action(f.impostor, {
      type: "recovery:challenge-solve",
      answer: f.internal(f.impostor).recoveryChallenge!.answer,
    }).ok,
  );
  const previous = structuredClone(f.internal(f.impostor).educationalEvidence);
  assert(
    f.action(f.impostor, {
      type: "recovery:sabotage",
      target: f.internal(s).department,
    }).ok,
  );
  assert.deepEqual(f.internal(f.impostor).educationalEvidence, previous);
  assert(f.action(s, { type: "recovery:verify" }).ok);
  f.stop();
  const d = observed(f.snapshot(s).player!.educationalDebrief);
  assert(d.decision.includes("Solicitaste verificar"));
  assert(d.consequence.includes("Se inició"));
  assert(!JSON.stringify(d).includes(f.internal(s).department));
  assert(!JSON.stringify(d).includes(f.impostor.token));
});

test("E1: cuatro misiones sin evidencia, interrumpidas o inconclusas y con 3–6 participantes", () => {
  for (const capacity of [3, 4, 5, 6] as const)
    for (const phase of ["mail", "ddos", "identity", "recovery"] as const) {
      const f = fixture(capacity);
      f.start(phase);
      assert.deepEqual(f.room.settings, DEFAULT_SETTINGS);
      f.stop();
      for (const s of f.players) {
        const d = f.snapshot(s).player!.educationalDebrief!;
        assert.equal(d.kind, "general");
        assert.equal(d.roundId, f.room.roundNonce);
        assert.equal(d.phase, phase);
        assert(!JSON.stringify(d).includes("decision"));
      }
    }
  const f = fixture();
  f.start("identity");
  f.advance(120_000);
  assert.equal(f.room.results.at(-1)!.winner, "inconclusive");
  assert.equal(
    f.snapshot(f.defenders[0]).player!.educationalDebrief!.kind,
    "general",
  );
});

test("E1: victorias reales no cambian la selección ni otorgan puntos extra; cierre anticipado conserva el caso", () => {
  const f = fixture();
  f.start("mail");
  const classify = () => {
    for (const s of f.defenders)
      for (const card of [...f.internal(s).mail])
        assert(
          f.action(s, {
            type: "mail:classify",
            cardId: card.id,
            accept: !card.malicious,
          }).ok,
        );
  };
  classify();
  for (let i = 0; i < 4; i++) {
    f.advance(30_000);
    classify();
  }
  f.advance(30_000);
  assert.equal(f.room.results.at(-1)!.winner, "defenders");
  assert.equal(f.room.scores.defenders, 1);
  assert.equal(
    f.snapshot(f.defenders[0]).player!.educationalDebrief!.kind,
    "observed",
  );
  const g = fixture();
  g.start("mail");
  const s = g.defenders[0];
  for (let i = 0; i < 3; i++) {
    if (i) g.advance(30_000);
    assert(
      g.action(g.impostor, {
        type: "mail:send",
        templateId: "fake-support",
        target: g.internal(s).department,
      }).ok,
    );
    const sent = g.internal(s).mail.find((card) => card.source === "player")!;
    const ack = g.action(s, {
      type: "mail:classify",
      cardId: sent.id,
      accept: true,
    });
    assert(ack.ok);
    if (i === 2)
      assert.equal(ack.snapshot!.player!.educationalDebrief!.kind, "observed");
  }
  assert.equal(g.room.scores.impostor, 1);
  assert.equal(g.room.clock, 60_000);
  assert.equal(
    g.snapshot(g.impostor).player!.educationalDebrief!.kind,
    "general",
  );
});

test("E1: privacidad por jugador y público, deduplicación, pausa, reconexión, reinicio y nuevo grupo", () => {
  for (const capacity of [3, 4, 5, 6] as const) {
    const f = fixture(capacity);
    f.start("mail");
    f.players.forEach((s, i) => {
      const card = f.internal(s).mail[0];
      card.preview = `SOLO_PROPIO_${i}`;
      assert(
        f.action(s, { type: "mail:classify", cardId: card.id, accept: true })
          .ok,
      );
    });
    const s = f.defenders[0],
      prior = structuredClone(f.internal(s).educationalEvidence);
    assert(f.command("pause").ok);
    f.advance(9000);
    assert.deepEqual(f.internal(s).educationalEvidence, prior);
    assert.equal(f.snapshot(s).player!.educationalDebrief, undefined);
    assert(f.command("resume").ok);
    f.engine.unbind(`terminal-${s.slot}`);
    assert(f.engine.resume(s).ok);
    f.engine.bind(s, `reconnected-${s.slot}`);
    f.stop();
    f.players.forEach((session, i) => {
      const snapshot = f.snapshot(session),
        serialized = JSON.stringify(snapshot);
      assert(serialized.includes(`SOLO_PROPIO_${i}`));
      for (let j = 0; j < capacity; j++)
        if (j !== i) assert(!serialized.includes(`SOLO_PROPIO_${j}`));
      assert.equal(snapshot.admin, undefined);
      assert.equal(f.engine.snapshot({ ...session, kind: "admin" }), null);
    });
    const publicState = f.engine.getPublicSnapshot(f.admin.code)!;
    assert(!JSON.stringify(publicState).includes("SOLO_PROPIO_"));
    assert(!JSON.stringify(publicState).includes("educational"));
    const own = structuredClone(f.snapshot(s).player!.educationalDebrief);
    assert(f.engine.resume(s).ok);
    assert.deepEqual(f.snapshot(s).player!.educationalDebrief, own);
    assert(f.command("restart").ok);
    assert.equal(f.snapshot(s).player!.educationalDebrief, undefined);
    assert.equal(f.internal(s).educationalEvidence, undefined);
    assert(f.command("start").ok);
    f.advance(5000);
    f.stop();
    assert.equal(f.snapshot(s).player!.educationalDebrief!.kind, "general");
    const old = [...f.players];
    assert(f.command("reset-all").ok);
    for (const session of old) assert.equal(f.engine.snapshot(session), null);
    f.joinGroup();
    f.start("mail");
    f.stop();
    for (const session of f.players)
      assert.equal(
        f.snapshot(session).player!.educationalDebrief!.kind,
        "general",
      );
  }
});

test("E1: orden resultado → análisis → E4, P9 primero, y sin tarjeta en proyector/juicio o ronda ajena", () => {
  for (const phase of ["mail", "ddos", "identity", "recovery"] as const) {
    const f = fixture();
    f.start(phase);
    const s = f.defenders[0];
    f.stop();
    const snapshot = f.snapshot(s);
    const game = { snapshot, connected: true, error: "" } as GameConnection;
    const html = renderToStaticMarkup(
      createElement(Player, { code: f.admin.code, game }),
    );
    assert(html.includes("SIN UNA DECISIÓN DESTACADA REGISTRADA"));
    assert(
      html.indexOf("ANÁLISIS DE TU DECISIÓN") <
        html.indexOf("Continuidad de la crisis"),
    );
    if (phase === "recovery")
      assert(
        html.indexOf("Protocolo de restauración") <
          html.indexOf("ANÁLISIS DE TU DECISIÓN"),
      );
    else
      assert(
        html.indexOf("Ronda terminada") <
          html.indexOf("ANÁLISIS DE TU DECISIÓN"),
      );
    assert(
      !renderToStaticMarkup(
        createElement(Dashboard, { state: snapshot.public }),
      ).includes("ANÁLISIS DE TU DECISIÓN"),
    );
    for (const state of [
      { ...snapshot.public, roundId: "other" },
      { ...snapshot.public, stage: "playing" as const },
      { ...snapshot.public, phase: "voting" as const },
    ])
      assert.equal(
        renderToStaticMarkup(
          createElement(EducationalDebrief, {
            state,
            debrief: snapshot.player!.educationalDebrief,
          }),
        ),
        "",
      );
  }
});

test("E1: el emisor no recibe por el debrief el éxito de suplantaciones ni de oleadas", () => {
  const outcomes = [];
  for (const accept of [true, false]) {
    const f = fixture();
    f.start("identity");
    const hacker = f.impostor;
    assert(
      f.action(hacker, {
        type: "identity:challenge-solve",
        answer: f.internal(hacker).identityChallenge!.answer,
      }).ok,
    );
    f.advance(40_000);
    assert(f.action(hacker, { type: "identity:send-advanced" }).ok);
    const target = f.defenders.find((s) =>
      f
        .internal(s)
        .pendingCards.some(
          (card) => card.tier === "advanced" && card.source === "player",
        ),
    )!;
    const injected = f
      .internal(target)
      .pendingCards.find(
        (card) => card.tier === "advanced" && card.source === "player",
      )!;
    for (let i = 0; f.internal(target).card!.id !== injected.id; i++) {
      assert(i < 4);
      const card = f.internal(target).card!;
      assert(
        f.action(target, {
          type: "identity:decide",
          cardId: card.id,
          accept: card.legit,
        }).ok,
      );
    }
    assert(
      f.action(target, { type: "identity:decide", cardId: injected.id, accept })
        .ok,
    );
    assert.equal(f.internal(target).infiltrations, accept ? 1 : 0);
    f.stop();
    const { roundId, ...data } = f.snapshot(hacker).player!.educationalDebrief!;
    assert.equal(data.kind, "general");
    outcomes.push(data);
  }
  assert.deepEqual(outcomes[0], outcomes[1]);
  const f = fixture();
  f.start("ddos");
  const hacker = f.impostor;
  assert(
    f.action(hacker, {
      type: "ddos:challenge-solve",
      answer: f.internal(hacker).ddosChallenge!.answer,
    }).ok,
  );
  assert(
    f.action(hacker, {
      type: "ddos:wave",
      target: f.internal(f.defenders[0]).department,
    }).ok,
  );
  f.advance(4000);
  f.stop();
  assert.equal(f.snapshot(hacker).player!.educationalDebrief!.kind, "general");
});

test("E1: P9 y E5 mantienen sus fuentes; el juicio no conserva casos de misiones anteriores", async () => {
  const { teacherDebrief } = await import("../client/teacherDebrief");
  const f = fixture();
  f.start("recovery");
  for (const s of f.defenders)
    assert(
      f.action(s, {
        type: "recovery:solve",
        answer: f.internal(s).fragment!.answer,
      }).ok,
    );
  assert.equal(f.room.stage, "finished");
  assert.equal(f.room.recoveryDone, true);
  assert.equal(f.room.recoveryCompleted, f.room.recoveryTotal);
  assert(f.command("judgment").ok);
  for (const s of f.players)
    assert.equal(f.snapshot(s).player!.educationalDebrief, undefined);
  assert(f.command("voting").ok);
  assert(f.command("reveal").ok);
  f.advance(30_000);
  const snapshot = f.snapshot(f.admin);
  assert(teacherDebrief(snapshot.public, snapshot.admin));
  for (const s of f.players) {
    const own = f.snapshot(s);
    assert.equal(own.player!.educationalDebrief, undefined);
    assert.equal(own.admin, undefined);
    assert.deepEqual(own.public.reveal!.logs, []);
    assert.deepEqual(own.public.reveal!.votes, []);
  }
});

test("E1: no se divulga inspección no solicitada ni registro sin respuesta disponible", () => {
  const f = fixture();
  f.start("mail");
  const s = f.defenders[0],
    mail = f.internal(s).mail[0];
  mail.inspectionDetails.evidence = ["INSPECCION_NO_VISIBLE"];
  assert(
    f.action(s, { type: "mail:classify", cardId: mail.id, accept: true }).ok,
  );
  f.stop();
  assert(!JSON.stringify(f.snapshot(s)).includes("INSPECCION_NO_VISIBLE"));
  const g = fixture();
  g.start("identity");
  const own = g.defenders[0],
    card = g.internal(own).card!;
  card.registry = {
    heading: "REGISTRO_NO_VISIBLE",
    evidence: [{ label: "Autorización", value: "EVIDENCIA_NO_VISIBLE" }],
  };
  assert(
    g.action(own, { type: "identity:decide", cardId: card.id, accept: true })
      .ok,
  );
  g.stop();
  assert(!JSON.stringify(g.snapshot(own)).includes("EVIDENCIA_NO_VISIBLE"));
  assert(!JSON.stringify(g.snapshot(own)).includes("REGISTRO_NO_VISIBLE"));
});
