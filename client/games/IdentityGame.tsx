import { useEffect, useRef, useState } from "react";
import {
  Check,
  Circle,
  Fingerprint,
  Hexagon,
  PhoneIncoming,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Triangle,
  X,
} from "lucide-react";
import type {
  Credential,
  DossierKey,
  IdentityAlteration,
  IdentityEvent,
  PlayerState,
  PublicState,
} from "../../shared/types";
import { IDENTITY_EVENT } from "../../shared/identityCatalog";
import type { GameConnection } from "../useGame";
import { Badge } from "../components/UI";
import { Portrait } from "../components/Portrait";
import SyntheticVoice from "../components/SyntheticVoice";

// Compatibilidad: el retrato ilustrado sustituye al avatar simple anterior.
export function Avatar({ value }: { value: number }) {
  return <Portrait value={value} />;
}

// Margen para que consultar el registro no deje la decisión sin tiempo.
const VERIFY_MIN_MS = 3_000;

export function CredentialCard({
  credential,
  reference = false,
}: {
  credential: Credential;
  reference?: boolean;
}) {
  const Symbol = [Hexagon, Triangle, Circle, Square][credential.symbol % 4];
  return (
    <div className={`credential-card ${reference ? "reference" : ""}`}>
      <div className="credential-top">
        <ShieldCheck size={15} />
        <span>
          {reference ? "CREDENCIAL OFICIAL" : "CREDENCIAL PRESENTADA"}
        </span>
      </div>
      <Portrait value={credential.avatar} />
      {credential.name && (
        <b className="credential-name" data-field="name">
          {credential.name}
        </b>
      )}
      {(credential.employeeId || credential.service) && (
        <span className="credential-meta" data-field="employee">
          {[credential.employeeId, credential.service]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
      {(credential.clearance || credential.validity) && (
        <div className="credential-chips">
          {credential.clearance && (
            <span className="chip level" data-field="level">
              NIVEL {credential.clearance}
            </span>
          )}
          {credential.validity && (
            <span className="chip validity" data-field="validity">
              VIGENTE {credential.validity}
            </span>
          )}
        </div>
      )}
      <span className="eyebrow">FOLIO</span>
      <strong data-field="code">{credential.code}</strong>
      <div className="credential-permission">
        <Symbol size={21} />
        <span>ICONO DE ACCESO</span>
      </div>
    </div>
  );
}

const ALTERATIONS: Array<{ id: IdentityAlteration; label: string }> = [
  { id: "avatar", label: "Cambiar foto" },
  { id: "code", label: "Cambiar folio" },
  { id: "name", label: "Cambiar nombre" },
  { id: "level", label: "Cambiar nivel" },
  { id: "validity", label: "Cambiar vigencia" },
  { id: "symbol", label: "Cambiar icono" },
  { id: "none", label: "Enviar sin cambio" },
];

export function IdentityEventBanner({
  event,
  withAudio = false,
}: {
  event: IdentityEvent;
  withAudio?: boolean;
}) {
  // Se lee abierto al llegar y se pliega solo para no empujar los botones
  // mientras corre la tarjeta; quien quiera volver a leerlo lo abre a mano.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? event.remaining > 8;
  return (
    <section
      className="identity-event"
      role="status"
      aria-label="Comunicado institucional"
    >
      <details
        open={open}
        onToggle={(toggle) => setManual(toggle.currentTarget.open)}
      >
        <summary className="identity-event-head">
          <span className="identity-event-icon">
            <PhoneIncoming size={20} />
          </span>
          <div>
            <span className="eyebrow">COMUNICADO URGENTE</span>
            <b>{event.speaker}</b>
          </div>
          <i className="voice-bars" aria-hidden="true">
            <u />
            <u />
            <u />
            <u />
            <u />
          </i>
        </summary>
        <blockquote>{event.transcript}</blockquote>
        {withAudio && <SyntheticVoice src={IDENTITY_EVENT.audioSrc} />}
        <small>
          <Sparkles size={13} /> {IDENTITY_EVENT.notice}
        </small>
      </details>
    </section>
  );
}

export default function IdentityGame({
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
  const [alteration, setAlteration] = useState<IdentityAlteration>("avatar");
  const active =
    state.stage === "playing" &&
    state.running &&
    !state.paused &&
    !game.busy &&
    !player.blocked &&
    game.connected;
  const card = player.card;
  const seconds = card
    ? Math.max(0, Math.ceil((card.expires - state.clock) / 1000))
    : 0;
  const verification = card?.verification;
  const consulting = !!verification?.pending;
  const verifiesLeft = player.identityVerificationsRemaining ?? 0;
  const canVerify =
    active &&
    !!card &&
    !verification &&
    verifiesLeft > 0 &&
    card.expires - state.clock >= VERIFY_MIN_MS;
  const paceStage = Math.min(
    2,
    Math.floor((state.clock / Math.max(1, state.duration * 1000)) * 3),
  );
  const pace = ["RITMO INICIAL", "RITMO ÁGIL", "RITMO CRÍTICO"][paceStage];
  const event = state.identity?.event;
  const challenge = player.identityChallenge;
  const advancedReady =
    !!challenge?.advancedAvailable && !challenge.advancedUsed;
  const agile = paceStage >= 1;

  // La evidencia empuja los botones hacia abajo: mantenerlos a la vista.
  const decisions = useRef<HTMLDivElement>(null);
  const verificationStep = verification
    ? `${card?.id}:${verification.pending ? "pending" : "ready"}`
    : "";
  useEffect(() => {
    const element = decisions.current;
    if (!verificationStep || !element) return;
    if (element.getBoundingClientRect().bottom > window.innerHeight)
      element.scrollIntoView({
        block: "end",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth",
      });
  }, [verificationStep]);

  const verify = () => {
    if (card && canVerify)
      void game.act({ type: "identity:verify", cardId: card.id });
  };
  const verifyLabel = consulting
    ? "Consultando…"
    : verification
      ? "Verificada"
      : `Verificar · ${verifiesLeft}`;

  return (
    <div className="game-layout">
      <section className="panel identity-game">
        <div className="minor-heading">
          <div>
            <span className={`mail-pressure identity-pace p${paceStage}`}>
              {pace}
            </span>
            <h2>
              <Fingerprint size={21} />
              Control de acceso
            </h2>
          </div>
          <span className="pending-count">{player.pendingCards} en espera</span>
        </div>
        {event && <IdentityEventBanner event={event} withAudio />}
        {card ? (
          <>
            <div className="identity-status">
              {card.context && (
                <p
                  className={`request-context ${card.context.urgent ? "urgent" : ""}`}
                  data-field="context"
                >
                  <span>SOLICITUD</span> {card.context.label}
                </p>
              )}
              <div className="credential-timer">
                <span>TIEMPO</span>
                <b className={seconds <= 3 ? "red" : ""}>{seconds} s</b>
              </div>
            </div>
            <div
              className="credential-pair"
              key={card.id}
              data-request-id={card.id}
            >
              <CredentialCard credential={card.reference} reference />
              <CredentialCard credential={card.presented} />
            </div>
            {verification &&
              (verification.pending ? (
                <section
                  className="registry-panel pending"
                  role="status"
                  aria-live="polite"
                >
                  <div>
                    <Search size={18} />
                    <b>Consultando el registro…</b>
                  </div>
                  <span className="registry-progress">
                    <i
                      style={{
                        width: `${Math.round(Math.min(1, Math.max(0, 1 - verification.remaining / 1.5)) * 100)}%`,
                      }}
                    />
                  </span>
                </section>
              ) : (
                <section className="registry-panel" role="status">
                  <div>
                    <Search size={18} />
                    <b>{verification.heading}</b>
                  </div>
                  <dl>
                    {verification.evidence?.map((line) => (
                      <div key={line.label}>
                        <dt>{line.label}</dt>
                        <dd>{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <small>El registro informa; tú decides.</small>
                </section>
              ))}
            <div
              className="decision-buttons mail-decisions identity-decisions"
              ref={decisions}
            >
              <button
                className="btn reject"
                disabled={!active || consulting}
                onClick={() =>
                  void game.act({
                    type: "identity:decide",
                    cardId: card.id,
                    accept: false,
                  })
                }
              >
                <X size={20} />
                No permitir
              </button>
              <button
                className="btn inspect"
                disabled={!canVerify}
                onClick={verify}
                aria-label={`Verificar identidad, ${verifiesLeft} restantes`}
              >
                <Search size={20} />
                {verifyLabel}
              </button>
              <button
                className="btn primary"
                disabled={!active || consulting}
                onClick={() =>
                  void game.act({
                    type: "identity:decide",
                    cardId: card.id,
                    accept: true,
                  })
                }
              >
                <Check size={20} />
                Permitir
              </button>
            </div>
            {!verification &&
              verifiesLeft > 0 &&
              card.expires - state.clock < VERIFY_MIN_MS && (
                <p className="help-text">
                  Quedan pocos segundos: decide con lo que ves.
                </p>
              )}
          </>
        ) : (
          <div className="empty-game">
            <Fingerprint size={45} />
            <h3>
              {player.blocked ? "Servicio comprometido" : "Sin solicitudes"}
            </h3>
            <p>
              {player.blocked
                ? "Espera la siguiente ronda."
                : "Llegará una tarjeta."}
            </p>
          </div>
        )}
        <div className="reference-box identity-guide">
          <span className="eyebrow">GUÍA DE VERIFICACIÓN</span>
          <p>
            Una foto convincente no prueba identidad. Compara nombre, folio,
            nivel y vigencia; si dudas, Verificar: te quedan {verifiesLeft}{" "}
            consulta{verifiesLeft === 1 ? "" : "s"}.
          </p>
        </div>
        {roleVisible && player.role === "impostor" && (
          <details className="optional-action private-tip">
            <summary>
              Enviar solicitud
              {advancedReady && (
                <span className="advanced-ready"> · ¡avanzada lista!</span>
              )}
            </summary>
            <div className="optional-action-content">
              <label>
                Alteración
                <select
                  value={alteration}
                  onChange={(e) =>
                    setAlteration(e.target.value as IdentityAlteration)
                  }
                >
                  {ALTERATIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn secondary full"
                disabled={!active || player.identityCooldown > 0}
                onClick={() =>
                  void game.act({ type: "identity:send", alteration })
                }
              >
                <Send size={16} />
                {player.identityCooldown > 0
                  ? `Disponible en ${Math.ceil(player.identityCooldown)} s`
                  : "Enviar solicitud"}
              </button>
              <p className="help-text">Una solicitud cada 10 segundos.</p>
              {challenge && (
                <section className="dossier" aria-label="Expediente privado">
                  <Badge tone="red">EXPEDIENTE PRIVADO</Badge>
                  {challenge.solved ? (
                    <>
                      <p>
                        {challenge.advancedUsed
                          ? "Suplantación avanzada enviada. Ya no tienes otra."
                          : "Expediente resuelto: tu suplantación avanzada está lista. Coincide en todo lo visible; solo el registro la delata."}
                      </p>
                      {!challenge.advancedUsed && (
                        <button
                          className="btn secondary full"
                          disabled={
                            !active || !agile || player.identityCooldown > 0
                          }
                          onClick={() =>
                            void game.act({ type: "identity:send-advanced" })
                          }
                        >
                          <Sparkles size={16} />
                          {!agile
                            ? "Se habilita en el ritmo ágil"
                            : player.identityCooldown > 0
                              ? `Disponible en ${Math.ceil(player.identityCooldown)} s`
                              : "Enviar suplantación avanzada"}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p>
                        Un dato del borrador no coincide con el registro
                        filtrado. Señálalo para afinar la suplantación.
                      </p>
                      <div className="dossier-grid">
                        <span className="eyebrow">REGISTRO</span>
                        <span className="eyebrow">BORRADOR</span>
                        {challenge.record.map((field, index) => (
                          <div className="dossier-row" key={field.key}>
                            <small>{field.label}</small>
                            <b>{field.value}</b>
                            <b>{challenge.draft[index]?.value}</b>
                          </div>
                        ))}
                      </div>
                      <div
                        className="dossier-answers"
                        role="group"
                        aria-label="¿Qué dato no coincide?"
                      >
                        {challenge.draft.map((field) => (
                          <button
                            key={field.key}
                            type="button"
                            className="btn secondary"
                            disabled={!active || challenge.retryIn > 0}
                            onClick={() =>
                              void game.act({
                                type: "identity:challenge-solve",
                                answer: field.key as DossierKey,
                              })
                            }
                          >
                            {field.label}
                          </button>
                        ))}
                      </div>
                      {challenge.retryIn > 0 && (
                        <p className="help-text">
                          Reintento en {Math.ceil(challenge.retryIn)} s.
                        </p>
                      )}
                    </>
                  )}
                </section>
              )}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
