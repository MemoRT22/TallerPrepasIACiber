import type {
  CityChapter,
  CityNarrative,
  DepartmentState,
  ExperienceStage,
  Phase,
} from "./types.js";

const MISSION_NAMES = {
  mail: "Confianza de la red",
  ddos: "Disponibilidad de servicios",
  identity: "Seguridad de accesos",
  recovery: "Restauración de Cancún",
};
const severity = { operational: 0, warning: 1, down: 2 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Pure public projection. No player/session/action data is accepted or read. */
export function cityNarrative(input: {
  departments: readonly Pick<DepartmentState, "id" | "status">[];
  chapters: readonly CityChapter[];
  phase: Phase;
  stage: ExperienceStage;
  recovery: { completed: number; total: number };
}): CityNarrative {
  const damage = new Map(input.departments.map((d) => [d.id, 0]));
  const affected = new Set<string>();
  let debt = 0;
  // Fixed-size ledger: at most one consolidated public chapter per mission.
  const chapters = (["mail", "ddos", "identity", "recovery"] as const).flatMap(
    (phase) => {
      const chapter = input.chapters.find((c) => c.phase === phase);
      return chapter
        ? [
            {
              phase,
              outcome: chapter.outcome,
              services: chapter.services
                .filter((s) => damage.has(s.id))
                .map((s) => ({ id: s.id, status: s.status })),
              ...(chapter.recoveryProgress === undefined
                ? {}
                : { recoveryProgress: clamp(chapter.recoveryProgress) }),
            },
          ]
        : [];
    },
  );
  for (const chapter of chapters) {
    if (chapter.phase === "recovery") continue;
    for (const service of chapter.services) {
      const level = severity[service.status];
      if (level) affected.add(service.id);
      damage.set(service.id, Math.max(damage.get(service.id) ?? 0, level));
    }
    if (chapter.outcome === "affected") debt += 12;
    if (chapter.outcome === "contained") {
      debt = Math.max(0, debt - 12);
      for (const [id, level] of damage) damage.set(id, Math.max(0, level - 1));
    }
  }
  const currentConsolidated = chapters.some((c) => c.phase === input.phase);
  const live =
    !currentConsolidated &&
    input.stage === "playing" &&
    ["mail", "ddos", "identity"].includes(input.phase);
  // Live status was already public before P6. Never use a private attack target.
  const current = new Map(
    input.departments.map((d) => [d.id, live ? severity[d.status] : 0]),
  );
  const recovery =
    input.phase === "recovery"
      ? clamp(input.recovery.completed / Math.max(1, input.recovery.total))
      : (chapters.find((c) => c.phase === "recovery")?.recoveryProgress ?? 0);
  const remaining = 1 - recovery;
  const services: CityNarrative["services"] = input.departments.map((d) => {
    const historical = (damage.get(d.id) ?? 0) * remaining;
    return {
      id: d.id,
      memory: affected.has(d.id)
        ? historical > 0
          ? "scarred"
          : "recovered"
        : "none",
      intensity: historical / 2,
    };
  });
  const total = input.departments.reduce(
    (sum, d) =>
      sum +
      Math.max((damage.get(d.id) ?? 0) * remaining, current.get(d.id) ?? 0),
    0,
  );
  const stability = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          debt * remaining -
          (24 * total) / Math.max(1, input.departments.length),
      ),
    ),
  );
  const hasDown = live && input.departments.some((d) => d.status === "down");
  const hasWarning =
    live && input.departments.some((d) => d.status === "warning");
  const status: CityNarrative["status"] =
    hasDown || stability < 40
      ? "critical"
      : input.phase === "recovery" && recovery > 0 && recovery < 1
        ? "recovering"
        : hasWarning || stability < 75
          ? "risk"
          : "normal";
  const chapter =
    chapters.find((c) => c.phase === input.phase) ?? chapters.at(-1);
  const message =
    input.phase === "recovery"
      ? recovery === 1
        ? "Ciudad estabilizada · servicios restaurados"
        : input.stage === "finished"
          ? "Protocolo pendiente · respuesta de emergencia finalizada"
          : "Restauración en curso · cada fragmento reconstruye el protocolo"
      : hasDown
        ? "Servicios afectados · protejan la ciudad"
        : hasWarning
          ? "Servicios bajo presión"
          : chapter
            ? `${MISSION_NAMES[chapter.phase]} · ${chapter.outcome === "contained" ? "amenaza contenida" : chapter.outcome === "affected" ? "consecuencias consolidadas" : chapter.outcome === "restored" ? "ciudad estabilizada" : "misión interrumpida"}`
            : "Cancún estable · defendamos sus servicios";
  return { stability, status, services, chapters, message };
}
