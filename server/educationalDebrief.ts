import type {
  CityMission,
  Credential,
  EducationalCase,
  IdentityRegistryLine,
} from "../shared/types";

export interface EducationalCandidate {
  priority: number;
  facts: EducationalCase;
}
export const LEARNING: Record<CityMission, string> = {
  mail: "Contrasta remitente, contexto y procedimiento. Confirma una acción sensible por un canal independiente.",
  ddos: "Distingue peticiones legítimas azules de señales maliciosas naranjas antes de intervenir.",
  identity:
    "Una credencial visualmente idéntica no garantiza autorización. Contrasta el registro antes de permitir.",
  recovery:
    "Valida cada parte antes de dar por restaurado el protocolo. César es un ejercicio, no criptografía segura moderna.",
};
const excerpt = (text: string) =>
  text.replace(/\s+/g, " ").trim().slice(0, 120);
const candidate = (
  priority: number,
  phase: CityMission,
  decision: string,
  evidence: string,
  consequence: string,
): EducationalCandidate => ({
  priority,
  facts: { decision, evidence, consequence, learning: LEARNING[phase] },
});

// Factories accept only what was visible to this player. No hidden truth,
// sender, recipient, owner, role, attack target or success enters selection.
export function mailEducation(
  accept: boolean | null,
  preview: string,
  inspected?: readonly string[],
) {
  const evidence =
    `El mensaje decía: «${excerpt(preview)}».` +
    (inspected?.length
      ? ` La inspección mostraba: «${excerpt(inspected[0])}».`
      : "");
  return candidate(
    accept === null ? 10 : inspected ? 30 : 20,
    "mail",
    accept === null
      ? "Solicitaste una inspección de este correo."
      : accept
        ? "Aceptaste la solicitud de este correo."
        : "Rechazaste la solicitud de este correo.",
    evidence,
    accept === null
      ? "Se habilitó evidencia adicional; consultar no confirma que después decidiste correctamente."
      : accept
        ? "Autorizaste la acción solicitada; esto no confirma por sí solo su legitimidad."
        : "No autorizaste la acción solicitada en ese correo.",
  );
}
export function trafficEducation(kind: "blue" | "red") {
  return kind === "blue"
    ? candidate(
        30,
        "ddos",
        "Bloqueaste una señal azul.",
        "El círculo azul representaba una petición legítima.",
        "Esa petición se retiró antes de llegar al servicio.",
      )
    : candidate(
        20,
        "ddos",
        "Interceptaste una señal naranja.",
        "La cruz naranja representaba tráfico malicioso.",
        "Retiraste esa señal de tu radar antes de que llegara al centro.",
      );
}
export function shieldEducation() {
  return candidate(
    10,
    "ddos",
    "Activaste el escudo de emergencia.",
    "El control ofrecía protección temporal de cuatro segundos, con un uso por ronda.",
    "Se activó la protección temporal de tu terminal.",
  );
}
export function saturationEducation() {
  return candidate(
    5,
    "ddos",
    "Tu servicio alcanzó el límite de saturación.",
    "El indicador de saturación de tu terminal llegó al máximo.",
    "Tu servicio dejó de responder durante esa misión.",
  );
}
export function identityEducation(
  accept: boolean,
  reference: Credential,
  presented: Credential,
  registry?: readonly IdentityRegistryLine[],
) {
  const fields: [keyof Credential, string][] = [
    ["avatar", "retrato"],
    ["code", "folio"],
    ["symbol", "símbolo"],
    ["name", "nombre"],
    ["employeeId", "empleado"],
    ["service", "dependencia"],
    ["clearance", "nivel"],
    ["validity", "vigencia"],
  ];
  const differences = fields
    .filter(([key]) => reference[key] !== presented[key])
    .map(([, label]) => label);
  const visibleRegistry = registry?.filter((line) =>
    ["Autorización", "Bitácora"].includes(line.label),
  );
  const evidence = differences.length
    ? `Los campos visibles diferían en ${differences.slice(0, 3).join(", ")}.`
    : "Los campos visibles de ambas credenciales coincidían.";
  return candidate(
    registry ? 30 : differences.length ? 20 : 15,
    "identity",
    accept
      ? "Permitiste el acceso presentado por esa credencial."
      : "No permitiste el acceso presentado por esa credencial.",
    evidence +
      (visibleRegistry?.length
        ? ` El registro disponible indicaba: ${visibleRegistry.map((line) => `${line.label}: ${excerpt(line.value)}`).join("; ")}.`
        : ""),
    accept
      ? "La solicitud recibió tu autorización de acceso; el parecido visual no prueba su legitimidad."
      : "La solicitud no recibió tu autorización de acceso.",
  );
}
export function registryEducation() {
  return candidate(
    10,
    "identity",
    "Solicitaste una consulta al registro.",
    "La consulta se inició con una credencial activa y margen disponible.",
    "Usaste una consulta para esa tarjeta; iniciar no demuestra que leíste la respuesta ni que decidiste correctamente.",
  );
}
export function recoveryEducation(kind: "answer" | "verify") {
  if (kind === "answer")
    return candidate(
      30,
      "recovery",
      "Enviaste una respuesta correcta de descifrado.",
      "La respuesta que enviaste coincidió con la esperada para tu ejercicio.",
      "Tu respuesta fue validada. El progreso colectivo se confirma en los módulos del protocolo.",
    );
  return candidate(
    20,
    "recovery",
    "Solicitaste verificar la clave de tu fragmento.",
    "Tu terminal ofrecía una comprobación de clave.",
    "Se inició la comprobación de tu clave; esto no prueba que se completó el protocolo.",
  );
}
