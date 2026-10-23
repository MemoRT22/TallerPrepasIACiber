import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import Briefing from "../client/components/Briefing";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import { Portrait } from "../client/components/Portrait";
import { probeAudio } from "../client/components/SyntheticVoice";
import {
  IDENTITY_EVENT,
  IDENTITY_PROFILES,
  credentialOf,
} from "../shared/identityCatalog";
import type { IdentityCard, PlayerState, PublicState } from "../shared/types";

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
    pathname: "/jugador",
  },
});

const game = {
  connected: true,
  busy: false,
  act: () => Promise.resolve({ ok: true }),
} as unknown as import("../client/useGame").GameConnection;

const base: PlayerState = {
  id: "private",
  slot: 1,
  name: "Equipo",
  department: "agua",
  node: "777",
  role: "defender",
  blocked: false,
  mail: [],
  templates: [],
  mailCooldown: 0,
  mailSendCooldown: 30,
  mailInspectionsRemaining: 2,
  saturation: 0,
  traffic: [],
  card: null,
  pendingCards: 1,
  identityCooldown: 0,
  identityVerificationsRemaining: 2,
};
const playing: PublicState = {
  ...DEMO_STATE,
  stage: "playing",
  phase: "identity",
  running: true,
  duration: 120,
  remaining: 90,
  clock: 30_000,
};

function cardWith(extra: Partial<IdentityCard> = {}): IdentityCard {
  const reference = credentialOf(IDENTITY_PROFILES[0]);
  return {
    id: "c1",
    reference,
    presented: { ...reference },
    expires: 38_000,
    context: { label: "Turno regular", urgent: false },
    ...extra,
  };
}

async function loadGame() {
  return import("../client/games/IdentityGame");
}

test("la credencial muestra retrato ilustrado, nombre, empleado, nivel, vigencia y folio", async () => {
  const { CredentialCard } = await loadGame();
  const profile = IDENTITY_PROFILES[1];
  const html = renderToStaticMarkup(
    createElement(CredentialCard, {
      credential: credentialOf(profile),
      reference: true,
    }),
  );
  for (const text of [
    profile.name,
    profile.employeeId,
    profile.service,
    `NIVEL ${profile.clearance}`,
    `VIGENTE ${profile.validity}`,
    profile.code,
    "CREDENCIAL OFICIAL",
    "persona ficticia",
  ])
    assert(html.includes(text), text);
  assert(!html.includes("<img"), "sin activos remotos ni fotos de terceros");
  assert(
    !/sintétic|\bIA\b/i.test(html),
    "los placeholders no se presentan como IA",
  );
  const portraits = Array.from({ length: 8 }, (_, value) =>
    renderToStaticMarkup(createElement(Portrait, { value })).replace(
      /aria-label="[^"]*"|portrait-bg-[^"')]*/g,
      "",
    ),
  );
  assert.equal(new Set(portraits).size, 8);
});

test("cada campo editable produce una credencial visualmente distinta", async () => {
  const { CredentialCard } = await loadGame();
  const reference = credentialOf(IDENTITY_PROFILES[2]);
  const render = (credential: typeof reference) =>
    renderToStaticMarkup(createElement(CredentialCard, { credential }));
  const original = render(reference);
  for (const changed of [
    { ...reference, avatar: 3 },
    { ...reference, code: "3256" },
    { ...reference, name: "Itzel Raímrez Duarte" },
    { ...reference, clearance: "N3" as const },
    { ...reference, validity: "09/26" },
    { ...reference, symbol: 3 },
  ])
    assert.notEqual(render(changed), original);
});

test("la misión ofrece Permitir, Verificar y No permitir con usos restantes y contexto", async () => {
  const { default: IdentityGame } = await loadGame();
  const html = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: playing,
      player: { ...base, card: cardWith() },
      game,
    }),
  );
  for (const text of [
    "Permitir",
    "No permitir",
    "Verificar · 2",
    "Turno regular",
    "Una foto convincente no prueba identidad",
  ])
    assert(html.includes(text), text);
  assert(!html.includes("Consultando"));
  const empty = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: playing,
      player: { ...base, card: cardWith(), identityVerificationsRemaining: 0 },
      game,
    }),
  );
  assert(
    /<button[^>]*disabled=""[^>]*aria-label="Verificar identidad, 0 restantes"/.test(
      empty,
    ),
  );
  const late = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: { ...playing, clock: 36_000 },
      player: { ...base, card: cardWith() },
      game,
    }),
  );
  assert(late.includes("Quedan pocos segundos"));
  assert(
    /<button[^>]*disabled=""[^>]*aria-label="Verificar identidad/.test(late),
  );
});

