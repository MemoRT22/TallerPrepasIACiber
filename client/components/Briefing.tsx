import { Fingerprint, KeyRound, Mail, Shield, TrafficCone } from "lucide-react";
import type { PlayerState, PublicState } from "../../shared/types";
const EXPLANATIONS = {
  mail: {
    title: "Detecta los correos falsos",
    icon: Mail,
    steps: [
      "Lee quién lo envía y qué pide.",
      "Acepta los mensajes seguros. Descarta los sospechosos.",
      "El dominio correcto es @cancun.example. Nunca pide tu contraseña.",
    ],
    tip: "Una letra de más puede ser una trampa.",
    privateTip:
      "Tu disfraz es responsable de tu servicio. Revisa correos como los demás y mezcla envíos normales con falsos. Logra que acepten tres correos falsos tuyos.",
  },
  ddos: {
    title: "Protege tu servidor",
    icon: TrafficCone,
    steps: [
      "Los círculos azules son seguros: déjalos llegar.",
      "Toca las cruces naranjas antes de que lleguen al centro.",
      "Si el servidor se llena, tu servicio queda fuera de línea.",
    ],
    tip: "No toques todo: la ciudad necesita los puntos azules.",
    privateTip:
      "Aparenta proteger tu servicio. Al tocar una cruz, mandas otra a un defensor. En los últimos 10 segundos mandas 3 en total entre los demás servicios. Sabotea sin anunciarlo. Tu servidor simula la carga, pero sigues jugando.",
  },
  identity: {
    title: "Compara las credenciales",
    icon: Fingerprint,
    steps: [
      "Mira las dos tarjetas una junto a la otra.",
      "Compara la foto, los cuatro números y el símbolo.",
      "Si todo coincide, permite el acceso. Si algo cambia, bloquea.",
    ],
    tip: "Decide antes de que termine el tiempo de la tarjeta.",
    privateTip:
      "Tu disfraz sigue siendo responsable de tu servicio. Revisa tarjetas como el equipo y usa Enviar solicitud para mandar una credencial alterada sin revelar tu identidad.",
  },
  recovery: {
    title: "Recupera la ciudad",
    icon: KeyRound,
    steps: [
      "Cada letra avanzó tres lugares en el alfabeto.",
      "Retrocede tres para descubrir tu fragmento: D → A.",
      "Envía tu parte y hablen para unir el mensaje.",
    ],
    tip: "Puedes volver a intentar. Solo envía tu propio fragmento.",
    privateTip:
      "Tu terminal tendrá una tarea auxiliar. Mantén tu disfraz; en esta fase no puedes sabotear ni cambiar el mensaje del equipo.",
  },
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
      <span className="eyebrow">ANTES DE EMPEZAR</span>
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
          Durante el juego, cada 5 segundos sin responder con elementos
          pendientes suma un punto malo de inactividad. Las pausas y la espera
          sin elementos no cuentan.
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
