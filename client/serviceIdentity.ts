import { DEPARTMENTS, type DepartmentState, type Phase } from "../shared/types";

export const SERVICE_STATES = {
  operational: {
    label: "Operativo",
    message: "El servicio continúa funcionando.",
  },
  warning: {
    label: "Bajo presión",
    message: "El servicio presenta señales de riesgo. Mantén la vigilancia.",
  },
  down: {
    label: "Interrumpido",
    message: "El servicio fue afectado. La ciudad registra las consecuencias.",
  },
} as const;

/** Public service projection only. Scores, roles and private actions are not inputs. */
export function serviceState(service?: DepartmentState, connected = true) {
  if (!service || !connected)
    return {
      status: "unknown",
      label: "Sin confirmar",
      message: "Esperando un estado actualizado del servicio.",
    };
  return {
    status: service.status,
    ...SERVICE_STATES[service.status],
    ...(service.occupied && !service.connected
      ? {
          message:
            "La terminal está desconectada; no se atribuye la causa a un ataque.",
        }
      : {}),
  };
}
export const serviceProfile = (id: string) =>
  DEPARTMENTS.find((service) => service.id === id);

export function serviceContribution(phase: Phase) {
  switch (phase) {
    case "mail":
      return "Revisar solicitudes reduce el riesgo de autorizar acciones comprometidas.";
    case "ddos":
      return "Distinguir tráfico legítimo de malicioso ayuda a mantener la disponibilidad.";
    case "identity":
      return "Contrastar credenciales con una autorización independiente protege los accesos.";
    case "recovery":
      return "Validar las partes pendientes puede contribuir a reconstruir el protocolo.";
    case "voting":
      return "Habla de señales y decisiones; una sospecha no determina el estado de un servicio.";
    case "revealed":
      return "Distingue el estado operativo de la ciudad del resultado por puntos.";
    default:
      return "Verifica información y coordina decisiones para proteger los servicios de Cancún.";
  }
}