test("verificar muestra consulta en curso y luego solo hechos del registro", async () => {
  const { default: IdentityGame } = await loadGame();
  const pending = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: playing,
      player: {
        ...base,
        identityVerificationsRemaining: 1,
        card: cardWith({ verification: { pending: true, remaining: 0.9 } }),
      },
      game,
    }),
  );
  assert(pending.includes("Consultando el registro"));
  assert(
    /<button[^>]*disabled=""[^>]*>[^<]*<svg[^>]*><\/svg>No permitir/.test(
      pending,
    ) || pending.includes("disabled"),
  );
  const ready = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: playing,
      player: {
        ...base,
        identityVerificationsRemaining: 1,
        card: cardWith({
          verification: {
            pending: false,
            remaining: 0,
            heading: "Registro EMP-2041",
            evidence: [
              { label: "Nivel permitido", value: "N2" },
              { label: "Autorización", value: "SUSPENDIDA · desde ayer 18:40" },
              { label: "Bitácora", value: "Sin turno asignado hoy" },
            ],
          },
        }),
      },
      game,
    }),
  );
  for (const text of [
    "Registro EMP-2041",
    "SUSPENDIDA",
    "Sin turno asignado hoy",
    "El registro informa; tú decides.",
    "Verificada",
  ])
    assert(ready.includes(text), text);
  assert(!/falsa|auténtica/i.test(ready));
});

test("el comunicado muestra transcripción y aviso honesto; el audio no aparece sin archivo", async () => {
  const { default: IdentityGame, IdentityEventBanner } = await loadGame();
  const event = {
    id: IDENTITY_EVENT.id,
    speaker: IDENTITY_EVENT.speaker,
    transcript: IDENTITY_EVENT.transcript,
    remaining: 9,
  };
  const html = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: { ...playing, identity: { event } },
      player: { ...base, card: cardWith() },
      game,
    }),
  );
  assert(html.includes(IDENTITY_EVENT.transcript));
  assert(html.includes("COMUNICADO URGENTE"));
  assert(html.includes("No es una detección de IA en vivo"));
  assert(!/<audio|autoplay|Activar audio|Silenciar/.test(html));
  const banner = renderToStaticMarkup(
    createElement(IdentityEventBanner, { event }),
  );
  assert(banner.includes("Dirección General"));
});

test("probeAudio solo acepta un archivo de audio local y tolera cualquier fallo", async () => {
  const response = (ok: boolean, type: string) =>
    ({ ok, headers: new Headers({ "content-type": type }) }) as Response;
  assert.equal(
    await probeAudio("/a.mp3", async () => response(true, "audio/mpeg")),
    true,
  );
  assert.equal(
    await probeAudio("/a.mp3", async () => response(true, "text/html")),
    false,
  );
  assert.equal(
    await probeAudio("/a.mp3", async () => response(false, "audio/mpeg")),
    false,
  );
  assert.equal(
    await probeAudio("/a.mp3", async () => {
      throw new Error("offline");
    }),
    false,
  );
});

