import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Shell } from "../client/components/UI";
import Briefing from "../client/components/Briefing";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import type { PlayerState } from "../shared/types";

// CityMap only reads the motion preference until its effect mounts.
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: true }) },
});
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: {
    origin: "http://localhost",
    search: "",
    hash: "",
    pathname: "/docente",
  },
});
const player: PlayerState = {
  id: "private",
  slot: 1,
  name: "Equipo",
  department: "agua",
  node: "777",
  role: "impostor",
  coverRole: "Responsable de Agua",
  coverTask: "Mantén agua disponible",
  blocked: false,
  mail: [],
  templates: [],
  mailCooldown: 0,
  saturation: 0,
  traffic: [],
  card: null,
  pendingCards: 0,
  identityCooldown: 0,
};

test("shells público y jugador no ofrecen salas ni controles administrativos", () => {
  for (const active of ["monitor", "player"]) {
    const html = renderToStaticMarkup(
      createElement(Shell, { active, children: "Vista" }),
    );
    assert(!html.includes('href="/docente"'));
    assert(!html.includes('href="/guia"'));
    assert(!html.includes("Crear"));
    assert(html.includes("Anáhuac Cancún"));
    assert(html.includes("Instituto Artek"));
  }
});

test("pantalla presenta estados y resultado, sin paneles de parámetros ni inicio", () => {
  const state = {
    ...DEMO_STATE,
    departments: DEMO_STATE.departments.map((d, i) => ({
      ...d,
      status: (i === 0 ? "down" : i === 1 ? "warning" : "operational") as
        | "down"
        | "warning"
        | "operational",
    })),
  };
  const html = renderToStaticMarkup(createElement(Dashboard, { state }));
  for (const label of ["Fuera de línea", "En riesgo", "En línea"])
    assert(html.includes(label));
  for (const forbidden of [
    "Configurar",
    "Crear sala",
    "Dar señal",
    "precision",
    "PARTICIPANTES",
    'href="/docente"',
  ])
    assert(!html.includes(forbidden));
  assert(!html.includes("777"));
  assert(!html.includes("private"));
});

test("instrucciones no descubren al impostor sin abrir su rol privado", () => {
  const state = {
    ...DEMO_STATE,
    assigned: true,
    stage: "briefing" as const,
    phase: "mail" as const,
  };
  const html = renderToStaticMarkup(
    createElement(Briefing, { state, player, roleVisible: false }),
  );
  assert(html.includes("MISIÓN RÁPIDA · LEE Y ACTÚA"));
  assert(html.includes("Acepta @cancun.example"));
  assert(!html.includes("Tu misión secreta"));
  const visible = renderToStaticMarkup(
    createElement(Briefing, { state, player, roleVisible: true }),
  );
  assert(visible.includes("Tu misión secreta"));
});

test("cuenta regresiva anuncia amenaza y no genera botones para comenzar", () => {
  const state = {
    ...DEMO_STATE,
    stage: "countdown" as const,
    countdown: 4,
    phase: "ddos" as const,
    running: true,
  };
  const html = renderToStaticMarkup(
    createElement(Briefing, { state, player, roleVisible: false }),
  );
  assert(html.includes("AMENAZA DETECTADA"));
  assert(html.includes('countdown-number">4'));
  assert(!html.includes("<button"));
  assert(!html.includes("Tu misión secreta"));
});

test("ritmo exprés muestra presión, reloj destacado y siguiente misión", async () => {
  const { default: DdosGame } = await import("../client/games/DdosGame");
  const { default: IdentityGame } = await import(
    "../client/games/IdentityGame"
  );
  const game = {
    connected: true,
    busy: false,
    act: () => Promise.resolve({ ok: true }),
  } as unknown as import("../client/useGame").GameConnection;
  const playing = {
    ...DEMO_STATE,
    stage: "playing" as const,
    running: true,
  };
  const criticalDdos = renderToStaticMarkup(
    createElement(DdosGame, {
      state: {
        ...playing,
        phase: "ddos",
        duration: 90,
        remaining: 25,
        clock: 65_000,
      },
      player,
      game,
    }),
  );
  assert(criticalDdos.includes("TRÁFICO CRÍTICO"));
  const ddosBriefing = renderToStaticMarkup(
    createElement(Briefing, {
      state: { ...playing, phase: "ddos", stage: "briefing" },
      player,
      roleVisible: false,
    }),
  );
  assert(ddosBriefing.includes("Con cruces naranjas pendientes"));
  assert(!ddosBriefing.includes("Con elementos pendientes"));
  const agileIdentity = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: {
        ...playing,
        phase: "identity",
        duration: 120,
        remaining: 70,
        clock: 50_000,
      },
      player,
      game,
    }),
  );
  assert(agileIdentity.includes("RITMO ÁGIL"));

  const transition = renderToStaticMarkup(
    createElement(Dashboard, {
      state: {
        ...DEMO_STATE,
        phase: "mail",
        stage: "finished",
        results: [
          {
            phase: "mail",
            winner: "defenders",
            metric: 90,
            description: "La precisión defensora alcanzó el umbral.",
          },
        ],
      },
    }),
  );
  assert(transition.includes("Siguiente: Defensa ante saturación"));
});

