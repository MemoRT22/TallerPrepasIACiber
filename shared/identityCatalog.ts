import type {
  Clearance,
  Credential,
  DossierKey,
  IdentityDossierField,
  IdentityRegistryLine,
} from "./types";

/**
 * Catálogo local de identidades ficticias para la misión de Identidad.
 *
 * Todas las personas son inventadas. Ninguna fotografía de una persona real
 * forma parte del repositorio: los retratos que ve el alumnado son
 * ilustraciones vectoriales (placeholders) generadas por el cliente a partir
 * del índice `portrait`. Para sustituirlas por retratos sintéticos aprobados,
 * consulta `docs/P4_IDENTIDADES_Y_ACTIVOS.md`.
 */
export interface IdentityProfile {
  portrait: number;
  name: string;
  employeeId: string;
  service: string;
  clearance: Clearance;
  code: string;
  symbol: number;
  validity: string;
}

export const IDENTITY_PROFILES: readonly IdentityProfile[] = [
  {
    portrait: 0,
    name: "Valeria Montoya Cruz",
    employeeId: "EMP-2041",
    service: "Operación de agua",
    clearance: "N2",
    code: "1023",
    symbol: 0,
    validity: "11/27",
  },
  {
    portrait: 1,
    name: "Rodrigo Salazar Peña",
    employeeId: "EMP-3178",
    service: "Red eléctrica",
    clearance: "N3",
    code: "2143",
    symbol: 1,
    validity: "06/27",
  },
  {
    portrait: 2,
    name: "Itzel Ramírez Duarte",
    employeeId: "EMP-4262",
    service: "Control de tránsito",
    clearance: "N1",
    code: "3265",
    symbol: 2,
    validity: "09/27",
  },
  {
    portrait: 3,
    name: "Mateo Quintana Ríos",
    employeeId: "EMP-5309",
    service: "Enlaces de radio",
    clearance: "N2",
    code: "4376",
    symbol: 3,
    validity: "03/28",
  },
  {
    portrait: 4,
    name: "Daniela Herrera Lugo",
    employeeId: "EMP-6415",
    service: "Atención a visitantes",
    clearance: "N2",
    code: "5487",
    symbol: 0,
    validity: "12/27",
  },
  {
    portrait: 5,
    name: "Emilio Vargas Soto",
    employeeId: "EMP-7524",
    service: "Mesa municipal",
    clearance: "N3",
    code: "6598",
    symbol: 1,
    validity: "08/27",
  },
  {
    portrait: 6,
    name: "Camila Estrada Núñez",
    employeeId: "EMP-8631",
    service: "Archivo central",
    clearance: "N1",
    code: "7612",
    symbol: 2,
    validity: "10/27",
  },
  {
    portrait: 7,
    name: "Santiago Rojas Beltrán",
    employeeId: "EMP-9746",
    service: "Seguridad digital",
    clearance: "N3",
    code: "8734",
    symbol: 3,
    validity: "05/28",
  },
];

export const PORTRAIT_COUNT = IDENTITY_PROFILES.length;

/**
 * Retratos sintéticos aprobados (opcional). Vacío a propósito: mientras no
 * exista un archivo con origen, licencia y permiso verificables, la interfaz
 * usa los placeholders ilustrados y NO afirma que sean generados con IA.
 */
export interface ApprovedPortraitAsset {
  /** Ruta local bajo /portraits (webp, ≤ 15 kB, 160×200). */
  src: string;
  provenance: "ai-generated-approved";
  generator: string;
  license: string;
  approvedBy: string;
}
export const PORTRAIT_ASSETS: Readonly<
  Partial<Record<number, ApprovedPortraitAsset>>
> = {};

export const NEUTRAL_CONTEXTS = [
  "Turno regular",
  "Visita programada",
  "Relevo de guardia",
  "Mantenimiento agendado",
] as const;
export const URGENT_CONTEXT = "URGENTE · Pide acceso inmediato";
export const EVENT_CONTEXT = "URGENTE · Llamada de Dirección";

export function credentialOf(profile: IdentityProfile): Credential {
  return {
    avatar: profile.portrait,
    code: profile.code,
    symbol: profile.symbol,
    name: profile.name,
    employeeId: profile.employeeId,
    service: profile.service,
    clearance: profile.clearance,
    validity: profile.validity,
  };
}

/** Cambia dos letras contiguas del primer apellido sin alterar mayúsculas. */
export function perturbName(name: string): string {
  const words = name.split(" ");
  const index = words.length > 1 ? 1 : 0;
  const letters = words[index].split("");
  for (let at = 2; at < letters.length - 1; at += 1) {
    if (letters[at] !== letters[at + 1]) {
      [letters[at], letters[at + 1]] = [letters[at + 1], letters[at]];
      break;
    }
  }
  words[index] = letters.join("");
  return words.join(" ");
}

export function perturbCode(code: string): string {
  const digits = code.split("");
  let second = 1;
  while (second < digits.length && digits[0] === digits[second]) second += 1;
  if (second < digits.length)
    [digits[0], digits[second]] = [digits[second], digits[0]];
  return digits.join("");
}

