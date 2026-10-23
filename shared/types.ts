export const DEPARTMENTS = [
  {
    id: "agua",
    name: "Agua",
    short: "AGUA",
    description: "Red de abastecimiento",
    icon: "Droplets",
  },
  {
    id: "energia",
    name: "Energía",
    short: "ENERGÍA",
    description: "Suministro eléctrico",
    icon: "Zap",
  },
  {
    id: "movilidad",
    name: "Movilidad",
    short: "MOVILIDAD",
    description: "Tránsito y transporte",
    icon: "Bus",
  },
  {
    id: "comunicaciones",
    name: "Comunicaciones",
    short: "COMUNICACIONES",
    description: "Conectividad de la ciudad",
    icon: "Radio",
  },
  {
    id: "turismo",
    name: "Servicios turísticos",
    short: "TURISMO",
    description: "Atención a visitantes",
    icon: "Palmtree",
  },
  {
    id: "municipal",
    name: "Operación municipal",
    short: "MUNICIPAL",
    description: "Servicios ciudadanos",
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
export interface LogEntry {
  at: number;
  phase: Phase;
  type: string;
  department?: string;
  detail: string;
}
export interface PublicState {
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
export interface IdentityEvent {
  id: string;
  speaker: string;
  transcript: string;
  remaining: number;
}
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
  card: IdentityCard | null;
  pendingCards: number;
  identityCooldown: number;
  identityVerificationsRemaining: number;
  identityChallenge?: IdentityChallengeState;
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
  waitingForNextRound?: boolean;
}
export interface AdminState {
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
  | "reveal"
  | "settings";
export interface GameAction {
  eventId: string;
  type:
    | "mail:classify"
    | "mail:inspect"
    | "mail:send"
    | "ddos:tap"
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
