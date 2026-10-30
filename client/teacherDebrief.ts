import type { AdminState, LogEntry, PublicState } from "../shared/types";

const QUESTIONS = [
  "¿Qué evidencia revisaron antes de decidir?",
  "¿Cuándo confiaron demasiado?",
  "¿Qué harían diferente?",
] as const;
const MISSIONS = {
  mail: {
    name: "Correos",
    action:
      "Confirmen las solicitudes por un canal independiente antes de autorizar acciones.",
  },
  ddos: {
    name: "DDoS",
    action:
      "Distingan tráfico legítimo de tráfico anómalo antes de bloquear y acuerden cuándo proteger el servicio.",
  },
  identity: {
    name: "Identidad",
    action:
      "Corroboren la autorización por un canal independiente: una coincidencia visual no basta.",
  },
  recovery: {
    name: "Recuperación",
    action:
      "Acuerden quién valida cada parte y cómo contrastar un cambio de clave por un canal independiente.",
  },
} as const;

/** A small presentation selector, not a new audit: never parse/echo log details,
 * votes, names or the general public reflection as evidence of a specific act. */
export function teacherDebrief(state: PublicState, admin?: AdminState) {
  if (
    !admin ||
    state.phase !== "revealed" ||
    !state.reveal ||
    state.judgment?.stage !== "reveal" ||
    state.judgment.step !== "learning" ||
    state.judgment.elapsed < 30
  )
    return null;
  const logs = admin.closingAudit?.logs ?? [];
  const has = (phase: LogEntry["phase"], type: string) =>
    logs.some((log) => log.phase === phase && log.type === type);
  const consultations = [
    has("mail", "mail_inspect") ? "inspección de correos" : null,
    has("identity", "identity_verify")
      ? "consulta al registro de Identidad"
      : null,
    has("recovery", "recovery_key_verify")
      ? "verificación de claves de Recuperación"
      : null,
  ].filter(Boolean);
  const evidence = consultations.length
    ? `Se solicitaron estas consultas: ${consultations.join("; ")}.`
    : null;
  const mistake = has("ddos", "blue_lost")
    ? "En DDoS se bloqueó tráfico legítimo."
    : has("identity", "identity_blocked")
      ? "En Identidad se registró al menos un servicio comprometido."
      : null;
  // Prefer a mission without a defensive point, never infer a specific mistake
  // from its metric or the overall winner. Voting is not a technical mission.
  const technical = state.results.filter((r) =>
    Object.hasOwn(MISSIONS, r.phase),
  );
  const result =
    technical.find((r) => r.winner !== "defenders") ??
    technical.find((r) => r.phase === "identity") ??
    technical[0];
  const mission = result
    ? MISSIONS[result.phase as keyof typeof MISSIONS]
    : null;
  const outcome =
    result && mission
      ? result.winner === "defenders"
        ? `El equipo alcanzó la meta de ${mission.name}.`
        : result.winner === "impostor"
          ? `La amenaza ganó la misión de ${mission.name}.`
          : `${mission.name} terminó sin punto adjudicado; no se infiere la causa.`
      : null;
  return {
    outcome:
      state.reveal.winner === "tie"
        ? "Empate por puntos"
        : state.reveal.winner === "defenders"
          ? "Victoria defensora por puntos"
          : "Victoria del impostor por puntos",
    questions: [
      {
        question: QUESTIONS[0],
        evidence,
        suggestion:
          "Distingan lo que muestra una solicitud de lo que confirma una fuente independiente.",
      },
      {
        question: QUESTIONS[1],
        evidence: mistake,
        suggestion: mistake
          ? "Identifiquen qué señal faltó contrastar; un error registrado no demuestra por qué alguien confió."
          : "Como hipótesis, imaginen una solicitud convincente pero sin autorización. Revisen qué señal les haría detenerse.",
      },
      {
        question: QUESTIONS[2],
        evidence: outcome,
        suggestion:
          mission?.action ??
          "En una situación real, verifiquen por otro canal, decidan con evidencia y coordinen la respuesta.",
      },
    ],
  };
}
