import { Fingerprint, KeyRound, Mail, Shield, TrafficCone } from "lucide-react";
import type { PlayerState, PublicState } from "../../shared/types";
const EXPLANATIONS = {
  mail: {
    title: "Detecta los correos falsos",
    icon: Mail,
    steps: [
      "Lee remitente y asunto.",
      "Acepta @cancun.example; descarta otros dominios o pedidos de contraseña.",
    ],
    tip: "Decide rápido, pero revisa cada letra del dominio.",
    privateTip:
      "Tu disfraz es responsable de tu servicio. Revisa correos como los demás y mezcla envíos normales con falsos. Logra que acepten tres correos falsos tuyos.",
  },
  ddos: {
    title: "Protege tu servidor",
    icon: TrafficCone,
    steps: [
      "Deja llegar los círculos azules.",
      "Toca las cruces naranjas antes del centro; la presión sube en tres etapas.",
    ],
    tip: "No toques todo: la ciudad necesita los puntos azules.",
    privateTip:
      "Aparenta proteger tu servicio. Al tocar una cruz, mandas otra a un defensor. En los últimos 10 segundos mandas 3 en total entre los demás servicios. Sabotea sin anunciarlo. Tu servidor simula la carga, pero sigues jugando.",
  },
  identity: {
    title: "Compara las credenciales",
    icon: Fingerprint,
    steps: [
      "Compara foto, cuatro números y símbolo.",
      "Todo igual: Permitir. Algo cambia: No permitir.",
    ],
    tip: "Decide antes de que termine el tiempo de la tarjeta.",
    privateTip:
      "Tu disfraz sigue siendo responsable de tu servicio. Revisa tarjetas como el equipo y usa Enviar solicitud para mandar una credencial alterada sin revelar tu identidad.",
  },
  recovery: {
    title: "Recupera la ciudad",
    icon: KeyRound,
    steps: [
      "Retrocede tres letras para descifrar: D → A.",
      "Escribe tu fragmento, envíalo y unan las partes en equipo.",
    ],
    tip: "Puedes volver a intentar. Solo envía tu propio fragmento.",
    privateTip:
      "Tu terminal tendrá una tarea auxiliar. Mantén tu disfraz; en esta fase no puedes sabotear ni cambiar el mensaje del equipo.",
  },
} as const;

const INACTIVITY_HINTS = {
  mail: "Con correos pendientes, responde antes de 5 s.",
  ddos: "Con cruces naranjas pendientes, responde antes de 5 s.",
  identity: "Con una credencial activa, responde antes de 5 s.",
} as const;

export default function Briefing({
  state,
  player,
  roleVisible,
}: {
  state: PublicState;
  player: PlayerState;
  roleVisible: boolean;
}) {
  const phase = state.phase === "lobby" ? "mail" : state.phase;
  const info = EXPLANATIONS[phase as keyof typeof EXPLANATIONS];
  if (!info) return null;
  const Icon = info.icon;
  if (state.stage === "countdown")
    return (
      <section className="briefing-card countdown-card" role="status">
        <span className="briefing-icon">
          <Shield size={34} />
        </span>
        <span className="eyebrow">AMENAZA DETECTADA</span>
        <h2>
          {state.paused ? "Cuenta regresiva pausada" : "Prepárate para jugar"}
        </h2>
        <strong className="countdown-number">
          {Math.max(1, Math.ceil(state.countdown))}
        </strong>
        <p>
          {state.paused ? "Espera la señal del administrador." : info.title}
        </p>
      </section>
    );
  return (
    <section className="briefing-card">
      <span className="briefing-icon">
        <Icon size={34} />
      </span>
      <span className="eyebrow">MISIÓN RÁPIDA · LEE Y ACTÚA</span>
      <h2>{info.title}</h2>
      <ol>
        {info.steps.map((step, i) => (
          <li key={step}>
            <span>{i + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      <div className="briefing-tip">{info.tip}</div>
      {["mail", "ddos", "identity"].includes(phase) && (
        <p className="help-text">
          {INACTIVITY_HINTS[phase as keyof typeof INACTIVITY_HINTS]} Pausas y
          esperas sin decisiones no cuentan.
        </p>
      )}
      <p className="briefing-target">
        {phase === "mail"
          ? `Meta del equipo: ${state.settings.mailAccuracy}% de revisión correcta.`
          : phase === "ddos"
            ? `Meta: mantener los servicios y dejar pasar ${state.settings.blueAccuracy}% de los azules.`
            : phase === "identity"
              ? `Meta: permitir ${state.settings.identityAccuracy}% de las tarjetas válidas.`
              : "Meta: recuperar todas las partes del mensaje."}
      </p>
      {player.role === "impostor" && roleVisible && (
        <div className="private-tip">
          <b>Tu misión secreta</b>
          <p>
            {info.privateTip}
            {phase === "ddos" || phase === "identity"
              ? ` Tu objetivo: ${state.sabotageTarget} servicios defensores fuera de línea.`
              : ""}
          </p>
        </div>
      )}
      <div className="briefing-wait">
        <i />
        {state.stage === "briefing" && state.autoStart && state.running
          ? state.paused
            ? "Lectura pausada. Espera al administrador."
            : `Lee con calma. La cuenta de inicio empieza en ${Math.ceil(state.briefingRemaining || 0)} segundos.`
          : state.assigned
            ? "Espera la señal del administrador."
            : "Tu terminal está lista. Espera la asignación de roles."}
      </div>
    </section>
  );
}
