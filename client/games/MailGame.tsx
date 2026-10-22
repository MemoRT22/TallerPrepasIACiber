import { useEffect, useState } from "react";
import { Check, Inbox, Mail, Send, X } from "lucide-react";
import type { PlayerState, PublicState } from "../../shared/types";
import type { GameConnection } from "../useGame";
import { Badge } from "../components/UI";

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
  const [mailKind, setMailKind] = useState<"legit" | "malicious">("legit");
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [drag, setDrag] = useState(0);
  useEffect(() => {
    if (!roleVisible) {
      setTemplate("");
      setMailKind("legit");
    }
  }, [roleVisible]);
  const privateSend = roleVisible && player.role === "impostor";
  const visibleTemplates = player.templates.filter((t) => {
    const safe =
      t.sender.endsWith("@cancun.example") &&
      !t.subject.toLowerCase().includes("contraseña");
    return privateSend && mailKind === "malicious" ? !safe : safe;
  });
  const selectedTemplate = visibleTemplates.find((t) => t.id === template);
  const card = player.mail[0];
  const active =
    state.stage === "playing" &&
    state.running &&
    !state.paused &&
    !game.busy &&
    game.connected;
  const canSend = active && state.remaining > 20 && player.mailCooldown <= 0;

  const classify = (accept: boolean) => {
    if (card && active)
      void game.act({ type: "mail:classify", cardId: card.id, accept });
  };

  return (
    <div className="game-layout">
      <section className="panel mail-game">
        <div className="minor-heading">
          <h2>
            <Inbox size={21} />
            Bandeja
          </h2>
          <span className="pending-count">{player.mail.length} pendientes</span>
        </div>
        <p className="game-instruction">Revisa remitente y asunto.</p>
        {card ? (
          <div
            className="email-card"
            style={{
              transform: `translateX(${drag}px) rotate(${drag / 25}deg)`,
            }}
            onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
            onTouchMove={(e) => {
              if (touchStart !== null)
                setDrag(
                  Math.max(
                    -90,
                    Math.min(90, e.touches[0].clientX - touchStart),
                  ),
                );
            }}
            onTouchEnd={() => {
              if (Math.abs(drag) > 55) classify(drag > 0);
              setTouchStart(null);
              setDrag(0);
            }}
          >
            <div className="email-card-top">
              <span className="email-avatar">
                <Mail size={25} />
              </span>
              <span className="mono text-dim">MENSAJE</span>
              <span className="email-indicator" />
            </div>
            <span className="eyebrow">REMITENTE</span>
            <h3 className="email-sender">{card.sender}</h3>
            <span className="eyebrow">ASUNTO</span>
            <p className="email-subject">{card.subject}</p>
          </div>
        ) : (
          <div className="empty-game">
            <Inbox size={45} />
            <h3>Bandeja al día.</h3>
            <p>
              {state.remaining <= 20
                ? "Ya no llegan mensajes."
                : "Espera el próximo mensaje."}
            </p>
          </div>
        )}
        <div className="decision-buttons">
          <button
            disabled={!card || !active}
            className="btn reject"
            onClick={() => classify(false)}
          >
            <X size={20} />
            Descartar
          </button>
          <button
            disabled={!card || !active}
            className="btn primary"
            onClick={() => classify(true)}
          >
            <Check size={20} />
            Aceptar
          </button>
        </div>
        <div className="reference-box">
          <span className="eyebrow">REFERENCIA</span>
          <b>Remitentes oficiales: @cancun.example</b>
          <p>Nunca compartas una contraseña.</p>
        </div>
      </section>

      <details className="panel optional-action send-panel">
        <summary>Enviar un correo</summary>
        <div className="optional-action-content">
          <label>
            Destino
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Selecciona una dependencia</option>
              {state.departments
                .filter((d) => d.id !== player.department)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
          {privateSend && (
            <div
              className="hacker-mail-kind"
              role="group"
              aria-label="Tipo de correo privado"
            >
              <span className="eyebrow">TIPO DE CORREO</span>
              <div>
                <button
                  type="button"
                  className={`btn secondary ${mailKind === "legit" ? "selected" : ""}`}
                  aria-pressed={mailKind === "legit"}
                  onClick={() => {
                    setMailKind("legit");
                    setTemplate("");
                  }}
                >
                  Correcto
                </button>
                <button
                  type="button"
                  className={`btn secondary ${mailKind === "malicious" ? "selected" : ""}`}
                  aria-pressed={mailKind === "malicious"}
                  onClick={() => {
                    setMailKind("malicious");
                    setTemplate("");
                  }}
                >
                  Malicioso
                </button>
              </div>
            </div>
          )}
          <label>
            Plantilla
            <select
              value={selectedTemplate ? template : ""}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="">Selecciona un mensaje</option>
              {visibleTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.subject}
                </option>
              ))}
            </select>
          </label>
          {selectedTemplate && (
            <div className="template-preview">
              <span className="eyebrow">REMITENTE</span>
              <b>{selectedTemplate.sender}</b>
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
                : "Enviar correo"}
          </button>
          <p className="help-text">Un envío cada 20 segundos.</p>
          {roleVisible && player.role === "impostor" && (
            <div className="private-tip">
              <Badge tone="red">GUÍA PRIVADA</Badge>
              <p>
                Elige Correcto o Malicioso y envíalo a otro servicio. Mezcla
                ambos para ocultarte. Logra que acepten tres correos maliciosos
                tuyos.
              </p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