test("ocultar rol también oculta herramientas y guías secretas de los minijuegos", async () => {
  const { default: IdentityGame } = await import(
    "../client/games/IdentityGame"
  );
  const { default: MailGame } = await import("../client/games/MailGame");
  const game = {
    connected: true,
    busy: false,
    act: () => Promise.resolve({ ok: true }),
  } as unknown as import("../client/useGame").GameConnection;
  const state = {
    ...DEMO_STATE,
    stage: "playing" as const,
    phase: "identity" as const,
    running: true,
  };
  const hidden = renderToStaticMarkup(
    createElement(IdentityGame, { state, player, game, roleVisible: false }),
  );
  assert(!hidden.includes("Enviar solicitud"));
  const visible = renderToStaticMarkup(
    createElement(IdentityGame, { state, player, game, roleVisible: true }),
  );
  assert(visible.includes("Enviar solicitud"));
  const sender = {
    ...player,
    templates: [
      { id: "safe", sender: "agua@cancun.example", subject: "Reporte normal" },
      {
        id: "trap",
        sender: "soporte@cancunn.example",
        subject: "Mensaje alterado",
      },
    ],
  };
  const mail = renderToStaticMarkup(
    createElement(MailGame, {
      state: { ...state, phase: "mail" },
      player: sender,
      game,
      roleVisible: false,
    }),
  );
  assert(mail.includes("Reporte normal"));
  assert(!mail.includes("Mensaje alterado"));
  assert(!mail.includes("GUÍA PRIVADA"));
});

test("el reinicio total está visible solo en el panel administrativo y no se ejecuta al renderizar", async () => {
  const { default: Admin } = await import("../client/pages/Admin");
  const game = {
    snapshot: { public: DEMO_STATE, admin: { players: [], invites: [] } },
    connected: true,
    busy: false,
    session: { code: "8378", token: "admin-test", kind: "admin" },
    canCreate: true,
  } as unknown as import("../client/useGame").GameConnection;
  const html = renderToStaticMarkup(createElement(Admin, { game }));
  assert(html.includes("Reiniciar toda la actividad"));
  assert(!html.includes("Reiniciar y sacar a todos"));
  const publicHtml = renderToStaticMarkup(
    createElement(Dashboard, { state: DEMO_STATE }),
  );
  assert(!publicHtml.includes("Reiniciar toda la actividad"));
});

test("foto, código e icono producen diferencias visuales reales en la credencial presentada", async () => {
  const { CredentialCard, Avatar } = await import(
    "../client/games/IdentityGame"
  );
  const portraits = Array.from({ length: 6 }, (_, value) =>
    renderToStaticMarkup(createElement(Avatar, { value })).replace(
      /aria-label="[^"]*"/g,
      "",
    ),
  );
  assert.equal(new Set(portraits).size, 6);
  const base = { avatar: 0, code: "1023", symbol: 0 };
  const original = renderToStaticMarkup(
    createElement(CredentialCard, { credential: base }),
  );
  for (const changed of [
    { ...base, avatar: 1 },
    { ...base, code: "0123" },
    { ...base, symbol: 1 },
  ]) {
    assert.notEqual(
      renderToStaticMarkup(
        createElement(CredentialCard, { credential: changed }),
      ),
      original,
    );
  }
  const reference = renderToStaticMarkup(
    createElement(CredentialCard, { credential: base, reference: true }),
  );
  assert(reference.includes("CREDENCIAL OFICIAL"));
  assert(original.includes("CREDENCIAL PRESENTADA"));
});

test("ciudad muestra QR público solo durante incorporación y no contiene accesos privados", () => {
  const waiting = {
    ...DEMO_STATE,
    code: "8378",
    autoStart: true,
    capacity: 4,
    playersCount: 2,
    connectedCount: 2,
  };
  const html = renderToStaticMarkup(
    createElement(Dashboard, { state: waiting }),
  );
  assert(html.includes("city-join-qr"));
  assert(html.includes("Escanea y entra"));
  assert(html.includes('href="/jugar?code=8378"'));
  assert(html.includes("2 / 4"));
  assert(!html.includes("#access="));
  assert(!html.includes("invite="));
  assert(!html.includes("token="));
  assert(!html.includes("Mi rol"));
  for (const stage of [
    "briefing",
    "countdown",
    "playing",
    "finished",
  ] as const) {
    const ready = renderToStaticMarkup(
      createElement(Dashboard, {
        state: {
          ...waiting,
          assigned: true,
          phase: "mail",
          stage,
          playersCount: 4,
          connectedCount: 4,
          briefingRemaining: 20,
        },
      }),
    );
    assert(!ready.includes("city-join-qr"));
  }
  const disconnected = renderToStaticMarkup(
    createElement(Dashboard, {
      state: {
        ...waiting,
        assigned: true,
        phase: "mail",
        stage: "countdown",
        connectedCount: 3,
        paused: true,
      },
    }),
  );
  assert(!disconnected.includes("city-join-qr"));
  assert(
    !renderToStaticMarkup(
      createElement(Dashboard, { state: waiting, demo: true }),
    ).includes("city-join-qr"),
  );
});

