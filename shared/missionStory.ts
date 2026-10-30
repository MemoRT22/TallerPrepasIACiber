import type { CityMission, PublicState, RoundResult } from "./types";

const MISSIONS = ["mail", "ddos", "identity", "recovery"] as const;
const CHAPTERS = {
  mail: {
    title: "MISIÓN 01 — REVISAR LA CONFIANZA",
    threat: "Solicitudes sospechosas ponen a prueba la confianza de Cancún.",
    action: "Revisemos las peticiones antes de autorizar acciones.",
  },
  ddos: {
    title: "MISIÓN 02 — PROTEGER LA INFRAESTRUCTURA",
    threat: "Ahora el tráfico anómalo amenaza la disponibilidad.",
    action: "Protejamos los servicios de la saturación.",
  },
  identity: {
    title: "MISIÓN 03 — VERIFICAR EL ACCESO",
    threat:
      "La siguiente amenaza busca acceso mediante credenciales y suplantación.",
    action: "Verifiquemos la autorización antes de abrir el acceso.",
  },
  recovery: {
    title: "MISIÓN 04 — RESTAURAR CANCÚN",
    threat: "Tras los incidentes, el protocolo central necesita reconstruirse.",
    action: "Validemos sus partes para recuperar la capacidad operativa.",
  },
  voting: {
    title: "JUICIO FINAL — IDENTIFICAR AL INFILTRADO",
    threat: "El responsable infiltrado sigue sin identificar.",
    action: "Contrastemos las señales antes de votar.",
  },
} as const;
const NAMES: Record<CityMission, string> = {
  mail: "Correos",
  ddos: "DDoS",
  identity: "Identidad",
  recovery: "Recuperación",
};

function closing(result: RoundResult, state: PublicState): string {
  if (result.phase === "recovery") {
    if (result.winner === "inconclusive")
      return "La respuesta de emergencia fue interrumpida.";
    if (
      state.recovery.done &&
      state.recovery.total > 0 &&
      state.recovery.completed === state.recovery.total
    )
      return "La respuesta de emergencia terminó con el protocolo completo.";
    return "La respuesta de emergencia terminó con el protocolo incompleto.";
  }
  const name = NAMES[result.phase as CityMission];
  // The engine publishes this explicit interruption, distinct from a timeout
  // without a winner. Never echo arbitrary descriptions or private details.
  if (result.description === "Interrumpida por administrador.")
    return `La misión de ${name} fue interrumpida por el docente.`;
  if (result.winner === "defenders")
    return `El equipo alcanzó la meta de ${name}.`;
  if (result.winner === "impostor")
    return `La amenaza obtuvo ventaja en ${name}.`;
  return `La misión de ${name} cerró sin ganador.`;
}

/** Presentation of public engine facts only; no timers or game actions. */
export function missionStory(state: PublicState) {
  const phase = state.phase === "lobby" ? "mail" : state.phase;
  const index = MISSIONS.indexOf(phase as CityMission);
  if (index < 0 || !["waiting", "briefing", "finished"].includes(state.stage))
    return null;
  const finished = state.stage === "finished";
  const previous = finished ? MISSIONS[index] : MISSIONS[index - 1];
  const result = previous
    ? state.results.find((item) => item.phase === previous)
    : undefined;
  if (finished && !result) return null;
  const next = finished
    ? index === MISSIONS.length - 1
      ? "voting"
      : MISSIONS[index + 1]
    : MISSIONS[index];
  const chapter = CHAPTERS[next];
  const recap = result
    ? closing(result, state)
    : previous
      ? `La misión de ${NAMES[previous]} no tiene cierre confirmado.`
      : null;
  return {
    title: chapter.title,
    label:
      next === "mail"
        ? "INICIO DE LA CRISIS"
        : next === "voting"
          ? "LA INVESTIGACIÓN CONTINÚA"
          : "NUEVA AMENAZA DETECTADA",
    text: [recap, chapter.threat, chapter.action].filter(Boolean).join(" "),
  };
}