test("el expediente del impostor solo existe en su vista privada", async () => {
  const { default: IdentityGame } = await loadGame();
  const challenge = {
    record: [
      { key: "name" as const, label: "Nombre", value: "Valeria Montoya Cruz" },
      { key: "code" as const, label: "Folio", value: "1023" },
      { key: "level" as const, label: "Nivel", value: "N2" },
      { key: "validity" as const, label: "Vigencia", value: "11/27" },
      {
        key: "service" as const,
        label: "Dependencia",
        value: "Operación de agua",
      },
    ],
    draft: [
      { key: "name" as const, label: "Nombre", value: "Valeria Montoya Cruz" },
      { key: "code" as const, label: "Folio", value: "0123" },
      { key: "level" as const, label: "Nivel", value: "N2" },
      { key: "validity" as const, label: "Vigencia", value: "11/27" },
      {
        key: "service" as const,
        label: "Dependencia",
        value: "Operación de agua",
      },
    ],
    solved: false,
    advancedAvailable: false,
    advancedUsed: false,
    retryIn: 0,
  };
  const agileState = { ...playing, clock: 50_000 };
  const impostor: PlayerState = {
    ...base,
    role: "impostor",
    card: cardWith({ expires: 58_000 }),
    identityChallenge: challenge,
  };
  const hidden = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: agileState,
      player: impostor,
      game,
      roleVisible: false,
    }),
  );
  assert(!/EXPEDIENTE PRIVADO|Enviar solicitud|suplantación/i.test(hidden));
  const shown = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: agileState,
      player: impostor,
      game,
      roleVisible: true,
    }),
  );
  for (const text of [
    "EXPEDIENTE PRIVADO",
    "Enviar solicitud",
    "Cambiar nombre",
    "Cambiar vigencia",
  ])
    assert(shown.includes(text), text);
  const solved = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: agileState,
      player: {
        ...impostor,
        identityChallenge: {
          ...challenge,
          solved: true,
          advancedAvailable: true,
        },
      },
      game,
      roleVisible: true,
    }),
  );
  assert(solved.includes("Enviar suplantación avanzada"));
  assert(solved.includes("avanzada lista"));
  const early = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: { ...playing, clock: 10_000 },
      player: {
        ...impostor,
        identityChallenge: {
          ...challenge,
          solved: true,
          advancedAvailable: true,
        },
      },
      game,
      roleVisible: true,
    }),
  );
  assert(early.includes("Se habilita en el ritmo ágil"));
  const used = renderToStaticMarkup(
    createElement(IdentityGame, {
      state: agileState,
      player: {
        ...impostor,
        identityChallenge: {
          ...challenge,
          solved: true,
          advancedAvailable: false,
          advancedUsed: true,
        },
      },
      game,
      roleVisible: true,
    }),
  );
  assert(!used.includes("Enviar suplantación avanzada"));
});

test("la pantalla pública muestra comunicado y alerta sin datos privados", () => {
  const state: PublicState = {
    ...DEMO_STATE,
    phase: "identity",
    stage: "playing",
    running: true,
    identity: {
      alert: true,
      event: {
        id: IDENTITY_EVENT.id,
        speaker: IDENTITY_EVENT.speaker,
        transcript: IDENTITY_EVENT.transcript,
        remaining: 8,
      },
    },
  };
  const html = renderToStaticMarkup(createElement(Dashboard, { state }));
  for (const text of [
    "COMUNICADO URGENTE",
    IDENTITY_EVENT.transcript,
    "IDENTIDAD SINTÉTICA ACEPTADA",
    "No es una detección de IA en vivo",
  ])
    assert(html.includes(text), text);
  for (const forbidden of [
    "EMP-",
    "Folio",
    "NIVEL N",
    "Registro EMP",
    "<audio",
  ])
    assert(!html.toLowerCase().includes(forbidden.toLowerCase()), forbidden);
  const quiet = renderToStaticMarkup(
    createElement(Dashboard, { state: { ...state, identity: undefined } }),
  );
  assert(!quiet.includes("COMUNICADO URGENTE"));
  assert(!quiet.includes("IDENTIDAD SINTÉTICA"));
});

test("el briefing de identidad explica verificar en una lectura corta y oculta la guía secreta", () => {
  const state: PublicState = {
    ...DEMO_STATE,
    assigned: true,
    stage: "briefing",
    phase: "identity",
  };
  const html = renderToStaticMarkup(
    createElement(Briefing, { state, player: base, roleVisible: false }),
  );
  assert(html.includes("Verifica antes de permitir"));
  assert(html.includes("Verificar"));
  assert(html.includes("el registro manda"));
  const words = html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  assert(words < 90, `briefing de ~20 s (${words} palabras)`);
  const secret = renderToStaticMarkup(
    createElement(Briefing, {
      state,
      player: { ...base, role: "impostor" },
      roleVisible: false,
    }),
  );
  assert(!secret.includes("expediente"));
  const visible = renderToStaticMarkup(
    createElement(Briefing, {
      state,
      player: { ...base, role: "impostor" },
      roleVisible: true,
    }),
  );
  assert(visible.includes("expediente privado"));
});
