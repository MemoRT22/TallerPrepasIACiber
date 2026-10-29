import { Fingerprint, KeyRound, Mail, Shield, TrafficCone } from "lucide-react";
import type { PlayerState, PublicState } from "../../shared/types";
const EXPLANATIONS = {
  mail: {
    title: "Investiga la bandeja comprometida",
    icon: Mail,
    steps: [
      "Compara remitente, solicitud, contexto y procedimiento.",
      "Acepta o descarta; usa una de tus dos inspecciones cuando falte evidencia.",
    ],
    tip: "Un dominio conocido puede ser suplantado. Ninguna señal decide sola.",
    privateTip:
      "Revisa casos como los demás y mezcla cobertura con urgencia, autoridad o suplantación. Logra tres aceptaciones sin recibir confirmación inmediata.",
  },
  ddos: {
    title: "Protege tu servidor",
    icon: TrafficCone,
    steps: [
      "Deja llegar los círculos azules.",
      "Toca las cruces naranjas antes del centro; la presión sube en tres etapas.",
    ],
    tip: "Tienes un escudo de 4 segundos y un solo uso: guárdalo para el momento de mayor presión.",
    privateTip:
      "Aparenta proteger tu servicio. Analiza qué origen repite más peticiones por cliente para desbloquear una sola oleada de tres cruces. Elige objetivo y momento; tocar naranja ya no genera ataques adicionales.",
  },
  identity: {
    title: "Verifica antes de permitir",
    icon: Fingerprint,
    steps: [
      "Compara la credencial oficial con la presentada: foto, nombre, folio, nivel y vigencia.",
      "Una coincidencia visual no garantiza autorización. Si dudas, pulsa Verificar para consultar el registro (2 usos).",
    ],
    tip: "Una foto o una voz convincente no prueba identidad: el registro manda.",
    privateTip:
      "Revisa tarjetas como el equipo y envía credenciales alteradas. Resuelve tu expediente privado para soltar una sola suplantación avanzada: idéntica a la vista, solo el registro la delata.",
  },
  recovery: {
    title: "MISIÓN 04 — RESTAURAR CANCÚN",
    icon: KeyRound,
    steps: [
      "El protocolo está bloqueado. Cada defensor conserva una parte de la autorización.",
      "Descifra y envía tu fragmento antes del límite. Alguien puede alterar una clave.",
    ],
    tip: "Si cambia, prueba la tabla o verifica. Autorización ficticia: César no es cifrado seguro moderno.",
    privateTip:
      "Resuelve tu reto César privado para desbloquear una sola interferencia. Podrás cambiar de +3 a +5 la clave de un fragmento pendiente, sin cambiar su respuesta.",
  },
} as const;

const INACTIVITY_HINTS = {
  mail: "Leer e inspeccionar no genera penalización por inactividad.",
  ddos: "Esperar azul es correcto; protegerse con el escudo no cuenta como inactividad.",
  identity:
    "Con una credencial activa, responde antes de 5 s; verificar reinicia la cuenta.",
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
              : "Meta: validar todas las partes del protocolo de restauración."}
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
