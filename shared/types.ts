export const DEPARTMENTS = [
  {
    id: "agua",
    name: "Agua",
    short: "AGUA",
    description: "Red de abastecimiento",
    infrastructure: "Torre de agua, depósitos y planta de tratamiento",
    responsibility:
      "Cuidar la continuidad del abastecimiento de agua para hogares y servicios.",
    potentialImpact:
      "Una interrupción podría dificultar el abastecimiento y las actividades cotidianas.",
    icon: "Droplets",
  },
  {
    id: "energia",
    name: "Energía",
    short: "ENERGÍA",
    description: "Suministro eléctrico",
    infrastructure:
      "Minitorres eléctricas, tendido, transformadores y paneles solares",
    responsibility:
      "Proteger el suministro eléctrico que sostiene la actividad de la ciudad.",
    potentialImpact:
      "Una interrupción podría detener equipos y operaciones de otros servicios.",
    icon: "Zap",
  },
  {
    id: "movilidad",
    name: "Movilidad",
    short: "MOVILIDAD",
    description: "Tránsito y transporte",
    infrastructure: "Terminal urbana, autobuses y circulación vial",
    responsibility:
      "Mantener la continuidad del tránsito y el transporte de personas.",
    potentialImpact:
      "Una interrupción podría dificultar traslados y coordinación en las calles.",
    icon: "Bus",
  },
  {
    id: "comunicaciones",
    name: "Comunicaciones",
    short: "COMUNICACIONES",
    description: "Conectividad de la ciudad",
    infrastructure:
      "Antena de telecomunicaciones, parabólicas y centro de datos",
    responsibility:
      "Proteger la conectividad que permite comunicar y coordinar los servicios.",
    potentialImpact:
      "Una interrupción podría retrasar comunicaciones y la coordinación de respuestas.",
    icon: "Radio",
  },
  {
    id: "turismo",
    name: "Servicios turísticos",
    short: "TURISMO",
    description: "Atención a visitantes",
    infrastructure: "Hotel, piscina, playa y servicios turísticos",
    responsibility:
      "Mantener disponibles los servicios de información y atención a visitantes.",
    potentialImpact:
      "Una interrupción podría dificultar la orientación y la atención a visitantes.",
    icon: "Palmtree",
  },
  {
    id: "municipal",
    name: "Operación municipal",
    short: "MUNICIPAL",
    description: "Servicios ciudadanos",
    infrastructure: "Palacio municipal, plaza y fuente pública",
    responsibility:
      "Cuidar la continuidad de los trámites y servicios ciudadanos.",
    potentialImpact:
      "Una interrupción podría retrasar la atención y las gestiones de la comunidad.",
    icon: "Landmark",
  },
] as const;
export const PHASES = [
  "lobby",
  "mail",
  "ddos",
  "identity",
  "recovery",
  "voting",
  "revealed",
] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABELS: Record<Phase, string> = {
  lobby: "Preparación",
  mail: "Filtrado de correos",
  ddos: "Defensa ante saturación",
  identity: "Control de identidades",
  recovery: "Protocolo de recuperación",
  voting: "Votación privada",
  revealed: "Revelación final",
};
export const NEXT_PHASE_LABELS: Partial<Record<Phase, string>> = {
  mail: PHASE_LABELS.ddos,
  ddos: PHASE_LABELS.identity,
  identity: PHASE_LABELS.recovery,
};
export type Role = "defender" | "impostor";
export type Winner = "defenders" | "impostor" | "inconclusive";
export type Capacity = 3 | 4 | 5 | 6;
export type ExperienceStage =
  | "waiting"
  | "briefing"
  | "countdown"
  | "playing"
  | "finished";
