import type { PublicState, RoundResult } from "./types.js";

export function votingBonus(
  eligible: readonly string[],
  votes: readonly { id: string; suspect: string }[],
  impostor: string,
): NonNullable<NonNullable<PublicState["reveal"]>["bonus"]> {
  const electorate = [...new Set(eligible)];
  const ballots = new Map(votes.map((v) => [v.id, v.suspect]));
  const correct = electorate.filter(
    (id) => ballots.get(id) === impostor,
  ).length;
  const required = Math.floor(electorate.length / 2) + 1;
  return {
    winner: correct >= required ? "defenders" : "impostor",
    correct,
    eligible: electorate.length,
    required,
    abstentions: electorate.filter((id) => !ballots.has(id)).length,
  };
}

export function finalReflection(
  results: RoundResult[],
  evidence: { inspected: boolean; blueLost: boolean; redImpact: boolean },
) {
  const success = results.find(
    (r) =>
      r.winner === "defenders" &&
      ["mail", "ddos", "identity", "recovery"].includes(r.phase),
  );
  const names: Record<string, string> = {
    mail: "revisión de correos",
    ddos: "atención de tráfico legítimo",
    identity: "verificación de accesos",
    recovery: "recuperación colaborativa",
  };
  return {
    success: success
      ? `Acierto comprobado: el equipo logró la meta de ${names[success.phase]}.`
      : evidence.inspected
        ? "Acierto comprobado: se consultó evidencia de correo antes de decidir."
        : "No se registró un acierto verificable. Una decisión acertada sería contrastar una solicitud con evidencia independiente.",
    vulnerability: evidence.blueLost
      ? "Error observado: se interceptó tráfico legítimo; no toda señal debe bloquearse."
      : evidence.redImpact
        ? "Vulnerabilidad observada: tráfico malicioso alcanzó servicios de la ciudad."
        : "No hay un error concreto verificable en este registro. Riesgo a prevenir: confiar solo en la apariencia de un mensaje o identidad.",
    recommendation:
      "En situaciones reales, verifica por otro canal, decide con evidencia y coordina la respuesta. Esto fue una simulación, no un ataque real.",
  };
}

export function revealStep(elapsed: number) {
  return elapsed < 3
    ? "truth"
    : elapsed < 9
      ? "identity"
      : elapsed < 20
        ? "result"
        : "learning";
}
