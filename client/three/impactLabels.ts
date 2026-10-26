import type { CityNarrative, DepartmentState } from "../../shared/types";
export function memoryLabel(
  id: string,
  narrative?: CityNarrative,
  status: DepartmentState["status"] = "operational",
): string {
  const memory = narrative?.services.find((s) => s.id === id)?.memory;
  if (memory === "scarred")
    return status === "operational"
      ? "Huella previa · no es bloqueo actual"
      : "Huella previa · además del incidente actual";
  if (memory === "recovered" && status !== "operational")
    return "Recuperado antes · nuevo incidente actual";
  if (memory === "recovered")
    return (
      (
        {
          energia: "Iluminación restaurada",
          movilidad: "Circulación restaurada",
          comunicaciones: "Conexión restaurada",
          agua: "Suministro restaurado",
          turismo: "Actividad turística restaurada",
          municipal: "Atención ciudadana restaurada",
        } as Record<string, string>
      )[id] ?? "Servicio recuperado"
    );
  return "";
}
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