test("lectura automática muestra segundos de servidor y solo admin puede pausar", async () => {
  const { default: Admin } = await import("../client/pages/Admin");
  const state = {
    ...DEMO_STATE,
    code: "8378",
    autoStart: true,
    phase: "mail" as const,
    assigned: true,
    stage: "briefing" as const,
    running: true,
    briefingRemaining: 17,
    playersCount: 4,
    connectedCount: 4,
  };
  const html = renderToStaticMarkup(
    createElement(Briefing, { state, player, roleVisible: false }),
  );
  assert(html.includes("17 segundos"));
  assert(!html.includes("Tu misión secreta"));
  assert(!html.includes("<button"));
  const game = {
    snapshot: { public: state, admin: { players: [], invites: [] } },
    connected: true,
    busy: false,
    session: { code: "8378", token: "private-test", kind: "admin" },
    canCreate: true,
  } as unknown as import("../client/useGame").GameConnection;
  const adminHtml = renderToStaticMarkup(createElement(Admin, { game }));
  assert(adminHtml.includes("Pausar experiencia"));
  assert(!adminHtml.includes("Dar señal e iniciar"));
  const paused = renderToStaticMarkup(
    createElement(Briefing, {
      state: { ...state, paused: true },
      player,
      roleVisible: false,
    }),
  );
  assert(paused.includes("Lectura pausada"));
});

test("terminal en espera conserva identidad pero no muestra el minijuego actual", async () => {
  const { default: Player } = await import("../client/pages/Player");
  const state = {
    ...DEMO_STATE,
    code: "8378",
    phase: "identity" as const,
    stage: "playing" as const,
    assigned: true,
    running: true,
  };
  const game = {
    snapshot: {
      public: state,
      player: { ...player, waitingForNextRound: true },
    },
    connected: true,
    busy: false,
    error: "",
    left: false,
    setError: () => {},
    leave: () => {},
    reconnect: () => {},
  } as unknown as import("../client/useGame").GameConnection;
  const html = renderToStaticMarkup(createElement(Player, { game }));
  assert(html.includes("Te reincorporas en el siguiente juego"));
  assert(html.includes("Responsable de Agua"));
  assert(!html.includes("CREDENCIAL PRESENTADA"));
  assert(!html.includes("Permitir acceso"));
  assert(!html.includes("Enviar solicitud"));
  assert(!html.includes("Pausa. Espera"));
  const left = renderToStaticMarkup(
    createElement(Player, { game: { ...game, left: true, connected: false } }),
  );
  assert(left.includes("Saliste de tu terminal"));
  assert(left.includes("Reconectarme"));
  assert(left.includes("El equipo sigue jugando"));
  assert(!left.includes("CREDENCIAL PRESENTADA"));
});

test("impostor se revela sobre el mapa y en su servicio solo después de la votación autorizada", () => {
  const reveal = {
    impostorDepartmentId: "energia",
    impostorDepartment: "Energía",
    impostorName: "Alex privado",
    winner: "tie" as const,
    votes: [],
    logs: [],
  };
  for (const phase of [
    "lobby",
    "mail",
    "ddos",
    "identity",
    "recovery",
    "voting",
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(Dashboard, { state: { ...DEMO_STATE, phase, reveal } }),
    );
    assert(!html.includes("Alex privado"));
    assert(!html.includes("city-reveal-callout"));
    assert(!html.includes("revealed-impostor"));
  }
  const revealed = renderToStaticMarkup(
    createElement(Dashboard, {
      state: { ...DEMO_STATE, phase: "revealed", assigned: true, reveal },
    }),
  );
  assert(revealed.includes("IMPOSTOR REVELADO"));
  assert(revealed.includes("Alex privado"));
  assert(revealed.includes("Se ocultaba en Energía"));
  assert(revealed.includes("Energía: En línea · IMPOSTOR: Alex privado"));
  assert(!revealed.includes("Agua: En línea · IMPOSTOR"));
  assert(revealed.includes("service-tile operational revealed-impostor"));
  assert(!revealed.includes("city-join-qr"));
  const reset = renderToStaticMarkup(
    createElement(Dashboard, {
      state: { ...DEMO_STATE, code: "8378", autoStart: true },
    }),
  );
  assert(!reset.includes("Alex privado"));
  assert(!reset.includes("city-reveal-callout"));
  assert(!reset.includes("revealed-impostor"));
  assert(reset.includes("city-join-qr"));
  const legacy = renderToStaticMarkup(
    createElement(Dashboard, {
      state: {
        ...DEMO_STATE,
        phase: "revealed",
        reveal: { ...reveal, impostorDepartmentId: undefined },
      },
    }),
  );
  assert(legacy.includes("city-reveal-callout"));
  assert(legacy.includes("Energía: En línea · IMPOSTOR: Alex privado"));
});
