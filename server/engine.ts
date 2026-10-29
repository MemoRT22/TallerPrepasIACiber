import { randomBytes } from "node:crypto";
import {
  DEPARTMENTS,
  DEFAULT_SETTINGS,
  PHASES,
  type Ack,
  type AdminState,
  type AdminCommand,
  type Capacity,
  type Credential,
  type DepartmentState,
  type DdosPattern,
  type DossierKey,
  type ExperienceStage,
  type GameAction,
  type IdentityAlteration,
  type IdentityCard,
  type IdentityChallengeState,
  type IdentityDebrief,
  type IdentityRegistryLine,
  type LogEntry,
  type MailCard,
  type Phase,
  type PlayerState,
  type PublicState,
  type Role,
  type Session,
  type Settings,
  type Snapshot,
  type Template,
  type TrafficPoint,
  type Winner,
  IDENTITY_ALTERATIONS,
} from "../shared/types.js";
import {
  ADVANCED_REGISTRY_VARIANTS,
  DOSSIER_KEYS,
  EVENT_CONTEXT,
  IDENTITY_EVENT,
  IDENTITY_PROFILES,
  NEUTRAL_CONTEXTS,
  URGENT_CONTEXT,
  advancedFinding,
  buildDossier,
  credentialOf,
  perturbClearance,
  perturbCode,
  perturbName,
  perturbValidity,
  registryEvidence,
  type RegistryVariant,
} from "../shared/identityCatalog.js";
import {
  DDOS_SHIELD_MS,
  DDOS_TRAVEL_MS,
  DDOS_WAVE_SIZE,
  ddosSpawnInterval,
} from "../shared/ddosRules.js";
import { cityNarrative } from "../shared/cityNarrative.js";
import {
  votingBonus,
  finalReflection,
  revealStep,
} from "../shared/finalRules.js";
import type { CityChapter } from "../shared/types.js";

export interface GameEngineOptions {
  now?: () => number;
  random?: () => number;
  cleanupAfterMs?: number;
  tickMs?: number;
  autoTick?: boolean;
}

type MailStage = "recognition" | "analysis" | "pressure";
interface InternalMail extends Omit<MailCard, "inspection"> {
  malicious: boolean;
  source: "auto" | "player";
  senderToken?: string;
  inspectionDetails: NonNullable<MailCard["inspection"]>;
  inspected: boolean;
}
interface InternalMailTemplate extends Template {
  stage: MailStage;
  inspection: NonNullable<MailCard["inspection"]>;
}
interface InternalTraffic extends TrafficPoint {
  ownerToken: string;
}
interface InternalDdosChallenge {
  patterns: DdosPattern[];
  answer: string;
  solved: boolean;
  waveUsed: boolean;
  retryAt: number;
}
type IdentityTier = "legit" | "obvious" | "subtle" | "advanced";
interface InternalIdentity extends Omit<IdentityCard, "verification"> {
  legit: boolean;
  shown: boolean;
  alteration: IdentityAlteration | "person" | "synthetic";
  tier: IdentityTier;
  source: "auto" | "player";
  isEvent: boolean;
  registry: { heading: string; evidence: IdentityRegistryLine[] };
  finding?: string;
  verifyReadyAt?: number;
}
interface InternalIdentityChallenge {
  record: IdentityChallengeState["record"];
  draft: IdentityChallengeState["draft"];
  answer: DossierKey;
  solved: boolean;
  advancedAvailable: boolean;
  advancedUsed: boolean;
  retryAt: number;
}
interface InternalPlayer {
  id: string;
  slot: number;
  name: string;
  department: string;
  node: string;
  token: string;
  role?: Role;
  connected: boolean;
  socketId?: string;
  waitUntilNextRound?: string;
  initializedRound?: string;
  blocked: boolean;
  publicBlocked: boolean;
  inactivityPenalties: number;
  nextIdleAt: number;
  inactivityEligible: boolean;
  mail: InternalMail[];
  mailCooldownUntil: number;
  mailInspectionsRemaining: number;
  mailCorrect: number;
  mailDecisions: number;
  mailReceived: number;
  mailMistakes: number;
  publicMailRisk: number;
  traffic: InternalTraffic[];
  ddosShieldUsed: boolean;
  ddosShieldUntil: number;
  ddosAbsorbed: number;
  ddosAbsorbedUntil: number;
  ddosWaveUntil: number;
  ddosChallenge?: InternalDdosChallenge;
  saturation: number;
  lastRedHit: number | null;
  blueEmitted: number;
  blueSuccess: number;
  blueLost: number;
  card: InternalIdentity | null;
  pendingCards: InternalIdentity[];
  identityCooldownUntil: number;
  legitShown: number;
  legitAuthorized: number;
  identityLost: number;
  infiltrations: number;
  publicInfiltrations: number;
  identityIncoming: number;
  identityProfileSequence: number;
  identityFalseSequence: number;
  identityMix: boolean[];
  identityVerificationsRemaining: number;
  identityDecoyStages: number[];
  identityEventOwed?: InternalIdentity;
  identityEvent?: {
    outcome: "allowed" | "blocked" | "expired" | "unanswered";
    verified: boolean;
    finding?: string;
  };
  identityChallenge?: InternalIdentityChallenge;
  fragment?: {
    order: number;
    plaintext: string;
    cipher: string;
    answer: string;
    solved: boolean;
    shift: number;
    altered: boolean;
    verificationUsed: boolean;
    verificationReadyAt?: number;
  };
  recoveryChallenge?: {
    cipher: string;
    answer: string;
    hint: string;
    shift: number;
    solved: boolean;
    sabotageAvailable: boolean;
    sabotageUsed: boolean;
  };
  vote?: { suspect: string; reason: string };
}
interface Invite {
  slot: number;
  invite: string;
  department: string;
  playerToken?: string;
}
interface Room {
  code: string;
  capacity: 3 | 4 | 5 | 6;
  settings: Settings;
  invites: Invite[];
  players: InternalPlayer[];
  adminToken: string;
  phase: Phase;
  stage: ExperienceStage;
  countdownMs: number;
  autoBriefingRemainingMs: number;
  mailPublicPulseAt: number;
  running: boolean;
  paused: boolean;
  assigned: boolean;
  autoStart: boolean;
  autoPauseRequiresReconnect: boolean;
  clock: number;
  lastNow: number;
  lastActivity: number;
  roundFinished: boolean;
  results: Snapshot["public"]["results"];
  cityChapters: CityChapter[];
  scores: { defenders: number; impostor: number };
  logs: LogEntry[];
  mailArrivalIndex: number;
  mailNextAt: number;
  mailSequence: number;
  mailMaliciousAccepted: number;
  ddosNextSpawn: number;
  ddosSequence: number;
  ddosWaveAlertUntil: number;
  identitySequence: number;
  roundNonce: string;
  identityPublicPulseAt: number;
  identityEventDone: boolean;
  identityEventUntil: number;
  identityAlertPending: boolean;
  identityAlertUntil: number;
  recoveryDone: boolean;
  recoveryStarted: boolean;
  recoveryTotal: number;
  recoveryCompleted: number;
  recoveryAlertUntil: number;
  votesOpen: boolean;
  judgmentDebate: boolean;
  votingEligible: string[];
  votingDefenders: string[];
  revealAt?: number;
  revealElapsed: number;
  dedup: Map<string, Map<string, Ack>>;
  resetEventIds: Set<string>;
  boundSockets: Map<string, string>;
  reveal?: NonNullable<PublicState["reveal"]>;
}