export interface Settings {
  mailSeconds: number;
  ddosSeconds: number;
  identitySeconds: number;
  recoverySeconds: number;
  mailAccuracy: number;
  blueAccuracy: number;
  identityAccuracy: number;
  saturationLimit: number;
}
export const DEFAULT_SETTINGS: Settings = {
  mailSeconds: 150,
  ddosSeconds: 90,
  identitySeconds: 120,
  recoverySeconds: 120,
  mailAccuracy: 80,
  blueAccuracy: 70,
  identityAccuracy: 70,
  saturationLimit: 10,
};
export interface DepartmentState {
  id: string;
  name: string;
  status: "operational" | "warning" | "down";
  connected: boolean;
  occupied: boolean;
  signal?: string;
}
export interface RoundResult {
  phase: Phase;
  winner: Winner;
  metric: number;
  description: string;
}
export type CityMission = "mail" | "ddos" | "identity" | "recovery";
export interface CityChapter {
  phase: CityMission;
  outcome: "contained" | "affected" | "interrupted" | "restored";
  services: { id: string; status: DepartmentState["status"] }[];
  recoveryProgress?: number;
}
export interface CityNarrative {
  stability: number;
  status: "normal" | "risk" | "critical" | "recovering";
  services: {
    id: string;
    memory: "none" | "scarred" | "recovered";
    intensity: number;
  }[];
  chapters: CityChapter[];
  message: string;
}
export interface LogEntry {
  at: number;
  phase: Phase;
  type: string;
  department?: string;
  detail: string;
}
export interface PublicState {
  judgment?: {
    stage: "debate" | "voting" | "reveal";
    votesExpected: number;
    elapsed: number;
    step?: "truth" | "identity" | "result" | "learning";
  };
  code: string;
  capacity: number;
  capacityLocked?: boolean;
  phase: Phase;
  running: boolean;
  paused: boolean;
  stage: ExperienceStage;
  countdown: number;
  roundId: string;
  sabotageTarget: number;
  assigned: boolean;
  autoStart?: boolean;
  briefingRemaining?: number;
  remaining: number;
  duration: number;
  clock: number;
  settings: Settings;
  departments: DepartmentState[];
  scores: { defenders: number; impostor: number };
  results: RoundResult[];
  health: "normal" | "attack" | "critical";
  city?: CityNarrative;
  ddos?: { waveAlert: boolean };
  playersCount: number;
  connectedCount: number;
  recovery: {
    completed: number;
    total: number;
    done: boolean;
    integrityAlert?: boolean;
  };
  // Solo existe mientras hay un comunicado en curso o una alerta anónima.
  identity?: {
    event?: IdentityEvent;
    alert?: boolean;
  };
  votesCount: number;
  reveal?: {
    impostorDepartment: string;
    impostorDepartmentId?: string;
    impostorName: string;
    winner: Winner | "tie";
    votes: { voter: string; suspect: string; reason: string }[];
    logs: LogEntry[];
    bonus?: {
      winner: "defenders" | "impostor";
      correct: number;
      eligible: number;
      required: number;
      abstentions: number;
    };
    reflection?: {
      success: string;
      vulnerability: string;
      recommendation: string;
    };
  };
}
export interface MailCard {
  id: string;
  senderName: string;
  sender: string;
  subject: string;
  preview: string;
  context?: string;
  inspection?: {
    heading: string;
    evidence: string[];
  };
}
export interface Template {
  id: string;
  senderName: string;
  sender: string;
  subject: string;
  preview: string;
  context?: string;
  kind: "official" | "attack";
  tactic: "official" | "urgency" | "authority" | "impersonation";
}
export interface TrafficPoint {
  id: string;
  kind: "blue" | "red";
  angle: number;
  born: number;
  arrives: number;
}
export interface DdosPattern {
  id: string;
  label: string;
  requests: number[];
  clients: number;
}
export interface DdosDefenseState {
  available: boolean;
  remaining: number;
  absorbed: number;
  feedbackRemaining: number;
  waveRemaining: number;
}
export interface DdosChallengeState {
  patterns: DdosPattern[];
  solved: boolean;
  waveAvailable: boolean;
  waveUsed: boolean;
  retryIn: number;
  targets: { department: string; name: string }[];
}
export type Clearance = "N1" | "N2" | "N3";
export interface Credential {
  avatar: number;
  code: string;
  symbol: number;
  // Datos de la identidad ficticia. Son opcionales para que una credencial
  // mínima (foto, folio e icono) siga siendo válida en la interfaz.
  name?: string;
  employeeId?: string;
  service?: string;
  clearance?: Clearance;
  validity?: string;
}
export const IDENTITY_ALTERATIONS = [
  "none",
  "avatar",
  "code",
  "symbol",
  "name",
  "level",
  "validity",
] as const;
export type IdentityAlteration = (typeof IDENTITY_ALTERATIONS)[number];
export interface IdentityRegistryLine {
  label: string;
  value: string;
}
export interface IdentityVerification {
  pending: boolean;
  remaining: number;
  heading?: string;
  evidence?: IdentityRegistryLine[];
}
export interface IdentityCard {
  id: string;
  reference: Credential;
  presented: Credential;
  expires: number;
  context?: { label: string; urgent: boolean };
  verification?: IdentityVerification;
}
export type DossierKey = "name" | "code" | "level" | "validity" | "service";
export interface IdentityDossierField {
  key: DossierKey;
  label: string;
  value: string;
}
export interface IdentityChallengeState {
  record: IdentityDossierField[];
  draft: IdentityDossierField[];
  solved: boolean;
  advancedAvailable: boolean;
  advancedUsed: boolean;
  retryIn: number;
}
export interface IdentityDebrief {
  outcome: "allowed" | "blocked" | "expired" | "unanswered" | "unseen";
  verified: boolean;
  finding?: string;
}
export interface IdentityEvent {
  id: string;
  speaker: string;
  transcript: string;
  remaining: number;
}
export interface EducationalCase {
  decision: string;
  evidence: string;
  consequence: string;
  learning: string;
}
export type EducationalDebrief = { roundId: string; phase: CityMission } & (
  | ({ kind: "observed" } & EducationalCase)
  | { kind: "general"; learning: string }
);
export interface PlayerState {
  id: string;
  slot: number;
  name: string;
  department: string;
  node: string;
  role?: Role;
  coverRole?: string;
  coverTask?: string;
  inactivityPenalties?: number;
  blocked: boolean;
  mail: MailCard[];
  templates: Template[];
  mailCooldown: number;
  mailSendCooldown: number;
  mailInspectionsRemaining: number;
  traffic: TrafficPoint[];
  saturation: number;
  ddosDefense?: DdosDefenseState;
  ddosChallenge?: DdosChallengeState;
  card: IdentityCard | null;
  pendingCards: number;
  identityCooldown: number;
  identityVerificationsRemaining: number;
  identityChallenge?: IdentityChallengeState;
  // Solo existe cuando la misión terminó: nunca revela nada durante la ronda.
  identityDebrief?: IdentityDebrief;
  // Own visible evidence only, published at the end of this technical round.
  educationalDebrief?: EducationalDebrief;
  fragment?: {
    order: number;
    cipher: string;
    solved: boolean;
    shift?: number;
    candidateShifts?: number[];
    altered: boolean;
    verificationUsed: boolean;
    verificationRemaining: number;
    verifiedShift?: number;
  };
  recoveryChallenge?: {
    cipher: string;
    hint: string;
    shift: number;
    solved: boolean;
    sabotageAvailable: boolean;
    sabotageUsed: boolean;
    targets: { department: string; name: string }[];
  };
  vote?: { suspect: string; reason: string };
  voteEligible?: boolean;
  waitingForNextRound?: boolean;
}
export interface AdminState {
  closingAudit?: {
    votes: { voter: string; suspect: string; reason: string }[];
    logs: LogEntry[];
  };
  invites: { slot: number; invite: string; department: string }[];
  players: {
    id: string;
    name: string;
    department: string;
    node: string;
    connected: boolean;
    inactivityPenalties?: number;
    waitingForNextRound?: boolean;
    voted?: boolean;
  }[];
}
export interface Snapshot {
  public: PublicState;
  player?: PlayerState;
  admin?: AdminState;
}
export interface Session {
  code: string;
  token: string;
  kind: "admin" | "player";
  slot?: number;
}
export interface Ack {
  ok: boolean;
  error?: string;
  errorCode?: "session_revoked";
  session?: Session;
  snapshot?: Snapshot;
}
export type AdminCommand =
  | "capacity"
  | "assign"
  | "auto-start"
  | "manual-start"
  | "start"
  | "pause"
  | "resume"
  | "restart"
  | "reset-all"
  | "stop"
  | "next"
  | "voting"
  | "judgment"
  | "reveal"
  | "settings";
export interface GameAction {
  eventId: string;
  type:
    | "mail:classify"
    | "mail:inspect"
    | "mail:send"
    | "ddos:tap"
    | "ddos:shield"
    | "ddos:challenge-solve"
    | "ddos:wave"
    | "identity:decide"
    | "identity:send"
    | "identity:verify"
    | "identity:challenge-solve"
    | "identity:send-advanced"
    | "recovery:solve"
    | "recovery:challenge-solve"
    | "recovery:sabotage"
    | "recovery:verify"
    | "vote";
  cardId?: string;
  pointId?: string;
  accept?: boolean;
  templateId?: string;
  target?: string;
  alteration?: IdentityAlteration;
  answer?: string;
  suspect?: string;
  reason?: string;
}
