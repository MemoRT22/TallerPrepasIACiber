import { useEffect, useState } from "react";
import {
  Check,
  Inbox,
  Landmark,
  Mail,
  Search,
  Send,
  ShieldCheck,
  UserRoundSearch,
  X,
  Zap,
} from "lucide-react";
import type { PlayerState, PublicState, Template } from "../../shared/types";
import type { GameConnection } from "../useGame";
import { Badge } from "../components/UI";

type MailMode = Template["tactic"];
const TACTICS: Array<{ id: MailMode; label: string; icon: typeof Zap }> = [
  { id: "official", label: "Cobertura", icon: ShieldCheck },
  { id: "urgency", label: "Urgencia", icon: Zap },
  { id: "authority", label: "Autoridad", icon: Landmark },
  { id: "impersonation", label: "Suplantación", icon: UserRoundSearch },
];

export default function MailGame({
  player,
  state,
  game,
  roleVisible = false,
}: {
  player: PlayerState;
  state: PublicState;
  game: GameConnection;
  roleVisible?: boolean;
}) {
  const [target, setTarget] = useState("");
  const [template, setTemplate] = useState("");
  const [mailMode, setMailMode] = useState<MailMode>("official");
  useEffect(() => {
    if (!roleVisible) {
      setTemplate("");
      setMailMode("official");
    }
  }, [roleVisible]);

  const privateSend = roleVisible && player.role === "impostor";
  const effectiveMode: MailMode = privateSend ? mailMode : "official";
  const visibleTemplates = player.templates.filter(
    (candidate) =>
      candidate.kind ===
        (effectiveMode === "official" ? "official" : "attack") &&
      candidate.tactic === effectiveMode,
  );
  const selectedTemplate = visibleTemplates.find(
    (candidate) => candidate.id === template,
  );
  const card = player.mail[0];
  const active =
    state.stage === "playing" &&
    state.running &&
    !state.paused &&
    !game.busy &&
    game.connected;
  const canSend = active && state.remaining > 20 && player.mailCooldown <= 0;
  const progress = state.duration ? state.clock / 1000 / state.duration : 0;
  const pressure =
    progress < 1 / 3
      ? { label: "RECONOCIMIENTO", tone: "calm" }
      : progress < 2 / 3
        ? { label: "ANÁLISIS", tone: "alert" }
        : { label: "PRESIÓN FINAL", tone: "critical" };

  const classify = (accept: boolean) => {
    if (card && active)
      void game.act({ type: "mail:classify", cardId: card.id, accept });
  };
  const inspect = () => {
    if (
      card &&
      active &&
      !card.inspection &&
      player.mailInspectionsRemaining > 0
    )
      void game.act({ type: "mail:inspect", cardId: card.id });
  };

  return (
    <div className="game-layout">
      <section className="panel mail-game incident-desk">
        <div className="minor-heading">
          <div>
            <span className={`mail-pressure ${pressure.tone}`}>
              {pressure.label}
            </span>
            <h2>
              <Inbox size={21} /> Bandeja comprometida
            </h2>
          </div>
          <span className="pending-count">{player.mail.length} pendientes</span>
        </div>
        <p className="game-instruction">
          Analiza la historia completa. Un dominio conocido no garantiza nada.
        </p>
        {card ? (
          <article className="email-card investigation-card">
            <div className="email-card-top">
              <span className="email-avatar">
                <Mail size={25} />
              </span>
              <span className="mono text-dim">CASO ACTIVO</span>
              <span className="email-indicator" />
            </div>
            <span className="eyebrow">REMITENTE</span>
            <h3 className="email-sender">{card.senderName}</h3>
            <p className="email-address">{card.sender}</p>
            <span className="eyebrow">ASUNTO</span>
            <p className="email-subject">{card.subject}</p>
            <p className="email-preview">{card.preview}</p>
            {card.context && (
              <p className="email-context">
                <b>Contexto:</b> {card.context}
              </p>
            )}
            {card.inspection && (
              <section className="inspection-result" role="status">
                <div>
                  <Search size={18} />
                  <b>{card.inspection.heading}</b>
                </div>
                <ul>
                  {card.inspection.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <small>
                  La evidencia orienta; tú decides la clasificación.
                </small>
              </section>
            )}
          </article>
        ) : (
          <div className="empty-game">
            <Inbox size={45} />
            <h3>Bandeja al día.</h3>
            <p>
              {state.remaining <= 20
                ? "Ya no llegan mensajes."
                : "Espera el próximo caso."}
            </p>
          </div>
        )}
        <div className="decision-buttons mail-decisions">
          <button
            disabled={!card || !active}
            className="btn reject"
            onClick={() => classify(false)}
          >
            <X size={20} /> Descartar
          </button>
          <button
            disabled={
              !card ||
              !active ||
              !!card.inspection ||
              player.mailInspectionsRemaining <= 0
            }
            className="btn inspect"
            onClick={inspect}
          >
            <Search size={20} />
            {card?.inspection
              ? "Inspeccionado"
              : `Inspeccionar · ${player.mailInspectionsRemaining}`}
          </button>
          <button
            disabled={!card || !active}
            className="btn primary"
            onClick={() => classify(true)}
          >
            <Check size={20} /> Aceptar
          </button>
        </div>
        <div className="reference-box investigation-guide">
          <span className="eyebrow">GUÍA DE INVESTIGACIÓN</span>
          <p>
            Compara solicitud, procedimiento, folios, destino y contexto. No
            decidas por una sola señal.
          </p>
        </div>
      </section>

      <details className="panel optional-action send-panel">
        <summary>Enviar una comunicación</summary>
        <div className="optional-action-content">
          <label>
            Destino
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">Selecciona una dependencia</option>
              {state.departments
                .filter((department) => department.id !== player.department)
                .map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
            </select>
          </label>
          {privateSend && (
            <div
              className="hacker-mail-kind tactic-picker"
              role="group"
              aria-label="Estrategia privada"
            >
              <span className="eyebrow">ESTRATEGIA PRIVADA</span>
              <div>
                {TACTICS.map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    className={`btn secondary ${mailMode === id ? "selected" : ""}`}
                    aria-pressed={mailMode === id}
                    onClick={() => {
                      setMailMode(id);
                      setTemplate("");
                    }}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label>
            Plantilla
            <select
              value={selectedTemplate ? template : ""}
              onChange={(event) => setTemplate(event.target.value)}
            >
              <option value="">Selecciona un mensaje</option>
              {visibleTemplates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.subject}
                </option>
              ))}
            </select>
          </label>
          {selectedTemplate && (
            <div className="template-preview">
              <span className="eyebrow">VISTA PREVIA</span>
              <b>{selectedTemplate.senderName}</b>
              <span>{selectedTemplate.sender}</span>
              <strong>{selectedTemplate.subject}</strong>
              <p>{selectedTemplate.preview}</p>
            </div>
          )}
          <button
            className="btn secondary full"
            disabled={!target || !selectedTemplate || !canSend}
            onClick={() => {
              if (canSend && target && selectedTemplate)
                void game.act({
                  type: "mail:send",
                  templateId: selectedTemplate.id,
                  target,
                });
            }}
          >
            <Send size={16} />
            {state.remaining <= 20
              ? "Envíos cerrados"
              : player.mailCooldown > 0
                ? `Disponible en ${Math.ceil(player.mailCooldown)} s`
                : "Enviar comunicación"}
          </button>
          <p className="help-text">
            Un envío cada {player.mailSendCooldown} segundos.
          </p>
          {privateSend && (
            <div className="private-tip">
              <Badge tone="red">GUÍA PRIVADA</Badge>
              <p>
                Alterna cobertura con urgencia, autoridad o suplantación. Las
                plantillas son ficticias y no recibirás confirmación inmediata
                del resultado. Tu meta sigue siendo tres aceptaciones.
              </p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