const PHASE_ORDER: Phase[] = ["mail", "ddos", "identity", "recovery"];
const OFFICIAL_TEMPLATES: InternalMailTemplate[] = [
  {
    id: "legit-alert",
    senderName: "Centro de Operaciones",
    sender: "alertas@cancun.example",
    subject: "Resumen operativo de las 08:00",
    preview: "El tablero local quedó actualizado con los servicios de guardia.",
    context: "Boletín periódico · no solicita respuesta",
    kind: "official",
    tactic: "official",
    stage: "recognition",
    inspection: {
      heading: "Registro del boletín",
      evidence: [
        "Folio OP-0800 presente en el calendario local.",
        "Respuesta y enlaces: ninguno.",
      ],
    },
  },
  {
    id: "legit-service",
    senderName: "Mesa de Servicios Riviera",
    sender: "mesa@servicios-cancun.example",
    subject: "Confirmación de mantenimiento MT-204",
    preview:
      "La ventana aprobada inicia a las 22:30; no se requieren credenciales.",
    context: "Proveedor operativo registrado",
    kind: "official",
    tactic: "official",
    stage: "recognition",
    inspection: {
      heading: "Orden de mantenimiento",
      evidence: [
        "MT-204 coincide con la agenda de cambios del servicio.",
        "Contacto registrado: extensión interna 204.",
      ],
    },
  },
  {
    id: "legit-access",
    senderName: "Control de Identidades",
    sender: "avisos@identidad-cancun.example",
    subject: "Acceso nocturno registrado",
    preview:
      "Una cuenta de guardia ingresó a las 02:14 desde la terminal municipal.",
    context: "Aviso automático de solo lectura",
    kind: "official",
    tactic: "official",
    stage: "analysis",
    inspection: {
      heading: "Bitácora de acceso",
      evidence: [
        "Evento ID-2214 visible en la bitácora local.",
        "No incluye botón para bloquear ni confirmar contraseña.",
      ],
    },
  },
  {
    id: "legit-energy",
    senderName: "Energía Península",
    sender: "programacion@energia-peninsula.example",
    subject: "Corte preventivo del circuito norte",
    preview: "El corte de seis minutos fue coordinado para las 13:40.",
    context: "Notificación de un proveedor externo",
    kind: "official",
    tactic: "official",
    stage: "analysis",
    inspection: {
      heading: "Convenio y programación",
      evidence: [
        "Contrato EP-17 y ventana 13:40 constan en el plan local.",
        "Destino informado: tablero.energia-peninsula.example/EP-17.",
      ],
    },
  },
  {
    id: "legit-emergency",
    senderName: "Enlace de Protección Civil",
    sender: "enlace@proteccion-civil.example",
    subject: "Desvío preventivo por tormenta",
    preview:
      "Movilidad debe usar la ruta B desde las 16:00 y confirmar por radio.",
    context: "Comunicado interinstitucional",
    kind: "official",
    tactic: "official",
    stage: "pressure",
    inspection: {
      heading: "Protocolo de emergencia",
      evidence: [
        "Alerta PC-61 coincide con el tablero meteorológico local.",
        "El procedimiento pide confirmar por radio, no mediante un enlace.",
      ],
    },
  },
];
const IMPOSTOR_TEMPLATES: InternalMailTemplate[] = [
  {
    id: "fake-support",
    senderName: "Soporte de Sesiones",
    sender: "soporte@cancun.example",
    subject: "Tu sesión expira en 10 minutos",
    preview:
      "Conserva el acceso validando tu cuenta antes del cierre automático.",
    context: "Aviso marcado como urgente",
    kind: "attack",
    tactic: "urgency",
    stage: "recognition",
    inspection: {
      heading: "Ruta y procedimiento",
      evidence: [
        "Destino simulado: continuidad-acceso.example/renovar.",
        "El manual local renueva sesiones desde la aplicación, no por correo.",
      ],
    },
  },
  {
    id: "fake-security",
    senderName: "Coordinación de Ciberseguridad",
    sender: "seguridad@cancun.example",
    subject: "Nuevo protocolo de acceso remoto",
    preview:
      "La dirección solicita registrar de nuevo el usuario para evitar bloqueos.",
    context: "Comunicado atribuido a una autoridad",
    kind: "attack",
    tactic: "authority",
    stage: "analysis",
    inspection: {
      heading: "Cabeceras y orden de cambio",
      evidence: [
        "Reply-To: protocolo@validacion-externa.example.",
        "No existe una orden de cambio asociada al mensaje.",
      ],
    },
  },
  {
    id: "fake-provider",
    senderName: "Energía Península",
    sender: "avisos@energia-peninsula.example",
    subject: "Actualiza el contacto del circuito norte",
    preview:
      "Un técnico necesita confirmar el usuario responsable antes del corte.",
    context: "Parece continuar una conversación operativa",
    kind: "attack",
    tactic: "impersonation",
    stage: "recognition",
    inspection: {
      heading: "Referencia del proveedor",
      evidence: [
        "Cita la orden EP-71; el registro local corresponde a EP-17.",
        "Destino simulado: energia-contactos.example/actualizar.",
      ],
    },
  },
  {
    id: "fake-director",
    senderName: "Dirección de Operaciones",
    sender: "direccion@cancun.example",
    subject: "Autoriza una excepción temporal",
    preview:
      "Por instrucción directiva, omite la revisión habitual y confirma el acceso.",
    context: "Solicitud fuera del procedimiento normal",
    kind: "attack",
    tactic: "authority",
    stage: "pressure",
    inspection: {
      heading: "Cadena de autorización",
      evidence: [
        "Firma interna: DIR-09; el directorio vigente usa DIR-06.",
        "La excepción no aparece en el registro de cambios urgentes.",
      ],
    },
  },
  {
    id: "fake-access",
    senderName: "Control de Identidades",
    sender: "avisos@identidad-cancun.example",
    subject: "Alerta de acceso no autorizado",
    preview:
      "Bloquea la actividad confirmando de inmediato tu identidad institucional.",
    context: "Imita una alerta automática conocida",
    kind: "attack",
    tactic: "impersonation",
    stage: "analysis",
    inspection: {
      heading: "Evento y destino",
      evidence: [
        "El supuesto evento ID-2281 no existe en la bitácora local.",
        "Destino simulado: identidad-segura.example/ID-2281.",
      ],
    },
  },
  {
    id: "fake-emergency",
    senderName: "Enlace de Protección Civil",
    sender: "enlace@proteccion-civil.example",
    subject: "ALERTA: confirma recepción en dos minutos",
    preview:
      "La ruta de evacuación cambió; abre el documento y registra tu cuenta.",
    context: "Mensaje recibido durante presión operativa",
    kind: "attack",
    tactic: "urgency",
    stage: "pressure",
    inspection: {
      heading: "Canal de emergencia",
      evidence: [
        "No hay alerta meteorológica con ese folio en el tablero local.",
        "El protocolo exige radio; el mensaje dirige a rutas-cancun.example.",
      ],
    },
  },
];
const ALL_TEMPLATES = [...OFFICIAL_TEMPLATES, ...IMPOSTOR_TEMPLATES];
const RECOVERY_WORDS = ["CANCUN", "RECUPERA", "EL", "CONTROL", "TOTAL"];
const RECOVERY_CHALLENGES = [
  { plaintext: "ALERTA", shift: 1 },
  { plaintext: "CLAVE", shift: 2 },
  { plaintext: "ESCUDO", shift: 4 },
  { plaintext: "NODO", shift: 2 },
  { plaintext: "SENAL", shift: 1 },
  { plaintext: "CODIGO", shift: 4 },
] as const;
const RECOVERY_BASE_SHIFT = 3;
const RECOVERY_SABOTAGE_SHIFT = 5;
const RECOVERY_SHIFT_CANDIDATES = [3, 5, 7];
const RECOVERY_VERIFY_DELAY_MS = 3_000;
const RECOVERY_ALERT_MS = 6_000;
const MAIL_CLOSE_WINDOW_MS = 20_000;
const MAIL_INTERVAL_MS = 30_000;
const MAIL_DEFAULT_SEND_COOLDOWN_MS = 30_000;
const MAIL_INSPECTIONS = 2;
const IDENTITY_VERIFICATIONS = 2;
// Consultar el registro tarda; no se puede decidir mientras responde.
const IDENTITY_VERIFY_DELAY_MS = 1_500;
// Tiempo mínimo que debe quedar para decidir después de la respuesta.
const IDENTITY_VERIFY_MARGIN_MS = 1_500;
const IDENTITY_EVENT_VISIBLE_MS = 14_000;
const IDENTITY_ALERT_MS = 6_000;
const IDENTITY_CHALLENGE_RETRY_MS = 3_000;
const IDENTITY_INJECT_COOLDOWN_MS = 10_000;
const ALLOWED_ACTIONS = new Set([
  "mail:classify",
  "mail:inspect",
  "mail:send",
  "ddos:tap",
  "ddos:shield",
  "ddos:challenge-solve",
  "ddos:wave",
  "identity:decide",
  "identity:send",
  "identity:verify",
  "identity:challenge-solve",
  "identity:send-advanced",
  "recovery:solve",
  "recovery:challenge-solve",
  "recovery:sabotage",
  "recovery:verify",
  "vote",
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function secret(prefix: string): string {
  return `${prefix}_${randomBytes(18).toString("base64url")}`;
}
function validText(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max
  );
}
function normalizeAnswer(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z]/g, "")
    : "";
}
export function cipherCesar(value: string, shift = 3): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[A-Z]/g, (letter) =>
      String.fromCharCode(
        65 + ((((letter.charCodeAt(0) - 65 + shift) % 26) + 26) % 26),
      ),
    );
}
function randomUnit(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0;
}
function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(randomUnit(random) * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
function isCapacity(value: unknown): value is 3 | 4 | 5 | 6 {
  return value === 3 || value === 4 || value === 5 || value === 6;
}
function isAdminCommand(value: unknown): value is AdminCommand {
  return (
    typeof value === "string" &&
    [
      "capacity",
      "assign",
      "auto-start",
      "manual-start",
      "start",
      "pause",
      "resume",
      "stop",
      "restart",
      "reset-all",
      "next",
      "voting",
      "judgment",
      "reveal",
      "settings",
    ].includes(value)
  );
}

export class GameEngine {
  public readonly rooms = new Map<string, Room>();
  private readonly nowFn: () => number;
  private readonly randomFn: () => number;
  private readonly cleanupAfterMs: number;
  private readonly tickMs: number;
  private timer?: ReturnType<typeof setInterval>;

  public constructor(options: GameEngineOptions = {}) {
    this.nowFn = options.now ?? (() => Date.now());
    this.randomFn = options.random ?? Math.random;
    this.cleanupAfterMs = options.cleanupAfterMs ?? 6 * 60 * 60 * 1000;
    this.tickMs = options.tickMs ?? 100;
    if (options.autoTick) this.start();
  }

  public start(onTick?: (changedRooms: string[]) => void): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const changed = this.tick();
      if (changed.length && onTick) onTick(changed);
    }, this.tickMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }
  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  public tick(at = this.nowFn()): string[] {
    const changed: string[] = [];
    for (const room of this.rooms.values())
      if (this.syncRoom(room, at)) changed.push(room.code);
    this.cleanup(at);
    return changed;
  }
  public cleanup(at = this.nowFn()): void {
    for (const [code, room] of this.rooms)
      if (at - room.lastActivity >= this.cleanupAfterMs)
        this.rooms.delete(code);
  }

  public create(capacity: 3 | 4 | 5 | 6, autoStart = false): Ack {
    const at = this.nowFn();
    if (!isCapacity(capacity))
      return this.fail("La capacidad debe estar entre 3 y 6.");
    this.cleanup(at);
    let code = "";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const n = Math.max(0, Math.min(0.999999, this.randomFn()));
      const candidate = String(1000 + Math.floor(n * 9000));
      if (!this.rooms.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) return this.fail("No fue posible generar un código de sala.");
    const room = this.emptyRoom(code, capacity, at, autoStart === true);
    this.rooms.set(code, room);
    const session: Session = { code, token: room.adminToken, kind: "admin" };
    return this.success(session, room);
  }

  private emptyRoom(
    code: string,
    capacity: 3 | 4 | 5 | 6,
    at: number,
    autoStart = false,
  ): Room {
    const room: Room = {
      code,
      capacity,
      settings: clone(DEFAULT_SETTINGS),
      invites: [],
      players: [],
      adminToken: secret("adm"),
      phase: "lobby",
      stage: "waiting",
      countdownMs: 0,
      autoBriefingRemainingMs: 0,
      mailPublicPulseAt: 10_000,
      running: false,
      paused: false,
      assigned: false,
      autoStart,
      autoPauseRequiresReconnect: false,
      clock: 0,
      lastNow: at,
      lastActivity: at,
      roundFinished: false,
      results: [],
      cityChapters: [],
      scores: { defenders: 0, impostor: 0 },
      logs: [],
      mailArrivalIndex: 0,
      mailNextAt: MAIL_INTERVAL_MS,
      mailSequence: 0,
      mailMaliciousAccepted: 0,
      ddosNextSpawn: 0,
      ddosSequence: 0,
      ddosWaveAlertUntil: 0,
      identitySequence: 0,
      roundNonce: secret("rnd"),
      identityPublicPulseAt: 10_000,
      identityEventDone: false,
      identityEventUntil: 0,
      identityAlertPending: false,
      identityAlertUntil: 0,
      recoveryDone: false,
      recoveryTotal: capacity - 1,
      recoveryStarted: false,
      recoveryCompleted: 0,
      recoveryAlertUntil: 0,
      votesOpen: false,
      judgmentDebate: false,
      votingEligible: [],
      votingDefenders: [],
      revealElapsed: 0,
      dedup: new Map(),
      resetEventIds: new Set(),
      boundSockets: new Map(),
    };
    for (let slot = 1; slot <= capacity; slot += 1) {
      room.invites.push({
        slot,
        invite: secret("inv"),
        department: DEPARTMENTS[slot - 1].id,
      });
    }
    return room;
  }
  private ensureInvites(room: Room, capacity: Capacity): void {
    for (let slot = 1; slot <= capacity; slot += 1) {
      if (room.invites.some((invite) => invite.slot === slot)) continue;
      room.invites.push({
        slot,
        invite: secret("inv"),
        department: DEPARTMENTS[slot - 1].id,
      });
    }
    room.invites.sort((left, right) => left.slot - right.slot);
  }
  public createRoom(capacity: 3 | 4 | 5 | 6, autoStart = false): Ack {
    return this.create(capacity, autoStart);
  }
  /** Arranque local: recupera capabilities previamente emitidas, nunca una partida activa. */
  public restoreLobby(input: {
    code: string;
    capacity: 3 | 4 | 5 | 6;
    adminToken: string;
    invites: { slot: number; invite: string; department: string }[];
  }): Ack {
    if (
      !/^\d{4}$/.test(input.code) ||
      !isCapacity(input.capacity) ||
      !/^adm_[A-Za-z0-9_-]{24}$/.test(input.adminToken) ||
      !Array.isArray(input.invites) ||
      input.invites.length !== input.capacity ||
      this.rooms.has(input.code)
    )
      return this.fail(
        "Los accesos guardados no son válidos para recuperar la sala.",
      );
    const sorted = [...input.invites].sort((a, b) => a.slot - b.slot);
    if (
      new Set(sorted.map((i) => i.invite)).size !== input.capacity ||
      sorted.some(
        (i, index) =>
          i.slot !== index + 1 ||
          i.department !== DEPARTMENTS[index].id ||
          !/^inv_[A-Za-z0-9_-]{24}$/.test(i.invite),
      )
    )
      return this.fail("Las invitaciones guardadas no son válidas.");
    const created = this.create(input.capacity);
    if (!created.session) return created;
    const room = this.rooms.get(created.session.code)!;
    this.rooms.delete(room.code);
    room.code = input.code;
    room.adminToken = input.adminToken;
    room.invites = sorted.map((i) => ({ ...i }));
    this.rooms.set(room.code, room);
    return this.success(
      { code: room.code, token: room.adminToken, kind: "admin" },
      room,
    );
  }
  public handleCreate(payload: {
    capacity?: unknown;
    autoStart?: unknown;
  }): Ack {
    return this.create(
      payload?.capacity as 3 | 4 | 5 | 6,
      payload?.autoStart === true,
    );
  }

  public join(payload: {
    code?: unknown;
    name?: unknown;
    slot?: unknown;
    invite?: unknown;
  }): Ack {
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    const room = this.rooms.get(code);
    if (!room) return this.fail("La sala no existe.");
    this.syncRoom(room);
    room.lastActivity = this.nowFn();
    let invite: Invite | undefined;
    if (payload.invite !== undefined) {
      if (typeof payload.invite !== "string")
        return this.fail("La invitación no es válida.");
      invite = room.invites.find((item) => item.invite === payload.invite);
      if (!invite) return this.fail("La invitación no es válida.");
      if (invite.slot > room.capacity)
        return this.fail("Ese puesto está fuera del cupo actual.");
      if (payload.slot !== undefined && payload.slot !== invite.slot)
        return this.fail("La invitación no corresponde a ese puesto.");
      const existing = room.players.find(
        (player) => player.slot === invite!.slot,
      );
      if (existing) {
        invite.playerToken = existing.token;
        return this.success(
          { code, token: existing.token, kind: "player", slot: existing.slot },
          room,
        );
      }
    } else if (payload.slot !== undefined) {
      return this.fail("El enlace reservado requiere su invitación privada.");
    } else {
      invite = room.invites.find(
        (item) =>
          item.slot <= room.capacity &&
          !room.players.some((player) => player.slot === item.slot),
      );
    }
    if (!validText(payload.name, 2, 24))
      return this.fail("El nombre debe tener entre 2 y 24 caracteres.");
    if (room.phase !== "lobby" || room.assigned)
      return this.fail("La sala ya está en curso.");
    const name = (payload.name as string).trim();
    if (
      room.players.some(
        (player) =>
          player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      return this.fail("Ese nombre ya está ocupado.");
    if (!invite) return this.fail("La sala está llena.");
    if (room.players.some((player) => player.slot === invite!.slot))
      return this.fail("Ese puesto ya fue ocupado.");
    const token = secret("ply");
    const player: InternalPlayer = {
      id: `player-${invite.slot}`,
      slot: invite.slot,
      name,
      department: invite.department,
      node: String(100 + invite.slot),
      token,
      connected: true,
      blocked: false,
      publicBlocked: false,
      inactivityPenalties: 0,
      nextIdleAt: 0,
      inactivityEligible: false,
      mail: [],
      mailCooldownUntil: 0,
      mailInspectionsRemaining: MAIL_INSPECTIONS,
      mailCorrect: 0,
      mailDecisions: 0,
      mailReceived: 0,
      mailMistakes: 0,
      publicMailRisk: 0,
      traffic: [],
      ddosShieldUsed: false,
      ddosShieldUntil: 0,
      ddosAbsorbed: 0,
      ddosAbsorbedUntil: 0,
      ddosWaveUntil: 0,
      saturation: 0,
      lastRedHit: null,
      blueEmitted: 0,
      blueSuccess: 0,
      blueLost: 0,
      card: null,
      pendingCards: [],
      identityCooldownUntil: 0,
      legitShown: 0,
      legitAuthorized: 0,
      identityLost: 0,
      infiltrations: 0,
      publicInfiltrations: 0,
      identityIncoming: 0,
      identityProfileSequence: 0,
      identityFalseSequence: 0,
      identityMix: [],
      identityVerificationsRemaining: IDENTITY_VERIFICATIONS,
      identityDecoyStages: [],
    };
    room.players.push(player);
    invite.playerToken = token;
    this.log(
      room,
      "join",
      player.department,
      "Una sesión se incorporó a la sala.",
    );
    const session: Session = { code, token, kind: "player", slot: player.slot };
    return this.success(session, room);
  }
  public joinRoom(payload: {
    code?: unknown;
    name?: unknown;
    slot?: unknown;
    invite?: unknown;
  }): Ack {
    return this.join(payload);
  }
  public handleJoin(payload: {
    code?: unknown;
    name?: unknown;
    slot?: unknown;
    invite?: unknown;
  }): Ack {
    return this.join(payload);
  }

  public resume(session: Session): Ack {
    const room = this.rooms.get(session?.code);
    if (!room) return this.fail("La sala no existe.");
    this.syncRoom(room);
    room.lastActivity = this.nowFn();
    if (!this.validSession(session, room))
      return {
        ...this.fail("La sesión ya no es válida."),
        errorCode: "session_revoked",
      };
    return this.success(session, room);
  }
  public resumeSession(session: Session): Ack {
    return this.resume(session);
  }
  public handleResume(session: Session): Ack {
    return this.resume(session);
  }

  public watch(payload: { code?: unknown }): Ack {
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    const room = this.rooms.get(code);
    if (!room) return this.fail("La sala no existe.");
    this.syncRoom(room);
    room.lastActivity = this.nowFn();
    return { ok: true, snapshot: { public: this.publicSnapshot(room) } };
  }
  public watchRoom(code: string): Ack {
    return this.watch({ code });
  }
  public handleWatch(payload: { code?: unknown }): Ack {
    return this.watch(payload);
  }

  public admin(
    session: Session,
    eventOrRequest:
      | string
      | {
          eventId?: unknown;
          command?: unknown;
          settings?: Settings;
          capacity?: unknown;
        },
    command?: AdminCommand,
    settings?: Settings,
    capacity?: unknown,
  ): Ack {
    const eventId =
      typeof eventOrRequest === "string"
        ? eventOrRequest
        : String(eventOrRequest?.eventId ?? "");
    const resolvedCommand =
      typeof eventOrRequest === "string"
        ? command
        : (eventOrRequest?.command as AdminCommand);
    const resolvedSettings =
      typeof eventOrRequest === "string" ? settings : eventOrRequest?.settings;
    const resolvedCapacity =
      typeof eventOrRequest === "string"
        ? capacity
        : (eventOrRequest?.capacity ?? capacity);
    const room = this.rooms.get(session?.code);
    if (!room) return this.fail("La sala no existe.");
    this.syncRoom(room);
    if (!this.validSession(session, room) || session.kind !== "admin")
      return this.fail("No autorizado.");
    if (!validText(eventId, 1, 120))
      return this.fail("El identificador del evento es obligatorio.");
    if (!isAdminCommand(resolvedCommand))
      return this.fail("Comando docente no válido.");
    if (resolvedCommand === "reset-all" && room.resetEventIds.has(eventId))
      return { ok: true, snapshot: this.snapshotForSession(session) };
    if (resolvedCommand === "capacity" && room.resetEventIds.has(eventId))
      return { ok: true, snapshot: this.snapshotForSession(session) };
    const cached = this.getDedup(room, session.token, eventId);
    if (cached)
      return {
        ...clone(cached),
        ...(cached.ok ? { snapshot: this.snapshotForSession(session) } : {}),
      };
    room.lastActivity = this.nowFn();
    const result = this.applyAdmin(
      room,
      resolvedCommand,
      resolvedSettings,
      resolvedCapacity,
    );
    if (
      (resolvedCommand === "reset-all" || resolvedCommand === "capacity") &&
      result.ok
    )
      room.resetEventIds.add(eventId);
    this.storeDedup(room, session.token, eventId, result);
    return result;
  }
  public handleAdmin(
    session: Session,
    request:
      | string
      | {
          eventId?: unknown;
          command?: unknown;
          settings?: Settings;
          capacity?: unknown;
        },
    command?: AdminCommand,
    settings?: Settings,
    capacity?: unknown,
  ): Ack {
    if (typeof request === "string")
      return this.admin(session, request, command, settings, capacity);
    return this.admin(session, {
      eventId: request?.eventId,
      command: request?.command,
      settings: request?.settings,
      capacity: request?.capacity ?? capacity,
    });
  }

  public action(session: Session, action: GameAction): Ack {
    const room = this.rooms.get(session?.code);
    if (!room) return this.fail("La sala no existe.");
    this.syncRoom(room);
    if (!this.validSession(session, room) || session.kind !== "player")
      return this.fail("No autorizado.");
    const player = room.players.find(
      (candidate) => candidate.token === session.token,
    );
    if (!player) return this.fail("Jugador no encontrado.");
    if (player.waitUntilNextRound === room.roundNonce)
      return this.fail("Te reincorporas en el siguiente juego.");
    if (
      !action ||
      typeof action !== "object" ||
      !validText(action.eventId, 1, 120)
    )
      return this.fail("El identificador del evento es obligatorio.");
    if (!ALLOWED_ACTIONS.has(action.type))
      return this.fail("Acción no válida.");
    const cached = this.getDedup(room, session.token, action.eventId);
    if (cached)
      return {
        ...clone(cached),
        ...(cached.ok ? { snapshot: this.snapshotForSession(session) } : {}),
      };
    room.lastActivity = this.nowFn();
    const result = this.applyAction(room, player, action);
    this.storeDedup(room, session.token, action.eventId, result);
    return result;
  }
  public handleAction(session: Session, action: GameAction): Ack {
    return this.action(session, action);
  }

  public snapshot(session: Session): Snapshot | null {
    const room = this.rooms.get(session?.code);
    if (!room) return null;
    this.syncRoom(room);
    if (!this.validSession(session, room)) return null;
    return this.snapshotForSession(session);
  }
  public snapshotForSession(session: Session): Snapshot {
    const room = this.rooms.get(session.code);
    if (!room) throw new Error("Sala no encontrada");
    this.syncRoom(room);
    if (!this.validSession(session, room)) throw new Error("Sesión no válida");
    const result: Snapshot = { public: this.publicSnapshot(room) };
    if (session.kind === "admin") result.admin = this.adminSnapshot(room);
    else {
      const player = room.players.find(
        (candidate) => candidate.token === session.token,
      );
      if (player) result.player = this.playerSnapshot(room, player);
    }
    return result;
  }
  public getSnapshot(session: Session): Snapshot | null {
    return this.snapshot(session);
  }
  public getPublicSnapshot(code: string): PublicState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    this.syncRoom(room);
    return this.publicSnapshot(room);
  }

  public bind(session: Session, socketId: string): string | undefined {
    const room = this.rooms.get(session.code);
    if (!room || !this.validSession(session, room)) return undefined;
    const previous = room.boundSockets.get(session.token);
    room.boundSockets.set(session.token, socketId);
    if (session.kind === "player") {
      const player = room.players.find(
        (candidate) => candidate.token === session.token,
      );
      if (player) {
        player.connected = true;
        player.socketId = socketId;
      }
    }
    this.maybeAutoStart(room);
    if (session.kind === "player" && room.stage === "playing") {
      const player = room.players.find(
        (candidate) => candidate.token === session.token,
      );
      if (player) this.initializePlayerForPhase(room, player);
    }
    return previous && previous !== socketId ? previous : undefined;
  }
  public bindSocket(session: Session, socketId: string): string | undefined {
    return this.bind(session, socketId);
  }
  public unbind(socketId: string): void {
    for (const room of this.rooms.values()) {
      if (
        [...room.boundSockets.values()].some((current) => current === socketId)
      )
        this.syncRoom(room);
      let removed = false;
      let removedAdmin = false;
      for (const [token, current] of room.boundSockets) {
        if (current !== socketId) continue;
        room.boundSockets.delete(token);
        removed = true;
        if (token === room.adminToken) removedAdmin = true;
        const player = room.players.find(
          (candidate) => candidate.token === token,
        );
        if (player && player.socketId === socketId) {
          player.connected = false;
          player.socketId = undefined;
          if (
            room.assigned &&
            PHASE_ORDER.includes(room.phase) &&
            ["briefing", "countdown", "playing"].includes(room.stage)
          ) {
            player.waitUntilNextRound = room.roundNonce;
          }
        }
      }
      if (removed && removedAdmin) {
        this.syncRoom(room);
        this.pauseAutoStartForDisconnect(room);
      }
    }
  }
  public unbindSocket(socketId: string): void {
    this.unbind(socketId);
  }

  private success(session: Session, room: Room): Ack {
    return {
      ok: true,
      session: clone(session),
      snapshot: this.snapshotForSession(session),
    };
  }
  private fail(error: string): Ack {
    return { ok: false, error };
  }
  private validSession(session: Session | undefined, room: Room): boolean {
    if (
      !session ||
      typeof session.token !== "string" ||
      session.code !== room.code
    )
      return false;
    if (session.kind === "admin") return session.token === room.adminToken;
    if (session.kind !== "player" || !Number.isInteger(session.slot))
      return false;
    const player = room.players.find(
      (candidate) => candidate.token === session.token,
    );
    return !!player && player.slot === session.slot;
  }
  private getDedup(
    room: Room,
    token: string,
    eventId: string,
  ): Ack | undefined {
    return room.dedup.get(token)?.get(eventId);
  }
  private storeDedup(
    room: Room,
    token: string,
    eventId: string,
    ack: Ack,
  ): void {
    let events = room.dedup.get(token);
    if (!events) {
      events = new Map();
      room.dedup.set(token, events);
    }
    events.set(eventId, clone(ack));
  }

  private maybeAutoStart(room: Room, at = this.nowFn()): boolean {
    if (
      !room.autoStart ||
      room.phase !== "lobby" ||
      room.assigned ||
      room.players.length !== room.capacity ||
      room.players.some(
        (player) =>
          !player.connected ||
          !player.socketId ||
          room.boundSockets.get(player.token) !== player.socketId,
      ) ||
      !room.boundSockets.has(room.adminToken)
    )
      return false;

    this.assignRoles(room);
    this.enterPhase(room, "mail", false);
    room.running = true;
    room.paused = false;
    room.autoPauseRequiresReconnect = false;
    room.autoBriefingRemainingMs = 20_000;
    room.lastNow = at;
    this.log(
      room,
      "auto-start",
      undefined,
      "El grupo completo quedó armado; comenzó el briefing automático.",
    );
    return true;
  }

  private pauseAutoStartForDisconnect(room: Room): void {
    if (
      !room.autoStart ||
      !room.assigned ||
      !room.running ||
      !["briefing", "countdown"].includes(room.stage) ||
      room.boundSockets.has(room.adminToken)
    )
      return;
    const wasPaused = room.paused;
    room.paused = true;
    room.autoPauseRequiresReconnect = true;
    room.lastNow = this.nowFn();
    if (!wasPaused)
      this.log(
        room,
        "disconnect-pause",
        undefined,
        "El briefing automático quedó pausado hasta reconectar la sesión docente.",
      );
  }

  private syncRoom(room: Room, at = this.nowFn()): boolean {
    if (room.phase === "revealed" && room.revealAt !== undefined) {
      const elapsed = Math.min(
        30,
        Math.max(0, Math.floor((at - room.revealAt) / 1000)),
      );
      const changed = elapsed !== room.revealElapsed;
      room.revealElapsed = elapsed;
      room.lastNow = at;
      return changed;
    }
    if (at < room.lastNow) {
      room.lastNow = at;
      return false;
    }
    const autoStarted = this.maybeAutoStart(room, at);
    const delta = room.running && !room.paused ? at - room.lastNow : 0;
    room.lastNow = at;
    if (delta <= 0) return autoStarted;
    let remaining = delta;
    let changed = autoStarted;
    while (
      remaining > 0 &&
      room.running &&
      !room.paused &&
      !room.roundFinished
    ) {
      if (
        room.stage === "briefing" &&
        room.autoStart &&
        room.autoBriefingRemainingMs > 0
      ) {
        const step = Math.min(remaining, room.autoBriefingRemainingMs);
        room.autoBriefingRemainingMs = Math.max(
          0,
          room.autoBriefingRemainingMs - step,
        );
        remaining -= step;
        changed = true;
        if (room.autoBriefingRemainingMs > 0) break;
        this.beginCountdown(room);
        continue;
      }
      if (room.stage === "countdown") {
        const step = Math.min(remaining, room.countdownMs);
        room.countdownMs = Math.max(0, room.countdownMs - step);
        remaining -= step;
        changed = true;
        if (room.countdownMs > 0) break;
        room.stage = "playing";
        room.clock = 0;
        this.initializePlayingPhase(room);
        continue;
      }
      if (room.stage !== "playing") break;
      const duration = this.phaseDurationMs(room);
      if (duration <= 0) break;
      const step = Math.min(
        remaining,
        Math.max(1, Math.min(this.tickMs, 100)),
        Math.max(0, duration - room.clock),
      );
      if (step <= 0) {
        room.clock = duration;
      } else {
        room.clock = Math.min(duration, room.clock + step);
        remaining -= step;
      }
      changed = true;
      if (room.phase === "mail") this.advanceMail(room);
      if (room.phase === "ddos") this.advanceDdos(room);
      if (room.phase === "identity") this.advanceIdentity(room);
      this.advanceInactivity(room);
      if (room.clock >= duration) {
        room.clock = duration;
        if (room.phase === "recovery") this.finishRecovery(room, true);
        else if (PHASE_ORDER.includes(room.phase))
          this.finishRoundByTimeout(room);
      }
      if (step <= 0 || room.roundFinished) break;
    }
    return changed;
  }

  private phaseDurationMs(room: Room): number {
    if (room.phase === "mail") return room.settings.mailSeconds * 1000;
    if (room.phase === "ddos") return room.settings.ddosSeconds * 1000;
    if (room.phase === "identity") return room.settings.identitySeconds * 1000;
    if (room.phase === "recovery") return room.settings.recoverySeconds * 1000;
    return 0;
  }

  private mailSendCooldownMs(room: Room): number {
    const usableWindowMs = Math.max(
      0,
      this.phaseDurationMs(room) - MAIL_CLOSE_WINDOW_MS,
    );
    // Keep t=0, t=cooldown and t=2*cooldown strictly before the close window.
    const threeSendCooldownMs =
      Math.floor(Math.max(0, usableWindowMs - 1) / 2_000) * 1_000;
    return Math.min(
      MAIL_DEFAULT_SEND_COOLDOWN_MS,
      Math.max(1_000, threeSendCooldownMs),
    );
  }

  private activeForRound(room: Room, player: InternalPlayer): boolean {
    return player.connected && player.waitUntilNextRound !== room.roundNonce;
  }

  private sabotageTarget(room: Room): number {
    return Math.min(
      3,
      room.players.filter(
        (player) =>
          player.role === "defender" && this.activeForRound(room, player),
      ).length,
    );
  }

  private evaluatePausedThresholds(room: Room): void {
    if (room.stage !== "playing" || room.roundFinished) return;
    if (room.phase === "ddos") {
      for (const player of room.players) {
        if (
          player.role === "defender" &&
          !player.blocked &&
          player.saturation >= room.settings.saturationLimit
        ) {
          player.saturation = room.settings.saturationLimit;
          player.blocked = true;
          player.publicBlocked = true;
          player.traffic = [];
        }
      }
      const target = this.sabotageTarget(room);
      if (
        target > 0 &&
        room.players.filter(
          (player) =>
            player.role === "defender" &&
            this.activeForRound(room, player) &&
            player.blocked,
        ).length >= target
      )
        this.finishRound(
          room,
          "impostor",
          this.ddosMetric(room),
          `${target} dependencias defensoras fueron denegadas.`,
        );
    }
    if (room.clock >= this.phaseDurationMs(room)) {
      room.clock = this.phaseDurationMs(room);
      if (room.phase === "recovery") this.finishRecovery(room, true);
      else this.finishRoundByTimeout(room);
    }
  }

  private validateSettings(settings: Settings): string | undefined {
    const timeFields: Array<keyof Settings> = [
      "mailSeconds",
      "ddosSeconds",
      "identitySeconds",
      "recoverySeconds",
    ];
    const minimums: Record<string, number> = {
      mailSeconds: 60,
      ddosSeconds: 30,
      identitySeconds: 30,
      recoverySeconds: 60,
    };
    for (const field of timeFields) {
      const value = settings[field];
      if (
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < minimums[field] ||
        value > 600
      ) {
        return `El parámetro ${field} debe estar entre ${minimums[field]} y 600 segundos.`;
      }
    }
    for (const field of [
      "mailAccuracy",
      "blueAccuracy",
      "identityAccuracy",
    ] as const) {
      const value = settings[field];
      if (!Number.isFinite(value) || value < 50 || value > 100)
        return `El porcentaje ${field} debe estar entre 50 y 100.`;
    }
    if (
      !Number.isFinite(settings.saturationLimit) ||
      !Number.isInteger(settings.saturationLimit) ||
      settings.saturationLimit < 5 ||
      settings.saturationLimit > 20
    ) {
      return "saturationLimit debe estar entre 5 y 20.";
    }
    return undefined;
  }

  private assignRoles(room: Room): void {
    const index = Math.floor(
      Math.max(0, Math.min(0.999999, this.randomFn())) * room.players.length,
    );
    room.players.forEach((player, playerIndex) => {
      player.role = playerIndex === index ? "impostor" : "defender";
    });
    room.assigned = true;
    this.log(room, "assign", undefined, "Los roles privados fueron asignados.");
  }

  private resetGroup(
    room: Room,
    capacity = room.capacity,
    autoStart = room.autoStart,
  ): void {
    this.ensureInvites(room, capacity);
    const fresh = this.emptyRoom(room.code, capacity, this.nowFn());
    fresh.adminToken = room.adminToken;
    fresh.autoStart = autoStart;
    fresh.settings = clone(room.settings);
    fresh.invites = room.invites.map(({ slot, invite, department }) => ({
      slot,
      invite,
      department,
    }));
    // Retain only successful reset/capacity IDs, not stale commands or prior
    // snapshots from the group that was just closed.
    fresh.resetEventIds = room.resetEventIds;
    const adminSocket = room.boundSockets.get(room.adminToken);
    if (adminSocket) fresh.boundSockets.set(room.adminToken, adminSocket);
    Object.assign(room, fresh);
  }

  private applyAdmin(
    room: Room,
    command: AdminCommand,
    settings?: Settings,
    capacity?: unknown,
  ): Ack {
    const admin: Session = {
      code: room.code,
      token: room.adminToken,
      kind: "admin",
    };
    if (command === "capacity") {
      if (!isCapacity(capacity))
        return this.fail("La capacidad debe ser un entero entre 3 y 6.");
      const lobbyChange = room.phase === "lobby" && !room.assigned;
      if (!lobbyChange && room.phase !== "revealed")
        return this.fail(
          "El cupo solo puede confirmarse en el lobby sin asignar o al finalizar la votación.",
        );
      if (lobbyChange) {
        if (room.players.some((player) => player.slot > capacity))
          return this.fail(
            "No se puede reducir el cupo porque ya existe un participante en un puesto superior.",
          );
        this.ensureInvites(room, capacity);
        room.capacity = capacity;
        room.autoStart = true;
        this.maybeAutoStart(room);
      } else {
        this.resetGroup(room, capacity, true);
        this.maybeAutoStart(room);
      }
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "reset-all") {
      this.resetGroup(room);
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "auto-start") {
      if (room.phase !== "lobby" || room.assigned)
        return this.fail("El autoarranque solo puede armarse en el lobby.");
      room.autoStart = true;
      this.maybeAutoStart(room);
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "manual-start") {
      if (room.phase !== "lobby" || room.assigned)
        return this.fail("El modo manual solo puede elegirse en el lobby.");
      room.autoStart = false;
      room.autoBriefingRemainingMs = 0;
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "settings") {
      if (
        room.phase === "voting" ||
        room.phase === "revealed" ||
        (!room.paused && room.stage !== "waiting" && room.stage !== "briefing")
      )
        return this.fail(
          "La configuración solo puede cambiarse antes de iniciar o con la ronda pausada.",
        );
      const incoming = (settings ?? {}) as Partial<Settings>;
      const candidate: Settings = {
        mailSeconds: incoming.mailSeconds ?? room.settings.mailSeconds,
        ddosSeconds: incoming.ddosSeconds ?? room.settings.ddosSeconds,
        identitySeconds:
          incoming.identitySeconds ?? room.settings.identitySeconds,
        recoverySeconds:
          incoming.recoverySeconds ?? room.settings.recoverySeconds,
        mailAccuracy: incoming.mailAccuracy ?? room.settings.mailAccuracy,
        blueAccuracy: incoming.blueAccuracy ?? room.settings.blueAccuracy,
        identityAccuracy:
          incoming.identityAccuracy ?? room.settings.identityAccuracy,
        saturationLimit:
          incoming.saturationLimit ?? room.settings.saturationLimit,
      };
      const validation = this.validateSettings(candidate);
      if (validation) return this.fail(validation);
      room.settings = clone(candidate);
      this.log(
        room,
        "settings",
        undefined,
        `Se actualizaron los parámetros permitidos: ${JSON.stringify(candidate)}.`,
      );
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "assign") {
      if (room.phase !== "lobby" || room.assigned)
        return this.fail(
          "La asignación solo puede hacerse una vez en preparación.",
        );
      if (room.autoStart)
        return this.fail(
          "Desactiva el autoarranque antes de asignar roles manualmente.",
        );
      if (
        room.players.length < 3 ||
        room.players.some((player) => !player.connected)
      )
        return this.fail(
          "Conecta al menos tres participantes y a quienes entraron antes de asignar el grupo.",
        );
      this.assignRoles(room);
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "start") {
      if (!room.assigned)
        return this.fail("Primero se deben asignar los roles.");
      if (room.phase === "lobby" && !room.roundFinished)
        this.enterPhase(room, "mail", true);
      else if (
        PHASE_ORDER.includes(room.phase) &&
        room.stage === "briefing" &&
        !room.running &&
        !room.roundFinished
      )
        this.beginCountdown(room);
      else
        return this.fail(
          "La partida ya fue iniciada o no está lista para comenzar.",
        );
      this.log(
        room,
        "start",
        undefined,
        `La sesión docente inició la fase ${room.phase}.`,
      );
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "pause") {
      if (
        !room.running ||
        room.roundFinished ||
        room.phase === "lobby" ||
        room.phase === "voting" ||
        room.phase === "revealed"
      )
        return this.fail("No hay una ronda activa que pausar.");
      room.paused = true;
      room.lastNow = this.nowFn();
      this.log(room, "pause", undefined, "La sesión docente pausó el reloj.");
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "resume") {
      if (!room.running || room.roundFinished || !room.paused)
        return this.fail("La sala no está pausada.");
      if (
        room.autoPauseRequiresReconnect &&
        !room.boundSockets.has(room.adminToken)
      )
        return this.fail("Reconecta al administrador antes de reanudar.");
      room.paused = false;
      room.autoPauseRequiresReconnect = false;
      room.lastNow = this.nowFn();
      this.evaluatePausedThresholds(room);
      if (room.roundFinished)
        return { ok: true, snapshot: this.snapshotForSession(admin) };
      this.log(
        room,
        "resume",
        undefined,
        "La sesión docente reanudó el reloj.",
      );
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "restart") {
      if (!room.assigned)
        return this.fail("No hay una partida asignada para reiniciar.");
      if (PHASE_ORDER.includes(room.phase)) {
        const resultIndex = room.results.findIndex(
          (result) => result.phase === room.phase,
        );
        if (resultIndex >= 0) {
          const [removed] = room.results.splice(resultIndex, 1);
          if (removed.winner === "defenders")
            room.scores.defenders = Math.max(0, room.scores.defenders - 1);
          if (removed.winner === "impostor")
            room.scores.impostor = Math.max(0, room.scores.impostor - 1);
        }
        this.enterPhase(room, room.phase, false);
        this.log(
          room,
          "restart",
          undefined,
          `La sesión docente reinició la fase ${room.phase}.`,
        );
        return { ok: true, snapshot: this.snapshotForSession(admin) };
      }
      return this.fail(
        "Solo se puede reiniciar una ronda técnica activa o terminada.",
      );
    }
    if (command === "stop") {
      if (!PHASE_ORDER.includes(room.phase) || room.stage === "finished")
        return this.fail("No hay una ronda técnica que interrumpir.");
      if (room.phase === "recovery") {
        room.recoveryStarted = true;
        this.finishRecovery(room, true, true);
        room.recoveryDone = false;
      } else
        this.finishRound(
          room,
          "inconclusive",
          0,
          "Interrumpida por administrador.",
        );
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "next") {
      if (!PHASE_ORDER.includes(room.phase) || !room.roundFinished)
        return this.fail("La ronda actual aún no está terminada.");
      const index = PHASE_ORDER.indexOf(room.phase);
      if (index >= PHASE_ORDER.length - 1)
        return this.fail(
          "La siguiente etapa se abre con el comando de votación.",
        );
      this.enterPhase(room, PHASE_ORDER[index + 1], false);
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "judgment" || command === "voting") {
      if (
        (room.phase !== "recovery" &&
          !(
            command === "voting" &&
            room.phase === "voting" &&
            room.judgmentDebate
          )) ||
        !room.recoveryStarted ||
        !room.roundFinished
      )
        return this.fail("La recuperación todavía no terminó.");
      room.phase = "voting";
      room.running = false;
      room.paused = false;
      room.roundFinished = true;
      room.judgmentDebate = command === "judgment";
      room.votesOpen = command === "voting";
      if (room.votesOpen) {
        room.votingEligible = room.players
          .filter((p) => p.connected)
          .map((p) => p.token);
        room.votingDefenders = room.players
          .filter((p) => p.connected && p.role === "defender")
          .map((p) => p.token);
      }
      room.players.forEach((player) => {
        if (player.waitUntilNextRound === room.roundNonce)
          player.waitUntilNextRound = undefined;
        player.vote = undefined;
      });
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    if (command === "reveal") {
      if (room.phase !== "voting" || !room.votesOpen)
        return this.fail("La votación no está abierta.");
      const impostor = room.players.find(
        (player) => player.role === "impostor",
      );
      if (!impostor) return this.fail("No hay un impostor asignado.");
      const bonus = votingBonus(
        room.votingDefenders,
        room.players
          .filter((p) => p.vote)
          .map((p) => ({ id: p.token, suspect: p.vote!.suspect })),
        impostor.department,
      );
      room.scores[bonus.winner] += 1;
      room.results.push({
        phase: "voting",
        winner: bonus.winner,
        metric: bonus.eligible
          ? Math.round((bonus.correct / bonus.eligible) * 100)
          : 0,
        description: `Identificación: ${bonus.correct}/${bonus.eligible} defensores elegibles; mayoría requerida ${bonus.required}.`,
      });
      const winner: "defenders" | "impostor" | "tie" =
        room.scores.defenders > room.scores.impostor
          ? "defenders"
          : room.scores.impostor > room.scores.defenders
            ? "impostor"
            : "tie";
      room.reveal = {
        impostorDepartmentId: impostor.department,
        impostorDepartment:
          DEPARTMENTS.find(
            (department) => department.id === impostor.department,
          )?.name ?? impostor.department,
        impostorName: impostor.name,
        winner,
        bonus,
        reflection: finalReflection(room.results, {
          inspected: room.logs.some((l) => l.type === "mail_inspect"),
          blueLost: room.logs.some((l) => l.type === "blue_lost"),
          redImpact: room.logs.some((l) => l.type === "red_impact"),
        }),
        votes: room.players
          .filter((player) => player.vote)
          .map((player) => ({
            voter: player.name,
            suspect:
              DEPARTMENTS.find(
                (department) => department.id === player.vote!.suspect,
              )?.name ?? player.vote!.suspect,
            reason: player.vote!.reason,
          })),
        logs: clone(room.logs),
      };
      room.phase = "revealed";
      room.revealAt = this.nowFn();
      room.revealElapsed = 0;
      room.running = false;
      room.paused = false;
      room.votesOpen = false;
      return { ok: true, snapshot: this.snapshotForSession(admin) };
    }
    return this.fail("Comando docente no válido.");
  }

  private beginCountdown(room: Room): void {
    if (!PHASE_ORDER.includes(room.phase) || room.stage !== "briefing") return;
    room.stage = "countdown";
    room.countdownMs = 5_000;
    room.autoBriefingRemainingMs = 0;
    room.running = true;
    room.paused = false;
    room.clock = 0;
    room.lastNow = this.nowFn();
    this.log(
      room,
      "countdown",
      undefined,
      "La cuenta regresiva del servidor comenzó.",
    );
  }

  private initializePlayingPhase(room: Room): void {
    if (room.phase === "mail") this.initializeMail(room);
    if (room.phase === "ddos") this.initializeDdos(room);
    if (room.phase === "identity") this.initializeIdentity(room);
    if (room.phase === "recovery") {
      room.recoveryStarted = true;
      this.initializeRecovery(room);
    }
    this.log(room, "playing", undefined, `La fase ${room.phase} está activa.`);
  }

  private enterPhase(room: Room, phase: Phase, startNow = false): void {
    // Repeating a mission replaces its chapter, never appends a second penalty.
    room.cityChapters = room.cityChapters.filter(
      (chapter) => chapter.phase !== phase,
    );
    room.phase = phase;
    room.stage = phase === "lobby" ? "waiting" : "briefing";
    room.countdownMs = 0;
    room.autoBriefingRemainingMs = 0;
    room.roundNonce = secret("rnd");
    room.clock = 0;
    room.lastNow = this.nowFn();
    room.running = false;
    room.paused = false;
    room.autoPauseRequiresReconnect = false;
    room.roundFinished = false;
    room.votesOpen = false;
    room.judgmentDebate = false;
    room.votingEligible = [];
    room.votingDefenders = [];
    room.revealAt = undefined;
    room.revealElapsed = 0;
    room.players.forEach((player) => {
      // Las acciones de jugador se deduplican dentro de cada ronda; el docente
      // conserva sus IDs para que un reintento de restart no reinicie dos veces.
      room.dedup.delete(player.token);
      player.blocked = false;
      player.publicBlocked = false;
      player.mail = [];
      player.mailCooldownUntil = 0;
      player.mailInspectionsRemaining = MAIL_INSPECTIONS;
      player.mailCorrect = 0;
      player.mailDecisions = 0;
      player.mailReceived = 0;
      player.mailMistakes = 0;
      player.publicMailRisk = 0;
      player.inactivityPenalties = 0;
      player.nextIdleAt = 0;
      player.inactivityEligible = false;
      player.traffic = [];
      player.ddosShieldUsed = false;
      player.ddosShieldUntil = 0;
      player.ddosAbsorbed = 0;
      player.ddosAbsorbedUntil = 0;
      player.ddosWaveUntil = 0;
      player.ddosChallenge = undefined;
      player.saturation = 0;
      player.lastRedHit = null;
      player.blueEmitted = 0;
      player.blueSuccess = 0;
      player.blueLost = 0;
      player.card = null;
      player.pendingCards = [];
      player.identityCooldownUntil = 0;
      player.legitShown = 0;
      player.legitAuthorized = 0;
      player.identityLost = 0;
      player.infiltrations = 0;
      player.publicInfiltrations = 0;
      player.identityIncoming = 0;
      player.identityProfileSequence = 0;
      player.identityFalseSequence = 0;
      player.identityMix = [];
      player.identityVerificationsRemaining = IDENTITY_VERIFICATIONS;
      player.identityDecoyStages = [];
      player.identityEventOwed = undefined;
      player.identityEvent = undefined;
      player.identityChallenge = undefined;
      player.fragment = undefined;
      player.recoveryChallenge = undefined;
      player.vote = undefined;
    });
    room.mailArrivalIndex = 0;
    room.mailNextAt = MAIL_INTERVAL_MS;
    room.mailSequence = 0;
    room.mailPublicPulseAt = 10_000;
    room.mailMaliciousAccepted = 0;
    room.ddosNextSpawn = 0;
    room.ddosSequence = 0;
    room.ddosWaveAlertUntil = 0;
    room.identitySequence = 0;
    room.identityPublicPulseAt = 10_000;
    room.identityEventDone = false;
    room.identityEventUntil = 0;
    room.identityAlertPending = false;
    room.identityAlertUntil = 0;
    room.recoveryDone = false;
    room.recoveryStarted = phase === "recovery" && startNow;
    room.recoveryTotal = room.players.filter(
      (p) => p.role === "defender",
    ).length;
    room.recoveryCompleted = 0;
    room.recoveryAlertUntil = 0;
    room.players.forEach((player) => {
      player.waitUntilNextRound = undefined;
    });
    this.log(
      room,
      "phase",
      undefined,
      `La fase ${phase} está lista para instrucciones.`,
    );
    if (startNow && PHASE_ORDER.includes(phase)) this.beginCountdown(room);
  }

  private initializeMail(room: Room): void {
    for (const player of room.players) {
      this.initializePlayerForPhase(room, player);
    }
  }

  private initializePlayerForPhase(room: Room, player: InternalPlayer): void {
    if (
      !this.activeForRound(room, player) ||
      player.blocked ||
      player.initializedRound === room.roundNonce ||
      !PHASE_ORDER.includes(room.phase)
    )
      return;
    player.initializedRound = room.roundNonce;
    if (room.phase === "mail") {
      const initialIds = ["legit-alert", "fake-support", "legit-service"];
      const initial = initialIds.map(
        (id) => ALL_TEMPLATES.find((template) => template.id === id)!,
      );
      const offset = (player.slot - 1) % initial.length;
      initial.push(...initial.splice(0, offset));
      for (const template of initial)
        this.addMail(room, player, "auto", undefined, template);
    } else if (room.phase === "ddos") {
      const kind = this.randomFn() < 0.6 ? "blue" : "red";
      player.traffic.push({
        id: `${room.roundNonce}-point-${room.ddosSequence++}`,
        kind,
        angle: this.nextTrafficAngle(player),
        born: room.clock,
        arrives: room.clock + DDOS_TRAVEL_MS,
        ownerToken: player.token,
      });
      if (player.role === "defender" && kind === "blue")
        player.blueEmitted += 1;
    } else if (room.phase === "identity") {
      player.card = this.newAutomaticIdentity(room, player);
      this.activateIdentity(room, player, player.card);
      for (let i = 0; i < 2; i += 1)
        player.pendingCards.push(this.newAutomaticIdentity(room, player));
    }
  }

  private initializeDdos(room: Room): void {
    room.ddosNextSpawn = 0;
    this.advanceDdos(room);
    const impostor = room.players.find((player) => player.role === "impostor");
    if (impostor) {
      // A peak alone is not evidence: compare sustained requests per client.
      const load = 30 + Math.floor(randomUnit(this.randomFn) * 15);
      const patterns = shuffle(
        [
          { requests: [load, load + 4, load + 2], clients: 1, malicious: true },
          {
            requests: [load, load + 9, load - 3],
            clients: load,
            malicious: false,
          },
          { requests: [2, 4, 1], clients: 1, malicious: false },
        ],
        this.randomFn,
      );
      impostor.ddosChallenge = {
        patterns: patterns.map((pattern, index) => ({
          id: `origin-${index + 1}`,
          label: `Origen ${String.fromCharCode(65 + index)}`,
          requests: pattern.requests,
          clients: pattern.clients,
        })),
        answer: `origin-${patterns.findIndex((pattern) => pattern.malicious) + 1}`,
        solved: false,
        waveUsed: false,
        retryAt: 0,
      };
    }
  }

  private initializeIdentity(room: Room): void {
    for (const player of room.players) {
      this.initializePlayerForPhase(room, player);
    }
    const impostor = room.players.find((player) => player.role === "impostor");
    if (impostor) {
      const profile = Math.floor(
        randomUnit(this.randomFn) * IDENTITY_PROFILES.length,
      );
      const key =
        DOSSIER_KEYS[
          Math.floor(randomUnit(this.randomFn) * DOSSIER_KEYS.length)
        ];
      impostor.identityChallenge = {
        ...buildDossier(profile, key),
        solved: false,
        advancedAvailable: false,
        advancedUsed: false,
        retryAt: 0,
      };
    }
  }

  private initializeRecovery(room: Room): void {
    const defenders = room.players
      .filter((player) => player.role === "defender")
      .sort((a, b) => a.slot - b.slot);
    const count = defenders.length;
    const words =
      count === 2
        ? ["CANCUN RECUPERA", "EL CONTROL"]
        : count === 3
          ? ["CANCUN", "RECUPERA", "EL CONTROL"]
          : RECOVERY_WORDS.slice(0, count);
    room.recoveryTotal = count;
    defenders.forEach((player, index) => {
      const answer = normalizeAnswer(words[index]);
      player.fragment = {
        order: index + 1,
        plaintext: words[index],
        cipher: cipherCesar(words[index], RECOVERY_BASE_SHIFT),
        answer,
        solved: false,
        shift: RECOVERY_BASE_SHIFT,
        altered: false,
        verificationUsed: false,
      };
    });
    const impostor = room.players.find((player) => player.role === "impostor");
    if (impostor) {
      impostor.fragment = undefined;
      const challenge =
        RECOVERY_CHALLENGES[
          Math.floor(randomUnit(this.randomFn) * RECOVERY_CHALLENGES.length)
        ];
      impostor.recoveryChallenge = {
        cipher: cipherCesar(challenge.plaintext, challenge.shift),
        answer: normalizeAnswer(challenge.plaintext),
        hint: `Retrocede ${challenge.shift} ${challenge.shift === 1 ? "lugar" : "lugares"}.`,
        shift: challenge.shift,
        solved: false,
        sabotageAvailable: false,
        sabotageUsed: false,
      };
    }
  }

  private validatePhaseAction(room: Room, phase: Phase): string | undefined {
    if (room.phase !== phase)
      return "La acción no corresponde a la fase actual.";
    if (
      room.stage !== "playing" ||
      !room.running ||
      room.paused ||
      room.roundFinished
    )
      return "La fase no está activa.";
    return undefined;
  }

  private applyAction(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    let result: Ack;
    if (action.type === "mail:classify")
      result = this.classifyMail(room, player, action);
    else if (action.type === "mail:inspect")
      result = this.inspectMail(room, player, action);
    else if (action.type === "mail:send")
      result = this.sendMail(room, player, action);
    else if (action.type === "ddos:tap")
      result = this.tapTraffic(room, player, action);
    else if (action.type === "ddos:shield")
      result = this.activateDdosShield(room, player);
    else if (action.type === "ddos:challenge-solve")
      result = this.solveDdosChallenge(room, player, action);
    else if (action.type === "ddos:wave")
      result = this.launchDdosWave(room, player, action);
    else if (action.type === "identity:decide")
      result = this.decideIdentity(room, player, action);
    else if (action.type === "identity:send")
      result = this.sendIdentity(room, player, action);
    else if (action.type === "identity:verify")
      result = this.verifyIdentity(room, player, action);
    else if (action.type === "identity:challenge-solve")
      result = this.solveIdentityChallenge(room, player, action);
    else if (action.type === "identity:send-advanced")
      result = this.sendAdvancedIdentity(room, player);
    else if (action.type === "recovery:solve")
      result = this.solveRecovery(room, player, action);
    else if (action.type === "recovery:challenge-solve")
      result = this.solveRecoveryChallenge(room, player, action);
    else if (action.type === "recovery:sabotage")
      result = this.sabotageRecovery(room, player, action);
    else if (action.type === "recovery:verify")
      result = this.verifyRecoveryKey(room, player);
    else if (action.type === "vote")
      result = this.castVote(room, player, action);
    else result = this.fail("Acción no válida.");
    if (
      result.ok &&
      [
        "mail:classify",
        "mail:inspect",
        "mail:send",
        "ddos:tap",
        "identity:decide",
        "identity:send",
        "identity:verify",
      ].includes(action.type)
    )
      this.resetInactivityDeadline(room, player);
    return result;
  }

  private inactivityHasContent(room: Room, player: InternalPlayer): boolean {
    if (room.phase === "ddos")
      return (
        room.clock >= player.ddosShieldUntil &&
        player.traffic.some(
          (point) =>
            point.kind === "red" &&
            point.born <= room.clock &&
            point.arrives > room.clock,
        )
      );
    if (room.phase === "identity") return player.card?.shown === true;
    return false;
  }

  private inactivityCanRun(room: Room, player: InternalPlayer): boolean {
    return (
      ["ddos", "identity"].includes(room.phase) &&
      room.stage === "playing" &&
      room.running &&
      !room.paused &&
      !room.roundFinished &&
      this.activeForRound(room, player) &&
      !player.blocked
    );
  }

  private disableInactivity(player: InternalPlayer): void {
    player.inactivityEligible = false;
    player.nextIdleAt = 0;
  }

  private armInactivity(room: Room, player: InternalPlayer): void {
    if (
      !this.inactivityCanRun(room, player) ||
      !this.inactivityHasContent(room, player)
    ) {
      this.disableInactivity(player);
      return;
    }
    if (!player.inactivityEligible) {
      player.inactivityEligible = true;
      player.nextIdleAt = room.clock + 5_000;
    }
  }

  private resetInactivityDeadline(room: Room, player: InternalPlayer): void {
    if (
      !this.inactivityCanRun(room, player) ||
      !this.inactivityHasContent(room, player)
    ) {
      this.disableInactivity(player);
      return;
    }
    player.inactivityEligible = true;
    player.nextIdleAt = room.clock + 5_000;
  }

  private advanceInactivity(room: Room): void {
    if (!["ddos", "identity"].includes(room.phase)) return;
    for (const player of room.players) {
      if (
        !this.inactivityCanRun(room, player) ||
        !this.inactivityHasContent(room, player)
      ) {
        this.disableInactivity(player);
        continue;
      }
      this.armInactivity(room, player);
      while (player.inactivityEligible && room.clock >= player.nextIdleAt) {
        player.inactivityPenalties += 1;
        this.log(
          room,
          "inactivity_penalty",
          player.department,
          `Se sumó un punto malo por 5 segundos sin acción válida; total=${player.inactivityPenalties}.`,
        );
        player.nextIdleAt += 5_000;
      }
    }
  }

  private addMail(
    room: Room,
    target: InternalPlayer,
    source: "auto" | "player",
    senderToken: string | undefined,
    template: InternalMailTemplate,
  ): boolean {
    if (target.mail.length >= 30) return false;
    const card: InternalMail = {
      id: `${room.roundNonce}-mail-${room.mailSequence++}`,
      senderName: template.senderName,
      sender: template.sender,
      subject: template.subject,
      preview: template.preview,
      ...(template.context ? { context: template.context } : {}),
      malicious: template.kind === "attack",
      source,
      senderToken,
      inspectionDetails: clone(template.inspection),
      inspected: false,
    };
    target.mail.push(card);
    target.mailReceived += 1;
    return true;
  }

  private advanceMail(room: Room): void {
    const freezeAt = Math.max(
      0,
      this.phaseDurationMs(room) - MAIL_CLOSE_WINDOW_MS,
    );
    while (room.clock >= room.mailNextAt && room.mailNextAt < freezeAt) {
      const progress =
        room.mailNextAt / Math.max(1, this.phaseDurationMs(room));
      const stage: MailStage =
        progress < 1 / 3
          ? "recognition"
          : progress < 2 / 3
            ? "analysis"
            : "pressure";
      const templates = ALL_TEMPLATES.filter(
        (template) => template.stage === stage,
      );
      for (const player of room.players) {
        if (!this.activeForRound(room, player)) continue;
        const template =
          stage === "recognition"
            ? IMPOSTOR_TEMPLATES.find(
                (candidate) => candidate.id === "fake-provider",
              )!
            : templates[
                (room.mailArrivalIndex + player.slot - 1) % templates.length
              ];
        this.addMail(room, player, "auto", undefined, template);
      }
      room.mailArrivalIndex += 1;
      room.mailNextAt += MAIL_INTERVAL_MS;
    }
    if (room.clock >= room.mailPublicPulseAt) {
      for (const player of room.players)
        if (this.activeForRound(room, player))
          player.publicMailRisk = Math.min(3, player.mailMistakes);
      while (room.mailPublicPulseAt <= room.clock)
        room.mailPublicPulseAt += 10_000;
    }
  }

  private classifyMail(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "mail");
    if (phaseError) return this.fail(phaseError);
    if (!validText(action.cardId, 1, 80) || typeof action.accept !== "boolean")
      return this.fail(
        "La clasificación requiere un correo y una decisión válida.",
      );
    const index = player.mail.findIndex((mail) => mail.id === action.cardId);
    if (index < 0) return this.fail("Ese correo ya no está disponible.");
    const mail = player.mail[index];
    player.mail.splice(index, 1);
    const sourcePlayer = mail.senderToken
      ? room.players.find((candidate) => candidate.token === mail.senderToken)
      : undefined;
    const correct = action.accept !== mail.malicious;
    if (!correct) player.mailMistakes += 1;
    if (player.role === "defender") {
      player.mailDecisions += 1;
      if (correct) player.mailCorrect += 1;
      if (action.accept && mail.malicious && mail.source === "player") {
        room.mailMaliciousAccepted += 1;
        if (room.mailMaliciousAccepted >= 3) {
          this.finishRound(
            room,
            "impostor",
            this.mailMetric(room),
            "Tres correos maliciosos fueron aceptados.",
          );
        }
      }
      this.log(
        room,
        "mail_decision",
        player.department,
        `sender=${mail.sender} subject=${mail.subject} decision=${action.accept ? "accept" : "reject"} correct=${correct} source=${mail.source} impostor=${sourcePlayer?.role === "impostor"}.`,
      );
    } else {
      this.log(
        room,
        "mail_decision",
        player.department,
        `sender=${mail.sender} subject=${mail.subject} decision=${action.accept ? "accept" : "reject"} correct=excluded source=${mail.source} impostor=${sourcePlayer?.role === "impostor"}.`,
      );
    }
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private inspectMail(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "mail");
    if (phaseError) return this.fail(phaseError);
    if (!validText(action.cardId, 1, 80))
      return this.fail("La inspección requiere un correo válido.");
    const mail = player.mail.find(
      (candidate) => candidate.id === action.cardId,
    );
    if (!mail) return this.fail("Ese correo ya no está disponible.");
    if (mail.inspected) return this.fail("Ese correo ya fue inspeccionado.");
    if (player.mailInspectionsRemaining <= 0)
      return this.fail("No quedan inspecciones disponibles.");
    mail.inspected = true;
    player.mailInspectionsRemaining -= 1;
    this.log(
      room,
      "mail_inspect",
      player.department,
      `Se inspeccionó el correo ${mail.id}; remaining=${player.mailInspectionsRemaining}.`,
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private sendMail(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "mail");
    if (phaseError) return this.fail(phaseError);
    const freezeAt = Math.max(
      0,
      this.phaseDurationMs(room) - MAIL_CLOSE_WINDOW_MS,
    );
    if (room.clock >= freezeAt)
      return this.fail("Los envíos están cerrados al final de la ronda.");
    if (room.clock < player.mailCooldownUntil)
      return this.fail("El envío todavía está en enfriamiento.");
    if (
      !validText(action.templateId, 1, 80) ||
      !validText(action.target, 1, 40)
    )
      return this.fail("El envío requiere una plantilla y una dependencia.");
    const template = ALL_TEMPLATES.find(
      (candidate) => candidate.id === action.templateId,
    );
    const target = room.players.find(
      (candidate) =>
        candidate.department === action.target &&
        candidate.token !== player.token &&
        this.activeForRound(room, candidate),
    );
    if (!template || !target)
      return this.fail("La plantilla o la dependencia no son válidas.");
    const malicious = template.kind === "attack";
    if (player.role !== "impostor" && malicious)
      return this.fail(
        "Una persona defensora solo puede usar plantillas oficiales.",
      );
    if (!this.addMail(room, target, "player", player.token, template))
      return this.fail("La bandeja de destino alcanzó su límite.");
    player.mailCooldownUntil = room.clock + this.mailSendCooldownMs(room);
    this.log(
      room,
      "mail_send",
      player.department,
      `origin=${player.department} destination=${target.department} sender=${template.sender} subject=${template.subject} malicious=${malicious}.`,
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private advanceDdos(room: Room): void {
    while (
      room.clock >= room.ddosNextSpawn &&
      room.ddosNextSpawn < this.phaseDurationMs(room)
    ) {
      const interval = ddosSpawnInterval(
        room.ddosNextSpawn,
        this.phaseDurationMs(room),
      );
      for (const player of room.players) {
        if (player.blocked || !this.activeForRound(room, player)) continue;
        const kind: "blue" | "red" = this.randomFn() < 0.6 ? "blue" : "red";
        const point: InternalTraffic = {
          id: `${room.roundNonce}-point-${room.ddosSequence++}`,
          kind,
          angle: this.nextTrafficAngle(player),
          born: room.ddosNextSpawn,
          arrives: room.ddosNextSpawn + DDOS_TRAVEL_MS,
          ownerToken: player.token,
        };
        player.traffic.push(point);
        player.initializedRound = room.roundNonce;
        if (player.role === "defender" && kind === "blue")
          player.blueEmitted += 1;
      }
      room.ddosNextSpawn += interval;
      if (interval <= 0) break;
    }
    for (const player of room.players) {
      if (!this.activeForRound(room, player)) continue;
      if (player.blocked) {
        player.traffic = [];
        continue;
      }
      for (const point of [...player.traffic]) {
        if (room.clock < point.arrives) continue;
        const index = player.traffic.findIndex(
          (candidate) => candidate.id === point.id,
        );
        if (index < 0) continue;
        player.traffic.splice(index, 1);
        if (point.kind === "blue") {
          if (player.role === "defender") {
            player.blueSuccess += 1;
            this.log(
              room,
              "blue_success",
              player.department,
              "Una petición azul llegó correctamente al servicio.",
            );
          }
        } else if (point.arrives < player.ddosShieldUntil) {
          player.ddosAbsorbed += 1;
          player.ddosAbsorbedUntil = room.clock + 800;
          this.log(
            room,
            "shield_absorb",
            player.department,
            "El escudo absorbió una señal naranja.",
          );
        } else {
          player.lastRedHit = point.arrives;
          player.saturation = Math.min(
            room.settings.saturationLimit,
            player.saturation + 1,
          );
          this.log(
            room,
            "red_impact",
            player.department,
            `Un punto sospechoso alcanzó un servicio; saturation=${player.saturation}.`,
          );
          if (player.saturation >= room.settings.saturationLimit)
            player.publicBlocked = true;
          if (
            player.role === "defender" &&
            player.saturation >= room.settings.saturationLimit
          ) {
            player.saturation = room.settings.saturationLimit;
            player.blocked = true;
            player.publicBlocked = true;
            player.traffic = [];
            this.log(
              room,
              "blocked",
              player.department,
              "Un servicio fue denegado por saturación.",
            );
          }
        }
      }
      if (!player.blocked && player.saturation > 0) {
        const lastHit = player.lastRedHit ?? 0;
        const releases = Math.floor(Math.max(0, room.clock - lastHit) / 5_000);
        if (releases > 0) {
          player.saturation = Math.max(0, player.saturation - releases);
          player.lastRedHit = lastHit + releases * 5_000;
          this.log(
            room,
            "saturation_release",
            player.department,
            `Se liberaron ${releases} segmentos; saturation=${player.saturation}.`,
          );
        }
      }
    }
    const target = this.sabotageTarget(room);
    if (
      target > 0 &&
      room.players.filter(
        (player) =>
          player.role === "defender" &&
          this.activeForRound(room, player) &&
          player.blocked,
      ).length >= target
    ) {
      this.finishRound(
        room,
        "impostor",
        this.ddosMetric(room),
        `${target} dependencias defensoras fueron denegadas.`,
      );
    }
  }

  private nextTrafficAngle(player: InternalPlayer): number {
    const minimum = 0.65;
    const active = player.traffic.map((point) => point.angle);
    if (!active.length) return randomUnit(this.randomFn) * Math.PI * 2;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = randomUnit(this.randomFn) * Math.PI * 2;
      if (
        active.every((angle) => {
          const difference = Math.abs(candidate - angle);
          return Math.min(difference, Math.PI * 2 - difference) >= minimum;
        })
      )
        return candidate;
    }
    const sorted = [...active].sort((a, b) => a - b);
    let bestStart = sorted[sorted.length - 1];
    let bestGap = sorted[0] + Math.PI * 2 - bestStart;
    for (let index = 1; index < sorted.length; index += 1) {
      const gap = sorted[index] - sorted[index - 1];
      if (gap > bestGap) {
        bestGap = gap;
        bestStart = sorted[index - 1];
      }
    }
    return (bestStart + bestGap / 2) % (Math.PI * 2);
  }

  private tapTraffic(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "ddos");
    if (phaseError) return this.fail(phaseError);
    if (!this.activeForRound(room, player))
      return this.fail("La terminal no está activa.");
    if (player.blocked)
      return this.fail("La dependencia ya está bloqueada en esta ronda.");
    if (!validText(action.pointId, 1, 80))
      return this.fail("El punto de tráfico es obligatorio.");
    const index = player.traffic.findIndex(
      (point) => point.id === action.pointId,
    );
    if (index < 0) return this.fail("El punto no existe o ya expiró.");
    const point = player.traffic[index];
    if (room.clock < point.born || room.clock >= point.arrives)
      return this.fail("El punto no está disponible.");
    player.traffic.splice(index, 1);
    if (point.kind === "blue") {
      if (player.role === "defender") {
        player.blueLost += 1;
        this.log(
          room,
          "blue_lost",
          player.department,
          "Una petición azul fue eliminada antes de llegar.",
        );
      }
    }
    this.log(
      room,
      "traffic_tap",
      player.department,
      `Se atendió un punto ${point.kind}; origin=${player.department}.`,
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private activateDdosShield(room: Room, player: InternalPlayer): Ack {
    const error = this.validatePhaseAction(room, "ddos");
    if (error) return this.fail(error);
    if (!this.activeForRound(room, player))
      return this.fail("La terminal no está activa.");
    if (player.role !== "defender" || player.blocked || player.ddosShieldUsed)
      return this.fail("El escudo no está disponible para esta sesión.");
    player.ddosShieldUsed = true;
    player.ddosShieldUntil = room.clock + DDOS_SHIELD_MS;
    this.disableInactivity(player);
    this.log(
      room,
      "shield_activate",
      player.department,
      "Se activó el escudo de emergencia durante 4 s.",
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private solveDdosChallenge(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const error = this.validatePhaseAction(room, "ddos");
    if (error) return this.fail(error);
    if (!this.activeForRound(room, player))
      return this.fail("La terminal no está activa.");
    const challenge = player.ddosChallenge;
    if (player.role !== "impostor" || !challenge || challenge.solved)
      return this.fail("No hay un análisis pendiente para esta sesión.");
    if (room.clock < challenge.retryAt)
      return this.fail("Espera antes de reintentar el análisis.");
    if (
      !validText(action.answer, 1, 40) ||
      !challenge.patterns.some((pattern) => pattern.id === action.answer)
    )
      return this.fail("Selecciona uno de los orígenes del análisis.");
    if (action.answer !== challenge.answer) {
      challenge.retryAt = room.clock + 3_000;
      return this.fail(
        "Compara la repetición por cliente en las tres ventanas.",
      );
    }
    challenge.solved = true;
    this.log(
      room,
      "ddos_challenge_solved",
      player.department,
      "El análisis desbloqueó una oleada.",
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private launchDdosWave(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const error = this.validatePhaseAction(room, "ddos");
    if (error) return this.fail(error);
    if (!this.activeForRound(room, player))
      return this.fail("La terminal no está activa.");
    const challenge = player.ddosChallenge;
    if (player.role !== "impostor" || !challenge?.solved || challenge.waveUsed)
      return this.fail(
        "Primero resuelve el análisis; solo hay una oleada por ronda.",
      );
    if (room.clock + DDOS_TRAVEL_MS > this.phaseDurationMs(room))
      return this.fail("Ya no queda tiempo para que llegue una oleada.");
    if (!validText(action.target, 1, 40))
      return this.fail("Selecciona una dependencia defensora.");
    const target = room.players.find(
      (candidate) =>
        candidate.department === action.target &&
        candidate.role === "defender" &&
        this.activeForRound(room, candidate) &&
        !candidate.blocked,
    );
    if (!target) return this.fail("Ese objetivo no está disponible.");
    for (let i = 0; i < DDOS_WAVE_SIZE; i += 1)
      target.traffic.push({
        id: `${room.roundNonce}-point-${room.ddosSequence++}`,
        kind: "red",
        angle: this.nextTrafficAngle(target),
        born: room.clock,
        arrives: room.clock + DDOS_TRAVEL_MS,
        ownerToken: target.token,
      });
    challenge.waveUsed = true;
    target.ddosWaveUntil = room.clock + DDOS_TRAVEL_MS;
    room.ddosWaveAlertUntil = room.clock + 6_000;
    this.armInactivity(room, target);
    this.log(
      room,
      "ddos_wave",
      player.department,
      `destination=${target.department}; count=${DDOS_WAVE_SIZE}.`,
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private identityStage(room: Room): number {
    const third = (room.settings.identitySeconds * 1000) / 3;
    return Math.min(2, Math.floor(room.clock / Math.max(1, third)));
  }

  private alteredCredential(
    reference: Credential,
    profileIndex: number,
    alteration: IdentityAlteration | "person" | "synthetic",
  ): Credential {
    const presented: Credential = { ...reference };
    if (alteration === "avatar")
      presented.avatar = (reference.avatar + 1) % IDENTITY_PROFILES.length;
    else if (alteration === "symbol")
      presented.symbol = (reference.symbol + 1) % 4;
    else if (alteration === "code")
      presented.code = perturbCode(reference.code);
    else if (alteration === "name" && reference.name)
      presented.name = perturbName(reference.name);
    else if (alteration === "level" && reference.clearance)
      presented.clearance = perturbClearance(reference.clearance);
    else if (alteration === "validity" && reference.validity)
      presented.validity = perturbValidity(reference.validity);
    else if (alteration === "person")
      return credentialOf(
        IDENTITY_PROFILES[(profileIndex + 3) % IDENTITY_PROFILES.length],
      );
    // «synthetic» y «none» copian la referencia: la diferencia, si existe,
    // solo aparece en el registro de autorización.
    return presented;
  }

  private buildIdentity(
    room: Room,
    player: InternalPlayer,
    spec: {
      tier: IdentityTier;
      alteration: IdentityAlteration | "person" | "synthetic";
      source: "auto" | "player";
      context?: string;
      variant?: RegistryVariant;
      isEvent?: boolean;
    },
  ): InternalIdentity {
    const index =
      (player.slot - 1 + player.identityProfileSequence++) %
      IDENTITY_PROFILES.length;
    const profile = IDENTITY_PROFILES[index];
    const reference = credentialOf(profile);
    const label =
      spec.context ??
      NEUTRAL_CONTEXTS[(index + player.slot) % NEUTRAL_CONTEXTS.length];
    return {
      id: `${room.roundNonce}-identity-${room.identitySequence++}`,
      reference,
      presented: this.alteredCredential(reference, index, spec.alteration),
      expires: 0,
      context: { label, urgent: label.startsWith("URGENTE") },
      legit: spec.tier === "legit",
      shown: false,
      alteration: spec.alteration,
      tier: spec.tier,
      source: spec.source,
      isEvent: !!spec.isEvent,
      registry: registryEvidence(profile, spec.variant ?? "regular"),
      ...(spec.tier === "advanced" && spec.variant
        ? { finding: advancedFinding(profile, spec.variant) }
        : {}),
    };
  }

  private advancedVariant(room: Room, player: InternalPlayer): RegistryVariant {
    return ADVANCED_REGISTRY_VARIANTS[
      (player.slot + room.identitySequence) % ADVANCED_REGISTRY_VARIANTS.length
    ];
  }

  private newAutomaticIdentity(
    room: Room,
    player: InternalPlayer,
  ): InternalIdentity {
    if (!player.identityMix.length)
      player.identityMix = shuffle([true, true, false], this.randomFn);
    const legit = player.identityMix.shift()!;
    const stage = this.identityStage(room);
    if (legit) {
      // Una legítima con el mismo aviso urgente que las falsas por tramo:
      // la urgencia sola no demuestra nada y obliga a decidir cuándo verificar.
      const decoy = stage >= 1 && !player.identityDecoyStages.includes(stage);
      if (decoy) player.identityDecoyStages.push(stage);
      return this.buildIdentity(room, player, {
        tier: "legit",
        alteration: "none",
        source: "auto",
        ...(decoy ? { context: URGENT_CONTEXT, variant: "extraordinary" } : {}),
      });
    }
    const sequence = player.identityFalseSequence++;
    if (stage === 0)
      return this.buildIdentity(room, player, {
        tier: "obvious",
        alteration: sequence % 2 === 0 ? "avatar" : "person",
        source: "auto",
      });
    const subtle = ["code", "name", "level", "validity"] as const;
    return this.buildIdentity(room, player, {
      tier: "subtle",
      alteration: subtle[sequence % subtle.length],
      source: "auto",
      ...(sequence % 3 === 2 ? { context: URGENT_CONTEXT } : {}),
    });
  }

  private deliverIdentityEvent(room: Room, player: InternalPlayer): void {
    const card = this.buildIdentity(room, player, {
      tier: "advanced",
      alteration: "synthetic",
      source: "auto",
      context: EVENT_CONTEXT,
      variant: this.advancedVariant(room, player),
      isEvent: true,
    });
    if (player.pendingCards.length >= 2) {
      let replace = -1;
      for (let at = player.pendingCards.length - 1; at >= 0; at -= 1)
        if (
          player.pendingCards[at].source === "auto" &&
          !player.pendingCards[at].isEvent
        ) {
          replace = at;
          break;
        }
      // Nunca se sustituye una inyección propia: la tarjeta espera su turno.
      if (replace < 0) {
        player.identityEventOwed = card;
        return;
      }
      player.pendingCards.splice(replace, 1);
    }
    player.pendingCards.unshift(card);
  }

  private identityLimit(room: Room): number {
    const n = this.identityStage(room);
    return [10_000, 8_000, 6_000][n];
  }

  private activateIdentity(
    room: Room,
    player: InternalPlayer,
    card: InternalIdentity | null,
  ): void {
    if (
      !card ||
      card.shown ||
      player.blocked ||
      room.clock >= this.phaseDurationMs(room)
    )
      return;
    card.shown = true;
    card.expires = room.clock + this.identityLimit(room);
    if (player.role === "defender" && card.legit) player.legitShown += 1;
    this.armInactivity(room, player);
  }

  private ensureIdentity(room: Room, player: InternalPlayer): void {
    if (
      !this.activeForRound(room, player) ||
      player.blocked ||
      room.clock >= this.phaseDurationMs(room)
    )
      return;
    if (player.identityEventOwed && player.pendingCards.length < 2) {
      player.pendingCards.unshift(player.identityEventOwed);
      player.identityEventOwed = undefined;
    }
    if (!player.card && player.pendingCards.length) {
      player.card = player.pendingCards.shift()!;
      this.activateIdentity(room, player, player.card);
    }
    while (
      player.pendingCards.length < 2 &&
      room.clock < this.phaseDurationMs(room)
    )
      player.pendingCards.push(this.newAutomaticIdentity(room, player));
  }

  private advanceIdentity(room: Room): void {
    if (
      !room.identityEventDone &&
      room.clock >= Math.floor(this.phaseDurationMs(room) / 2)
    ) {
      room.identityEventDone = true;
      room.identityEventUntil = room.clock + IDENTITY_EVENT_VISIBLE_MS;
      for (const player of room.players)
        if (this.activeForRound(room, player) && !player.blocked)
          this.deliverIdentityEvent(room, player);
      this.log(
        room,
        "identity_event",
        undefined,
        "Se emitió el comunicado institucional simulado.",
      );
    }
    for (const player of room.players) {
      if (!this.activeForRound(room, player)) continue;
      if (player.card && room.clock >= player.card.expires)
        this.expireIdentity(room, player);
      this.ensureIdentity(room, player);
    }
    if (room.clock >= room.identityPublicPulseAt) {
      for (const player of room.players) {
        if (this.activeForRound(room, player)) {
          player.publicInfiltrations = player.identityIncoming;
          player.publicBlocked = player.publicInfiltrations >= 3;
        }
      }
      // La alerta se publica en el pulso, no en el instante de la decisión,
      // para no revelar qué terminal aceptó la credencial.
      if (room.identityAlertPending) {
        room.identityAlertPending = false;
        room.identityAlertUntil = room.clock + IDENTITY_ALERT_MS;
      }
      while (room.identityPublicPulseAt <= room.clock)
        room.identityPublicPulseAt += 10_000;
    }
    const target = this.sabotageTarget(room);
    if (
      target > 0 &&
      room.players.filter(
        (player) =>
          player.role === "defender" &&
          this.activeForRound(room, player) &&
          player.blocked,
      ).length >= target
    ) {
      this.finishRound(
        room,
        "impostor",
        this.identityMetric(room),
        `${target} dependencias fueron comprometidas.`,
      );
    }
  }

  private expireIdentity(room: Room, player: InternalPlayer): void {
    const card = player.card;
    if (!card) return;
    if (player.role === "defender" && card.legit) player.identityLost += 1;
    this.log(
      room,
      "identity_expire",
      player.department,
      `reference=${JSON.stringify(card.reference)} presented=${JSON.stringify(card.presented)} result=${card.legit ? "legitimate_lost" : "false_expired"} tier=${card.tier} source=${card.source}.`,
    );
    if (card.isEvent)
      player.identityEvent = {
        outcome: "expired",
        verified:
          card.verifyReadyAt !== undefined && card.verifyReadyAt <= room.clock,
        finding: card.finding,
      };
    player.card = null;
  }

  private decideIdentity(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "identity");
    if (phaseError) return this.fail(phaseError);
    if (player.blocked)
      return this.fail("La dependencia ya está comprometida en esta ronda.");
    if (!validText(action.cardId, 1, 80) || typeof action.accept !== "boolean")
      return this.fail("La decisión requiere una tarjeta y una respuesta.");
    const card = player.card;
    if (!card || card.id !== action.cardId)
      return this.fail("Esa tarjeta no está activa.");
    if (room.clock >= card.expires) {
      this.expireIdentity(room, player);
      return this.fail("La tarjeta ya expiró.");
    }
    if (card.verifyReadyAt !== undefined && room.clock < card.verifyReadyAt)
      return this.fail("La consulta al registro sigue en curso.");
    let result = card.legit ? "legitimate_rejected" : "false_rejected";
    if (!card.legit && action.accept) player.identityIncoming += 1;
    if (player.role === "defender") {
      if (card.legit) {
        if (action.accept) {
          player.legitAuthorized += 1;
          result = "legitimate_authorized";
        } else {
          player.identityLost += 1;
          result = "legitimate_blocked";
        }
      } else if (action.accept) {
        player.infiltrations += 1;
        result = "false_authorized_infiltration";
        if (card.tier === "advanced") room.identityAlertPending = true;
        if (player.infiltrations >= 3) {
          player.blocked = true;
          player.publicBlocked = true;
          player.card = null;
          player.pendingCards = [];
          player.identityEventOwed = undefined;
          this.log(
            room,
            "identity_blocked",
            player.department,
            "Una dependencia fue comprometida.",
          );
        }
      }
    }
    if (card.isEvent)
      player.identityEvent = {
        outcome: action.accept ? "allowed" : "blocked",
        verified: card.verifyReadyAt !== undefined,
        finding: card.finding,
      };
    player.card = null;
    if (!player.blocked) this.ensureIdentity(room, player);
    this.log(
      room,
      action.accept ? "identity_allow" : "identity_block",
      player.department,
      `reference=${JSON.stringify(card.reference)} presented=${JSON.stringify(card.presented)} decision=${action.accept ? "allow" : "block"} result=${result} source=${card.source} tier=${card.tier} legit=${card.legit} verified=${card.verifyReadyAt !== undefined} infiltrations=${player.infiltrations}.`,
    );
    const target = this.sabotageTarget(room);
    if (
      target > 0 &&
      room.players.filter(
        (candidate) =>
          candidate.role === "defender" &&
          this.activeForRound(room, candidate) &&
          candidate.blocked,
      ).length >= target
    ) {
      this.finishRound(
        room,
        "impostor",
        this.identityMetric(room),
        `${target} dependencias fueron comprometidas.`,
      );
    }
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private verifyIdentity(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "identity");
    if (phaseError) return this.fail(phaseError);
    if (player.blocked)
      return this.fail("La dependencia ya está comprometida en esta ronda.");
    if (!validText(action.cardId, 1, 80))
      return this.fail("La verificación requiere una tarjeta válida.");
    const card = player.card;
    if (!card || card.id !== action.cardId || !card.shown)
      return this.fail("Esa tarjeta no está activa.");
    if (room.clock >= card.expires) {
      this.expireIdentity(room, player);
      return this.fail("La tarjeta ya expiró.");
    }
    if (card.verifyReadyAt !== undefined)
      return this.fail(
        room.clock < card.verifyReadyAt
          ? "La consulta al registro sigue en curso."
          : "Esa tarjeta ya fue verificada.",
      );
    if (player.identityVerificationsRemaining <= 0)
      return this.fail("No quedan verificaciones disponibles.");
    if (
      Math.min(card.expires, this.phaseDurationMs(room)) - room.clock <
      IDENTITY_VERIFY_DELAY_MS + IDENTITY_VERIFY_MARGIN_MS
    )
      return this.fail("Quedan muy pocos segundos para consultar el registro.");
    player.identityVerificationsRemaining -= 1;
    card.verifyReadyAt = room.clock + IDENTITY_VERIFY_DELAY_MS;
    this.log(
      room,
      "identity_verify",
      player.department,
      `Se consultó el registro de la tarjeta ${card.id}; remaining=${player.identityVerificationsRemaining}.`,
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private placeInjectedIdentity(
    target: InternalPlayer,
    injected: InternalIdentity,
  ): boolean {
    if (target.pendingCards.length < 2) {
      target.pendingCards.push(injected);
      return true;
    }
    // Solo se sustituye una pendiente automática; nunca la tarjeta activa ni
    // el comunicado institucional.
    const replace = target.pendingCards.findIndex(
      (card) => card.source === "auto" && !card.isEvent,
    );
    if (replace < 0) return false;
    target.pendingCards[replace] = injected;
    return true;
  }

  private sendIdentity(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "identity");
    if (phaseError) return this.fail(phaseError);
    if (player.role !== "impostor")
      return this.fail(
        "Solo el flujo autorizado puede inyectar una credencial.",
      );
    if (room.clock < player.identityCooldownUntil)
      return this.fail("La inyección todavía está en enfriamiento.");
    const alteration = action.alteration ?? "none";
    if (!(IDENTITY_ALTERATIONS as readonly string[]).includes(alteration))
      return this.fail("La alteración no es válida.");
    const targets = room.players.filter(
      (candidate) =>
        candidate.role === "defender" &&
        this.activeForRound(room, candidate) &&
        !candidate.blocked,
    );
    const target =
      targets[Math.floor(randomUnit(this.randomFn) * targets.length)];
    if (!target)
      return this.fail("No hay una dependencia defensora disponible.");
    const injected = this.buildIdentity(room, target, {
      tier:
        alteration === "none"
          ? "legit"
          : alteration === "avatar" || alteration === "symbol"
            ? "obvious"
            : "subtle",
      alteration,
      source: "player",
    });
    if (!this.placeInjectedIdentity(target, injected))
      return this.fail("La cola de identidades está llena.");
    player.identityCooldownUntil = room.clock + IDENTITY_INJECT_COOLDOWN_MS;
    this.log(
      room,
      "identity_send",
      player.department,
      `origin=${player.department} destination=${target.department} alteration=${alteration} source=player.`,
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private solveIdentityChallenge(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "identity");
    if (phaseError) return this.fail(phaseError);
    const challenge = player.identityChallenge;
    if (player.role !== "impostor" || !challenge)
      return this.fail("Esta sesión no tiene un expediente que revisar.");
    if (challenge.solved)
      return this.fail("El expediente privado ya fue resuelto.");
    if (room.clock < challenge.retryAt)
      return this.fail("Espera unos segundos antes de reintentar.");
    if (
      typeof action.answer !== "string" ||
      !(DOSSIER_KEYS as readonly string[]).includes(action.answer)
    )
      return this.fail("Selecciona un dato del expediente.");
    if (action.answer !== challenge.answer) {
      challenge.retryAt = room.clock + IDENTITY_CHALLENGE_RETRY_MS;
      return this.fail(
        "Ese dato sí coincide con el registro. Revisa otra vez.",
      );
    }
    challenge.solved = true;
    challenge.advancedAvailable = true;
    this.log(
      room,
      "identity_challenge_solved",
      player.department,
      "El expediente privado desbloqueó una suplantación avanzada.",
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private sendAdvancedIdentity(room: Room, player: InternalPlayer): Ack {
    const phaseError = this.validatePhaseAction(room, "identity");
    if (phaseError) return this.fail(phaseError);
    const challenge = player.identityChallenge;
    if (player.role !== "impostor" || !challenge)
      return this.fail("Esta sesión no puede emitir una suplantación.");
    if (!challenge.solved || !challenge.advancedAvailable)
      return this.fail("Primero resuelve el expediente privado.");
    if (challenge.advancedUsed)
      return this.fail("La suplantación avanzada ya fue utilizada.");
    // El primer tercio es para que el equipo aprenda la mecánica.
    if (this.identityStage(room) < 1)
      return this.fail(
        "La suplantación avanzada se habilita en el ritmo ágil.",
      );
    if (room.clock < player.identityCooldownUntil)
      return this.fail("La inyección todavía está en enfriamiento.");
    const targets = room.players.filter(
      (candidate) =>
        candidate.role === "defender" &&
        this.activeForRound(room, candidate) &&
        !candidate.blocked &&
        (candidate.pendingCards.length < 2 ||
          candidate.pendingCards.some(
            (card) => card.source === "auto" && !card.isEvent,
          )),
    );
    const target =
      targets[Math.floor(randomUnit(this.randomFn) * targets.length)];
    if (!target)
      return this.fail("No hay una dependencia defensora disponible ahora.");
    const injected = this.buildIdentity(room, target, {
      tier: "advanced",
      alteration: "synthetic",
      source: "player",
      context: URGENT_CONTEXT,
      variant: this.advancedVariant(room, target),
    });
    this.placeInjectedIdentity(target, injected);
    challenge.advancedAvailable = false;
    challenge.advancedUsed = true;
    player.identityCooldownUntil = room.clock + IDENTITY_INJECT_COOLDOWN_MS;
    this.log(
      room,
      "identity_send_advanced",
      player.department,
      `origin=${player.department} destination=${target.department} tier=advanced source=player.`,
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private solveRecovery(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "recovery");
    if (phaseError) return this.fail(phaseError);
    if (player.role === "impostor")
      return this.fail("El reto del impostor usa su propia respuesta privada.");
    if (!player.fragment)
      return this.fail("No hay un fragmento asignado a esta sesión.");
    if (player.fragment.solved)
      return this.fail("Este fragmento ya fue resuelto.");
    if (
      player.fragment.verificationReadyAt !== undefined &&
      room.clock < player.fragment.verificationReadyAt
    )
      return this.fail("La verificación de clave todavía está en curso.");
    if (normalizeAnswer(action.answer) !== player.fragment.answer)
      return this.fail("La respuesta del fragmento no coincide.");
    player.fragment.solved = true;
    room.recoveryCompleted = room.players.filter(
      (candidate) => candidate.fragment?.solved,
    ).length;
    this.log(
      room,
      "recovery_solve",
      player.department,
      "Se resolvió un fragmento propio.",
    );
    if (room.recoveryCompleted >= room.recoveryTotal) this.finishRecovery(room);
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private solveRecoveryChallenge(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "recovery");
    if (phaseError) return this.fail(phaseError);
    if (player.role !== "impostor" || !player.recoveryChallenge)
      return this.fail("Esta sesión no tiene un reto de sabotaje.");
    if (player.recoveryChallenge.solved)
      return this.fail("El reto privado ya fue resuelto.");
    if (normalizeAnswer(action.answer) !== player.recoveryChallenge.answer)
      return this.fail("La respuesta del reto no coincide.");
    player.recoveryChallenge.solved = true;
    player.recoveryChallenge.sabotageAvailable = true;
    this.log(
      room,
      "recovery_challenge_solved",
      player.department,
      "El reto privado desbloqueó una oportunidad de sabotaje.",
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private sabotageRecovery(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    const phaseError = this.validatePhaseAction(room, "recovery");
    if (phaseError) return this.fail(phaseError);
    const challenge = player.recoveryChallenge;
    if (player.role !== "impostor" || !challenge)
      return this.fail("Esta sesión no puede alterar fragmentos.");
    if (!challenge.solved || !challenge.sabotageAvailable)
      return this.fail("Primero resuelve el reto privado.");
    if (challenge.sabotageUsed)
      return this.fail("La oportunidad de sabotaje ya fue utilizada.");
    if (!validText(action.target, 1, 40))
      return this.fail("Selecciona un servicio defensor pendiente.");
    const target = room.players.find(
      (candidate) =>
        candidate.department === action.target &&
        candidate.role === "defender" &&
        this.activeForRound(room, candidate),
    );
    if (!target?.fragment || target.fragment.solved)
      return this.fail("Ese fragmento ya no está disponible.");
    if (target.fragment.altered)
      return this.fail("Ese fragmento ya fue alterado.");

    target.fragment.shift = RECOVERY_SABOTAGE_SHIFT;
    target.fragment.cipher = cipherCesar(
      target.fragment.plaintext,
      RECOVERY_SABOTAGE_SHIFT,
    );
    target.fragment.altered = true;
    target.fragment.verificationUsed = false;
    target.fragment.verificationReadyAt = undefined;
    challenge.sabotageAvailable = false;
    challenge.sabotageUsed = true;
    room.recoveryAlertUntil = room.clock + RECOVERY_ALERT_MS;
    this.log(
      room,
      "recovery_sabotage",
      player.department,
      `Se alteró el cifrado pendiente de ${target.department} a César +${RECOVERY_SABOTAGE_SHIFT}.`,
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private verifyRecoveryKey(room: Room, player: InternalPlayer): Ack {
    const phaseError = this.validatePhaseAction(room, "recovery");
    if (phaseError) return this.fail(phaseError);
    if (player.role !== "defender" || !player.fragment)
      return this.fail("Esta sesión no tiene una clave que verificar.");
    if (player.fragment.solved)
      return this.fail("Este fragmento ya fue resuelto.");
    if (!player.fragment.altered)
      return this.fail("La clave de este fragmento no fue alterada.");
    if (player.fragment.verificationUsed)
      return this.fail("La verificación de clave ya fue utilizada.");
    player.fragment.verificationUsed = true;
    player.fragment.verificationReadyAt = room.clock + RECOVERY_VERIFY_DELAY_MS;
    this.log(
      room,
      "recovery_key_verify",
      player.department,
      "Comenzó la verificación privada de la clave alterada.",
    );
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private castVote(
    room: Room,
    player: InternalPlayer,
    action: GameAction,
  ): Ack {
    if (room.phase !== "voting" || !room.votesOpen)
      return this.fail("La votación todavía no está abierta.");
    if (!player.connected || !room.votingEligible.includes(player.token))
      return this.fail("Tu terminal no estaba conectada al abrir la votación.");
    if (player.vote) return this.fail("Esta sesión ya emitió su voto.");
    if (!validText(action.suspect, 1, 40) || !validText(action.reason, 3, 160))
      return this.fail(
        "El voto requiere sospechoso y un motivo de 3 a 160 caracteres.",
      );
    const target = room.players.find(
      (candidate) => candidate.department === action.suspect,
    );
    if (!target)
      return this.fail("El sospechoso no es una dependencia válida.");
    player.vote = { suspect: target.department, reason: action.reason.trim() };
    return { ok: true, snapshot: this.snapshotForPlayer(room, player) };
  }

  private finishRecovery(
    room: Room,
    timedOut = false,
    interrupted = false,
  ): void {
    if (room.roundFinished && room.phase === "recovery") return;
    room.recoveryCompleted = room.players.filter(
      (player) => player.fragment?.solved,
    ).length;
    room.recoveryDone = room.recoveryCompleted >= room.recoveryTotal;
    if (!room.recoveryDone && !timedOut) return;
    const winner: Winner = interrupted
      ? "inconclusive"
      : room.recoveryDone
        ? "defenders"
        : "impostor";
    room.results.push({
      phase: "recovery",
      winner,
      metric: Math.round(
        (100 * room.recoveryCompleted) / Math.max(1, room.recoveryTotal),
      ),
      description: interrupted
        ? "Recuperación interrumpida por docente: sin puntos."
        : room.recoveryDone
          ? "Todos los fragmentos fueron recuperados: equipo +1."
          : "Tiempo agotado con fragmentos pendientes: impostor +1.",
    });
    if (winner !== "inconclusive") room.scores[winner] += 1;
    room.running = false;
    room.paused = false;
    room.stage = "finished";
    room.countdownMs = 0;
    room.roundFinished = true;
    this.log(
      room,
      "recovery_finish",
      undefined,
      interrupted
        ? "La sesión docente interrumpió la recuperación; sin puntos."
        : room.recoveryDone
          ? "La recuperación terminó con todos los fragmentos."
          : "La recuperación terminó por tiempo; quedaron fragmentos pendientes.",
    );
    room.cityChapters = room.cityChapters.filter((c) => c.phase !== "recovery");
    room.cityChapters.push({
      phase: "recovery",
      outcome: room.recoveryDone ? "restored" : "interrupted",
      services: [],
      recoveryProgress:
        room.recoveryCompleted / Math.max(1, room.recoveryTotal),
    });
  }

  private finishRoundByTimeout(room: Room): void {
    if (room.roundFinished) return;
    if (room.phase === "mail") {
      const metric = this.mailMetric(room);
      this.finishRound(
        room,
        metric >= room.settings.mailAccuracy ? "defenders" : "inconclusive",
        metric,
        metric >= room.settings.mailAccuracy
          ? "La precisión defensora alcanzó el umbral."
          : "La precisión de correo quedó por debajo del umbral.",
      );
    } else if (room.phase === "ddos") {
      const fallen = room.players.filter(
        (player) =>
          player.role === "defender" &&
          this.activeForRound(room, player) &&
          player.blocked,
      ).length;
      const metric = this.ddosMetric(room);
      const target = this.sabotageTarget(room);
      this.finishRound(
        room,
        fallen >= target && target > 0
          ? "impostor"
          : metric >= room.settings.blueAccuracy
            ? "defenders"
            : "inconclusive",
        metric,
        fallen >= target && target > 0
          ? `${target} dependencias fueron denegadas.`
          : metric >= room.settings.blueAccuracy
            ? "La atención de peticiones azules alcanzó el umbral."
            : "La atención de peticiones azules quedó por debajo del umbral.",
      );
    } else if (room.phase === "identity") {
      const metric = this.identityMetric(room);
      const compromised = room.players.filter(
        (player) =>
          player.role === "defender" &&
          this.activeForRound(room, player) &&
          player.blocked,
      ).length;
      const target = this.sabotageTarget(room);
      this.finishRound(
        room,
        compromised >= target && target > 0
          ? "impostor"
          : metric >= room.settings.identityAccuracy
            ? "defenders"
            : "inconclusive",
        metric,
        compromised >= target && target > 0
          ? `${target} dependencias fueron comprometidas.`
          : metric >= room.settings.identityAccuracy
            ? "La autorización legítima alcanzó el umbral."
            : "La autorización legítima quedó por debajo del umbral.",
      );
    }
  }

  private finishRound(
    room: Room,
    winner: Winner,
    metric: number,
    description: string,
  ): void {
    if (room.roundFinished || !PHASE_ORDER.includes(room.phase)) return;
    room.running = false;
    room.paused = false;
    room.stage = "finished";
    room.countdownMs = 0;
    room.roundFinished = true;
    for (const player of room.players) {
      if (room.phase === "mail")
        player.publicMailRisk = Math.min(3, player.mailMistakes);
      if (room.phase === "identity") {
        player.publicInfiltrations = player.identityIncoming;
        const card = player.card;
        if (card?.isEvent && card.shown && !player.identityEvent)
          player.identityEvent = {
            outcome: "unanswered",
            verified:
              card.verifyReadyAt !== undefined &&
              card.verifyReadyAt <= room.clock,
            finding: card.finding,
          };
      }
    }
    room.results.push({ phase: room.phase, winner, metric, description });
    if (
      room.phase === "mail" ||
      room.phase === "ddos" ||
      room.phase === "identity"
    ) {
      const services = this.publicSnapshot(room).departments.map(
        ({ id, status }) => ({ id, status }),
      );
      room.cityChapters = room.cityChapters.filter(
        (c) => c.phase !== room.phase,
      );
      room.cityChapters.push({
        phase: room.phase,
        outcome:
          winner === "defenders"
            ? "contained"
            : winner === "impostor"
              ? "affected"
              : "interrupted",
        services,
      });
    }
    if (winner === "defenders") room.scores.defenders += 1;
    if (winner === "impostor") room.scores.impostor += 1;
    this.log(room, "round_finish", undefined, description);
  }

  private mailMetric(room: Room): number {
    const defenders = room.players.filter(
      (player) => player.role === "defender",
    );
    const denominator = defenders.reduce(
      (sum, player) => sum + player.mailReceived,
      0,
    );
    const correct = defenders.reduce(
      (sum, player) => sum + player.mailCorrect,
      0,
    );
    return denominator ? Math.round((correct / denominator) * 10000) / 100 : 0;
  }
  private ddosMetric(room: Room): number {
    const defenders = room.players.filter(
      (player) => player.role === "defender",
    );
    const emitted = defenders.reduce(
      (sum, player) => sum + player.blueEmitted + player.inactivityPenalties,
      0,
    );
    const success = defenders.reduce(
      (sum, player) => sum + player.blueSuccess,
      0,
    );
    return emitted ? Math.round((success / emitted) * 10000) / 100 : 0;
  }
  private identityMetric(room: Room): number {
    const defenders = room.players.filter(
      (player) => player.role === "defender",
    );
    const shown = defenders.reduce(
      (sum, player) => sum + player.legitShown + player.inactivityPenalties,
      0,
    );
    const authorized = defenders.reduce(
      (sum, player) => sum + player.legitAuthorized,
      0,
    );
    return shown ? Math.round((authorized / shown) * 10000) / 100 : 0;
  }

  private log(
    room: Room,
    type: string,
    department: string | undefined,
    detail: string,
  ): void {
    room.logs.push({
      at: room.clock,
      phase: room.phase,
      type,
      ...(department ? { department } : {}),
      detail,
    });
    if (room.logs.length > 2000) room.logs.splice(0, room.logs.length - 2000);
  }

  private templatesFor(player: InternalPlayer): Template[] {
    const templates =
      player.role === "impostor" ? ALL_TEMPLATES : OFFICIAL_TEMPLATES;
    return templates.map(
      ({
        id,
        senderName,
        sender,
        subject,
        preview,
        context,
        kind,
        tactic,
      }) => ({
        id,
        senderName,
        sender,
        subject,
        preview,
        ...(context ? { context } : {}),
        kind,
        tactic,
      }),
    );
  }

  private coverageFor(player: InternalPlayer): {
    coverRole: string;
    coverTask: string;
  } {
    const department = DEPARTMENTS.find(
      (item) => item.id === player.department,
    );
    const title = department?.name ?? player.department;
    return {
      coverRole: `Responsable de ${title}`,
      coverTask: department?.description ?? "Mantén operativo tu servicio.",
    };
  }

  private snapshotForPlayer(room: Room, player: InternalPlayer): Snapshot {
    return {
      public: this.publicSnapshot(room),
      player: this.playerSnapshot(room, player),
    };
  }

  private publicSnapshot(room: Room): PublicState {
    const duration =
      room.phase === "lobby" ||
      room.phase === "voting" ||
      room.phase === "revealed"
        ? 0
        : this.phaseDurationMs(room) / 1000;
    const elapsed =
      room.phase === "lobby" ||
      room.phase === "voting" ||
      room.phase === "revealed"
        ? 0
        : room.clock;
    const visibleDepartments = room.assigned
      ? room.players
          .slice()
          .sort((a, b) => a.slot - b.slot)
          .map(
            (player) =>
              DEPARTMENTS.find(
                (department) => department.id === player.department,
              )!,
          )
      : DEPARTMENTS.slice(0, room.capacity);
    const departments: DepartmentState[] = visibleDepartments.map(
      (department) => {
        const player = room.players.find(
          (candidate) => candidate.department === department.id,
        );
        let status: DepartmentState["status"] = "operational";
        if (player && room.assigned) {
          if (room.phase === "ddos") {
            status =
              player.publicBlocked ||
              player.saturation >= room.settings.saturationLimit
                ? "down"
                : player.saturation > room.settings.saturationLimit * 0.4
                  ? "warning"
                  : "operational";
          } else if (room.phase === "identity") {
            status =
              player.publicInfiltrations >= 3
                ? "down"
                : player.publicInfiltrations > 0
                  ? "warning"
                  : "operational";
          } else if (room.phase === "mail") {
            status =
              player.publicMailRisk >= 3
                ? "down"
                : player.publicMailRisk > 0
                  ? "warning"
                  : "operational";
          } else if (player.publicBlocked) status = "down";
        }
        return {
          id: department.id,
          name: department.name,
          status,
          connected: !!player?.connected,
          occupied: !!player,
          signal:
            status === "down"
              ? "Servicio fuera de línea"
              : status === "warning"
                ? "Señal bajo presión"
                : "Señal estable",
        };
      },
    );
    const connectedCount = room.players.filter(
      (player) => player.connected,
    ).length;
    const down = departments.filter(
      (department) => department.status === "down",
    ).length;
    const health: PublicState["health"] =
      down >= Math.max(1, room.assigned ? this.sabotageTarget(room) : 3)
        ? "critical"
        : departments.some((department) => department.status === "warning")
          ? "attack"
          : "normal";
    // The projector never receives internal logs or named individual ballots.
    const reveal =
      room.phase === "revealed" && room.revealElapsed >= 3 && room.reveal
        ? { ...clone(room.reveal), votes: [], logs: [] }
        : undefined;
    const briefingRemaining =
      room.autoStart && room.stage === "briefing"
        ? Math.ceil(room.autoBriefingRemainingMs / 1000)
        : undefined;
    return {
      code: room.code,
      capacity: room.capacity,
      capacityLocked: room.assigned && room.phase !== "revealed",
      phase: room.phase,
      running: room.running,
      paused: room.paused,
      stage: room.stage,
      countdown:
        room.stage === "countdown" ? Math.ceil(room.countdownMs / 1000) : 0,
      roundId: room.roundNonce,
      sabotageTarget: this.sabotageTarget(room),
      assigned: room.assigned,
      ...(room.autoStart ? { autoStart: true } : {}),
      ...(briefingRemaining === undefined ? {} : { briefingRemaining }),
      remaining: Math.max(0, duration - elapsed / 1000),
      duration,
      clock: elapsed,
      settings: {
        mailSeconds: room.settings.mailSeconds,
        ddosSeconds: room.settings.ddosSeconds,
        identitySeconds: room.settings.identitySeconds,
        recoverySeconds: room.settings.recoverySeconds,
        mailAccuracy: room.settings.mailAccuracy,
        blueAccuracy: room.settings.blueAccuracy,
        identityAccuracy: room.settings.identityAccuracy,
        saturationLimit: room.settings.saturationLimit,
      },
      departments,
      scores: clone(room.scores),
      results: clone(room.results),
      health,
      city: cityNarrative({
        departments,
        chapters: room.cityChapters,
        phase: room.phase,
        stage: room.stage,
        recovery: {
          completed: room.recoveryCompleted,
          total: room.recoveryTotal,
        },
      }),
      playersCount: room.players.length,
      connectedCount,
      recovery: {
        completed: room.recoveryCompleted,
        total: room.recoveryTotal,
        done: room.recoveryDone,
        ...(room.phase === "recovery" &&
        room.stage === "playing" &&
        room.clock < room.recoveryAlertUntil
          ? { integrityAlert: true }
          : {}),
      },
      ...(room.phase === "identity" && room.stage === "playing"
        ? this.identityPublic(room)
        : {}),
      ...(room.phase === "ddos" &&
      room.stage === "playing" &&
      room.clock < room.ddosWaveAlertUntil
        ? { ddos: { waveAlert: true } }
        : {}),
      votesCount: room.players.filter((player) => !!player.vote).length,
      ...(room.phase === "voting" || room.phase === "revealed"
        ? {
            judgment: {
              stage:
                room.phase === "revealed"
                  ? ("reveal" as const)
                  : room.judgmentDebate
                    ? ("debate" as const)
                    : ("voting" as const),
              votesExpected: room.votingEligible.length,
              elapsed: room.revealElapsed,
              ...(room.phase === "revealed"
                ? { step: revealStep(room.revealElapsed) }
                : {}),
            },
          }
        : {}),
      ...(reveal ? { reveal } : {}),
    };
  }

  private playerSnapshot(room: Room, player: InternalPlayer): PlayerState {
    const coverage = this.coverageFor(player);
    const waitingForNextRound = player.waitUntilNextRound === room.roundNonce;
    return {
      id: player.id,
      ...(room.phase === "voting"
        ? {
            voteEligible:
              room.votesOpen && room.votingEligible.includes(player.token),
          }
        : {}),
      slot: player.slot,
      name: player.name,
      department: player.department,
      node: player.node,
      role: player.role,
      ...coverage,
      inactivityPenalties: player.inactivityPenalties,
      ...(waitingForNextRound ? { waitingForNextRound: true } : {}),
      blocked: player.blocked,
      mail: waitingForNextRound
        ? []
        : player.mail.map(
            ({
              id,
              senderName,
              sender,
              subject,
              preview,
              context,
              inspected,
              inspectionDetails,
            }) => ({
              id,
              senderName,
              sender,
              subject,
              preview,
              ...(context ? { context } : {}),
              ...(inspected ? { inspection: clone(inspectionDetails) } : {}),
            }),
          ),
      templates: waitingForNextRound ? [] : this.templatesFor(player),
      mailCooldown: waitingForNextRound
        ? 0
        : Math.max(0, (player.mailCooldownUntil - room.clock) / 1000),
      mailSendCooldown: this.mailSendCooldownMs(room) / 1000,
      mailInspectionsRemaining: waitingForNextRound
        ? 0
        : player.mailInspectionsRemaining,
      traffic: waitingForNextRound
        ? []
        : player.traffic.map(({ id, kind, angle, born, arrives }) => ({
            id,
            kind,
            angle,
            born,
            arrives,
          })),
      saturation: player.saturation,
      ...(room.phase === "ddos" &&
      !waitingForNextRound &&
      player.role === "defender"
        ? {
            ddosDefense: {
              available: !player.ddosShieldUsed && !player.blocked,
              remaining: Math.max(
                0,
                (player.ddosShieldUntil - room.clock) / 1000,
              ),
              absorbed: player.ddosAbsorbed,
              feedbackRemaining: Math.max(
                0,
                (player.ddosAbsorbedUntil - room.clock) / 1000,
              ),
              waveRemaining: Math.max(
                0,
                (player.ddosWaveUntil - room.clock) / 1000,
              ),
            },
          }
        : {}),
      ...(room.phase === "ddos" &&
      !waitingForNextRound &&
      player.role === "impostor" &&
      player.ddosChallenge
        ? {
            ddosChallenge: {
              patterns: clone(player.ddosChallenge.patterns),
              solved: player.ddosChallenge.solved,
              waveAvailable:
                player.ddosChallenge.solved && !player.ddosChallenge.waveUsed,
              waveUsed: player.ddosChallenge.waveUsed,
              retryIn: Math.max(
                0,
                (player.ddosChallenge.retryAt - room.clock) / 1000,
              ),
              targets: room.players
                .filter(
                  (candidate) =>
                    candidate.role === "defender" &&
                    this.activeForRound(room, candidate) &&
                    !candidate.blocked,
                )
                .map((candidate) => ({
                  department: candidate.department,
                  name:
                    DEPARTMENTS.find(
                      (department) => department.id === candidate.department,
                    )?.name ?? candidate.department,
                })),
            },
          }
        : {}),
      card: waitingForNextRound
        ? null
        : player.card
          ? this.safeIdentity(room, player.card)
          : null,
      pendingCards: waitingForNextRound ? 0 : player.pendingCards.length,
      identityCooldown: waitingForNextRound
        ? 0
        : Math.max(0, (player.identityCooldownUntil - room.clock) / 1000),
      identityVerificationsRemaining: waitingForNextRound
        ? 0
        : player.identityVerificationsRemaining,
      ...(room.phase === "identity" && room.roundFinished
        ? { identityDebrief: this.identityDebrief(player) }
        : {}),
      ...(player.identityChallenge
        ? {
            identityChallenge: {
              record: clone(player.identityChallenge.record),
              draft: clone(player.identityChallenge.draft),
              solved: player.identityChallenge.solved,
              advancedAvailable: player.identityChallenge.advancedAvailable,
              advancedUsed: player.identityChallenge.advancedUsed,
              retryIn: Math.max(
                0,
                (player.identityChallenge.retryAt - room.clock) / 1000,
              ),
            },
          }
        : {}),
      ...(player.fragment
        ? {
            fragment: {
              order: player.fragment.order,
              cipher: player.fragment.cipher,
              solved: player.fragment.solved,
              ...(!player.fragment.altered
                ? { shift: player.fragment.shift }
                : {}),
              ...(player.fragment.altered &&
              (!player.fragment.verificationUsed ||
                player.fragment.verificationReadyAt === undefined ||
                player.fragment.verificationReadyAt > room.clock)
                ? { candidateShifts: [...RECOVERY_SHIFT_CANDIDATES] }
                : {}),
              altered: player.fragment.altered,
              verificationUsed: player.fragment.verificationUsed,
              verificationRemaining:
                player.fragment.verificationReadyAt === undefined
                  ? 0
                  : Math.max(
                      0,
                      (player.fragment.verificationReadyAt - room.clock) / 1000,
                    ),
              ...(player.fragment.verificationUsed &&
              player.fragment.verificationReadyAt !== undefined &&
              player.fragment.verificationReadyAt <= room.clock
                ? { verifiedShift: player.fragment.shift }
                : {}),
            },
          }
        : {}),
      ...(player.recoveryChallenge
        ? {
            recoveryChallenge: {
              cipher: player.recoveryChallenge.cipher,
              hint: player.recoveryChallenge.hint,
              shift: player.recoveryChallenge.shift,
              solved: player.recoveryChallenge.solved,
              sabotageAvailable: player.recoveryChallenge.sabotageAvailable,
              sabotageUsed: player.recoveryChallenge.sabotageUsed,
              targets: room.players
                .filter(
                  (candidate) =>
                    candidate.role === "defender" &&
                    this.activeForRound(room, candidate) &&
                    candidate.fragment &&
                    !candidate.fragment.solved,
                )
                .map((candidate) => ({
                  department: candidate.department,
                  name:
                    DEPARTMENTS.find(
                      (department) => department.id === candidate.department,
                    )?.name ?? candidate.department,
                })),
            },
          }
        : {}),
      ...(player.vote ? { vote: clone(player.vote) } : {}),
    };
  }

  private identityDebrief(player: InternalPlayer): IdentityDebrief {
    const seen = player.identityEvent;
    if (!seen) return { outcome: "unseen", verified: false };
    return {
      outcome: seen.outcome,
      verified: seen.verified,
      ...(seen.finding ? { finding: seen.finding } : {}),
    };
  }

  private safeIdentity(room: Room, card: InternalIdentity): IdentityCard {
    const ready =
      card.verifyReadyAt !== undefined && room.clock >= card.verifyReadyAt;
    return {
      id: card.id,
      reference: clone(card.reference),
      presented: clone(card.presented),
      expires: card.expires,
      ...(card.context ? { context: { ...card.context } } : {}),
      ...(card.verifyReadyAt === undefined
        ? {}
        : {
            verification: ready
              ? {
                  pending: false,
                  remaining: 0,
                  heading: card.registry.heading,
                  evidence: clone(card.registry.evidence),
                }
              : {
                  pending: true,
                  remaining: (card.verifyReadyAt - room.clock) / 1000,
                },
          }),
    };
  }

  private identityPublic(room: Room): Pick<PublicState, "identity"> {
    const event =
      room.identityEventDone && room.clock < room.identityEventUntil
        ? {
            id: IDENTITY_EVENT.id,
            speaker: IDENTITY_EVENT.speaker,
            transcript: IDENTITY_EVENT.transcript,
            remaining: (room.identityEventUntil - room.clock) / 1000,
          }
        : undefined;
    const alert = room.clock < room.identityAlertUntil;
    if (!event && !alert) return {};
    return {
      identity: { ...(event ? { event } : {}), ...(alert ? { alert } : {}) },
    };
  }

  private adminSnapshot(room: Room): AdminState {
    return {
      ...(room.phase === "revealed" && room.revealElapsed >= 3 && room.reveal
        ? {
            closingAudit: {
              votes: clone(room.reveal.votes),
              logs: clone(room.reveal.logs),
            },
          }
        : {}),
      invites: room.invites
        .filter((invite) => invite.slot <= room.capacity)
        .map(({ slot, invite, department }) => ({
          slot,
          invite,
          department,
        })),
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        department: player.department,
        node: player.node,
        connected: player.connected,
        inactivityPenalties: player.inactivityPenalties,
        ...(player.waitUntilNextRound === room.roundNonce
          ? { waitingForNextRound: true }
          : {}),
        voted: !!player.vote,
      })),
    };
  }
}

export { OFFICIAL_TEMPLATES, IMPOSTOR_TEMPLATES };