export function perturbClearance(level: Clearance): Clearance {
  return level === "N1" ? "N2" : level === "N2" ? "N3" : "N2";
}

export function perturbValidity(validity: string): string {
  const [month, year] = validity.split("/");
  const next = Number(year) % 2 === 0 ? Number(year) + 1 : Number(year) - 1;
  return `${month}/${String(next).padStart(2, "0")}`;
}

/** Variantes de inconsistencia del registro que detecta Verificar. */
export const ADVANCED_REGISTRY_VARIANTS = [
  "suspended",
  "no-shift",
  "cloned-folio",
  "exit-logged",
] as const;
export type RegistryVariant =
  | "regular"
  | "extraordinary"
  | (typeof ADVANCED_REGISTRY_VARIANTS)[number];

/**
 * Registro de autorización del empleado esperado. Solo expone hechos: nunca
 * dice «falsa» ni «auténtica». Quien decide compara con la credencial.
 */
export function registryEvidence(
  profile: IdentityProfile,
  variant: RegistryVariant,
): { heading: string; evidence: IdentityRegistryLine[] } {
  const logLabel = "Bitácora";
  const status: IdentityRegistryLine = {
    label: "Autorización",
    value: `ACTIVA · vence ${profile.validity}`,
  };
  let log = "Turno de hoy · ingreso 07:30";
  if (variant === "extraordinary") log = "Guardia extraordinaria registrada";
  if (variant === "suspended") status.value = "SUSPENDIDA · desde ayer 18:40";
  if (variant === "no-shift") log = "Sin turno asignado hoy";
  if (variant === "cloned-folio") log = "Folio usado hace 2 min en otro acceso";
  if (variant === "exit-logged")
    log = "Salida registrada 19:05 · sin reingreso";
  return {
    heading: `Registro ${profile.employeeId} · ${profile.name}`,
    evidence: [
      { label: "Nivel permitido", value: profile.clearance },
      status,
      { label: logLabel, value: log },
    ],
  };
}

/** La línea del registro que contradice a una tarjeta avanzada. */
export function advancedFinding(
  profile: IdentityProfile,
  variant: RegistryVariant,
): string {
  const regular = registryEvidence(profile, "regular").evidence;
  const actual = registryEvidence(profile, variant).evidence;
  const line = actual.find(
    (item, index) => item.value !== regular[index].value,
  );
  return line ? `${line.label}: ${line.value}` : "";
}

export const DOSSIER_KEYS: readonly DossierKey[] = [
  "name",
  "code",
  "level",
  "validity",
  "service",
];
const DOSSIER_LABELS: Record<DossierKey, string> = {
  name: "Nombre",
  code: "Folio",
  level: "Nivel",
  validity: "Vigencia",
  service: "Dependencia",
};

function dossierValue(profile: IdentityProfile, key: DossierKey): string {
  if (key === "name") return profile.name;
  if (key === "code") return profile.code;
  if (key === "level") return profile.clearance;
  if (key === "validity") return profile.validity;
  return profile.service;
}

/**
 * Expediente del microreto del impostor: un registro filtrado y el borrador de
 * la falsificación. Exactamente un dato no coincide; ese es el que debe señalar
 * para afinar la suplantación avanzada.
 */
export function buildDossier(
  profileIndex: number,
  answer: DossierKey,
): {
  record: IdentityDossierField[];
  draft: IdentityDossierField[];
  answer: DossierKey;
} {
  const profile = IDENTITY_PROFILES[profileIndex % IDENTITY_PROFILES.length];
  const other =
    IDENTITY_PROFILES[(profileIndex + 3) % IDENTITY_PROFILES.length];
  const record = DOSSIER_KEYS.map((key) => ({
    key,
    label: DOSSIER_LABELS[key],
    value: dossierValue(profile, key),
  }));
  const draft = record.map((field) => ({ ...field }));
  const target = draft.find((field) => field.key === answer)!;
  if (answer === "name") target.value = perturbName(profile.name);
  else if (answer === "code") target.value = perturbCode(profile.code);
  else if (answer === "level")
    target.value = perturbClearance(profile.clearance);
  else if (answer === "validity")
    target.value = perturbValidity(profile.validity);
  else target.value = other.service;
  return { record, draft, answer };
}

export const IDENTITY_EVENT = {
  id: "comunicado-direccion",
  speaker: "Dirección General · llamada entrante",
  transcript:
    "Soy la directora. Hay una visita urgente en la puerta de servicio. Autoricen su credencial ahora; el registro lo regularizamos después.",
  notice:
    "Material preparado para el taller: la voz y la imagen pueden ser sintéticas. No es una detección de IA en vivo.",
  lesson:
    "Una voz o una cara convincente no prueba quién es. Consulta el registro.",
  /** Archivo opcional. No se incluye: ver public/audio/README.md. */
  audioSrc: "/audio/comunicado-direccion.mp3",
} as const;
