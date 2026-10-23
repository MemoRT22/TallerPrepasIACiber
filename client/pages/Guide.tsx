import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Fingerprint,
  LockKeyhole,
  Mail,
  Shield,
  Waves,
  X,
} from "lucide-react";
import { Badge, SectionHeading } from "../components/UI";

const PRACTICE = [
  {
    sender: "agua@cancun.example",
    subject: "Reporte de abastecimiento disponible",
    safe: true,
    explanation: "Dominio oficial y no pide datos sensibles.",
  },
  {
    sender: "soporte@cancunn.example",
    subject: "Actualización de acceso municipal",
    safe: false,
    explanation: "El dominio tiene una letra de más.",
  },
  {
    sender: "soporte@cancun.example",
    subject: "Envía tu contraseña para validar tu cuenta",
    safe: false,
    explanation: "Un remitente oficial nunca pide tu contraseña.",
  },
];

export default function Guide() {
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [decision, setDecision] = useState<boolean | null>(null);
  const card = PRACTICE[practiceIndex];

  return (
    <main className="page-container guide-page">
      <SectionHeading
        eyebrow="GUÍA DEL ADMINISTRADOR"
        title="Prepara, da la señal y acompaña la experiencia."
        aside={
          <Badge>
            <BookOpen size={13} /> Guía rápida
          </Badge>
        }
      />

      <section className="guide-intro panel">
        <Shield size={35} />
        <div>
          <h2>Flujo de inicio</h2>
          <ol className="instruction-list">
            <li>
              Elige de 3 a 6 jugadores y abre la ciudad con QR en el proyector.
            </li>
            <li>
              Al conectarse todo el grupo, desaparece el QR y se asignan los
              roles.
            </li>
            <li>
              El primer juego da 20 segundos de lectura y una cuenta de 5
              segundos. En los siguientes juegos, tú das la señal.
            </li>
            <li>
              Durante una ronda puedes pausar. Ajusta parámetros antes de
              iniciar o mientras está pausada.
            </li>
            <li>
              Para cortar sin puntos, usa Terminar. Después prepara o repite la
              experiencia.
            </li>
            <li>
              Al finalizar, usa Reiniciar toda la actividad en el mismo panel
              para recibir a otro grupo.
            </li>
          </ol>
        </div>
      </section>

      <div className="guide-columns">
        <section>
          <h2>Lo que debes recordar</h2>
          <ul className="plain-list">
            <li>
              La pantalla pública solo observa. Los roles y las acciones viven
              en cada terminal.
            </li>
            <li>
              La cuenta regresiva y el reloj vienen del servidor. Una pausa
              detiene ambos.
            </li>
            <li>
              La salida de un jugador no pausa al equipo. Conserva su rol y
              vuelve en el siguiente juego.
            </li>
            <li>
              Los resultados se calculan al cerrar cada fase; no hay feedback
              inmediato.
            </li>
          </ul>
          <blockquote>
            Da la señal cuando todos hayan leído. Observa las decisiones y deja
            que el equipo converse.
          </blockquote>

          <h2>Parámetros y metas</h2>
          <p className="help-text">
            Ritmo base: 8 minutos efectivos — Correos 2:30, Saturación 1:30,
            Identidad 2:00 y Recuperación 2:00. El panel permite ajustarlos.
          </p>
          <div className="guide-round-row">
            <Mail size={23} />
            <div>
              <h3>Correo · 2:30</h3>
              <p>
                Cada jugador puede enviar plantillas cada 30 segundos. El
                impostor necesita 3 correos maliciosos propios aceptados. Meta
                defensora: al menos 80% de precisión.
              </p>
            </div>
          </div>
          <div className="guide-round-row">
            <Waves size={23} />
            <div>
              <h3>Saturación · 1:30</h3>
              <p>
                Círculo azul: dejar pasar. Cruz naranja: tocar. Meta atacante:{" "}
                min(3, defensores) servicios fuera de línea. Meta defensora:
                menos de ese límite y al menos 70% de azules procesados.
              </p>
            </div>
          </div>
          <div className="guide-round-row">
            <Fingerprint size={23} />
            <div>
              <h3>Identidad · 2:00</h3>
              <p>
                Compara foto, 4 dígitos e icono. El pulso público se actualiza
                cada 10 segundos. Meta atacante: min(3, defensores) servicios
                comprometidos; meta defensora: al menos 70% de accesos legítimos
                autorizados.
              </p>
            </div>
          </div>
          <div className="guide-round-row">
            <LockKeyhole size={23} />
            <div>
              <h3>Recuperación · 2:00 y voto</h3>
              <p>
                Cada defensor descifra su parte con César −3. Con 2 o 3
                defensores forman la frase completa en 2 o 3 partes; con 4 o 5
                se conserva el formato histórico. Después, todos votan en
                privado.
              </p>
            </div>
          </div>
        </section>

        <aside className="panel practice-panel">
          <Badge tone="amber">PRÁCTICA · SIN SALA</Badge>
          <h2>Prueba una decisión.</h2>
          <div className="practice-mail">
            <span className="eyebrow">REMITENTE</span>
            <strong>{card.sender}</strong>
            <span className="eyebrow">ASUNTO</span>
            <p>{card.subject}</p>
          </div>
          <div className="decision-buttons">
            <button
              className="btn reject"
              onClick={() => setDecision(false)}
              disabled={decision !== null}
            >
              <X size={16} />
              Descartar
            </button>
            <button
              className="btn primary"
              onClick={() => setDecision(true)}
              disabled={decision !== null}
            >
              <Check size={16} />
              Aceptar
            </button>
          </div>
          {decision !== null && (
            <div className="practice-feedback">
              <b>
                {decision === card.safe
                  ? "Señal identificada."
                  : "Revisa la señal."}
              </b>
              <p>{card.explanation}</p>
              <button
                className="text-link"
                onClick={() => {
                  setPracticeIndex((practiceIndex + 1) % PRACTICE.length);
                  setDecision(null);
                }}
              >
                Otro ejemplo
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          <p className="help-text">La práctica no cambia una sala.</p>
        </aside>
      </div>

      <section className="panel reflection-panel">
        <span className="eyebrow">CIERRE</span>
        <h2>Conversen sobre las señales.</h2>
        <div className="reflection-questions">
          <p>¿Qué pista cambió una decisión?</p>
          <p>¿Qué pasó al bloquear tráfico legítimo?</p>
          <p>¿Qué diferencia de credencial costó más?</p>
        </div>
      </section>
    </main>
  );
}
