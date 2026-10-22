import type { DepartmentState } from "../../shared/types";
const LABELS: Record<string, { warning: string; down: string }> = {
  energia: {
    warning: "Luces de la ciudad atenuadas",
    down: "Apagón en la ciudad",
  },
  movilidad: { warning: "Tráfico lento", down: "Embotellamiento de coches" },
  agua: {
    warning: "Vecinos esperando agua",
    down: "Personas en fila por falta de agua",
  },
  municipal: {
    warning: "Filas de atención ciudadana",
    down: "Personas esperando en la calle",
  },
  comunicaciones: {
    warning: "Personas buscando señal",
    down: "Vecinos sin conexión",
  },
  turismo: {
    warning: "Visitantes esperando atención",
    down: "Filas de visitantes",
  },
};
export function getCityImpacts(departments: DepartmentState[]) {
  return departments
    .filter((d) => d.status !== "operational" && LABELS[d.id])
    .map((d) => ({
      id: d.id,
      name: d.name,
      label: LABELS[d.id][d.status as "warning" | "down"],
      status: d.status,
    }));
}
