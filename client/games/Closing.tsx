import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  KeyRound,
  LockKeyhole,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { PlayerState, PublicState } from "../../shared/types";
import type { GameConnection } from "../useGame";
import { Badge } from "../components/UI";
import {
  RestorationProgress,
  JudgmentTransition,
} from "../components/Restoration";

export function Recovery({
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
  const [answer, setAnswer] = useState("");
  const [target, setTarget] = useState("");
  const [trialShift, setTrialShift] = useState(3);
  const fragment = player.fragment;
  const challenge = player.recoveryChallenge;
  const active =
    state.stage === "playing" &&
    state.running &&
    !state.paused &&
    !game.busy &&
    game.connected;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const verificationPending = Boolean(
    fragment?.verificationUsed && fragment.verificationRemaining > 0,
  );
  const tableShift =
    fragment?.verifiedShift ??
    (fragment?.altered ? trialShift : (fragment?.shift ?? 3));

  if (challenge) {
    if (!roleVisible)
      return (
        <section className="panel recovery-card private-recovery-locked">
          <LockKeyhole size={38} />
          <h2>Tarea privada del protocolo</h2>
          <p>Abre “Mi rol secreto” para ver tu misión de recuperación.</p>
        </section>
      );
    return (
      <div className="recovery-layout">
        <section className="panel recovery-card impostor-recovery-card">
          <Badge tone="red">
            <ShieldAlert size={13} /> RETO PRIVADO
          </Badge>
          <h2>
            {challenge.solved
              ? "Interfiere una clave"
              : "Descifra para intervenir"}
          </h2>
          {!challenge.solved ? (
            <>
              <p className="cipher-hint">{challenge.hint}</p>
              <div className="cipher-box">
                <b>{challenge.cipher}</b>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void game.act({ type: "recovery:challenge-solve", answer });
                }}
              >
                <label>
                  Respuesta
                  <input
                    value={answer}
                    onChange={(event) =>
                      setAnswer(event.target.value.toUpperCase())
                    }
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={30}
                    disabled={!active}
                  />
                </label>
                <button
                  className="btn danger full"
                  disabled={!active || !answer.trim()}
                >
                  Resolver reto <Send size={16} />
                </button>
              </form>
            </>
          ) : challenge.sabotageUsed ? (
            <div className="solved-note">
              <CheckCircle2 size={24} />
              <b>Interferencia utilizada</b>
            </div>
          ) : challenge.targets.length ? (
            <>
              <p>
                Elige un fragmento pendiente. Su clave cambiará de César +3 a
                +5.
              </p>
              <label>
                Servicio objetivo
                <select
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  disabled={!active}
                >
                  <option value="">Selecciona un servicio</option>
                  {challenge.targets.map((candidate) => (
                    <option
                      key={candidate.department}
                      value={candidate.department}
                    >
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn danger full"
                disabled={!active || !target}
                onClick={() =>
                  void game.act({ type: "recovery:sabotage", target })
                }
              >
                Alterar clave una vez <ShieldAlert size={16} />
              </button>
            </>
          ) : (
            <p>No quedan fragmentos pendientes que puedas alterar.</p>
          )}
        </section>
        <RestorationProgress state={state} />
      </div>
    );
  }

  return (
    <div className="recovery-layout">
      <section className="panel recovery-card">
        <span className="eyebrow">
          {fragment?.verifiedShift
            ? `CÉSAR · −${fragment.verifiedShift} CONFIRMADO`
            : fragment?.altered
              ? "CLAVE ALTERADA"
              : `CÉSAR · −${fragment?.shift ?? 3}`}
        </span>
        <div className="large-shield">
          <KeyRound size={35} />
        </div>
        <h2>Recupera tu autorización</h2>
        <p className="help-text">
          Tu fragmento reconstruye una parte del protocolo de emergencia de
          Cancún.
        </p>
        {fragment?.altered && (
          <div className="private-cipher-alert" role="alert">
            <AlertTriangle size={22} />
            <div>
              <b>¡ALERTA! Tu clave de cifrado fue alterada.</b>
              <span>
                Prueba una clave candidata o espera 3 s para confirmarla.
              </span>
            </div>
          </div>
        )}
        <p className="cipher-hint">
          {fragment?.verifiedShift
            ? `Retrocede ${fragment.verifiedShift} letras.`
            : fragment?.altered
              ? "Deduce la clave probando opciones, o usa Verificar clave."
              : "Retrocede tres letras."}
        </p>
        <div className="cipher-box">
          <span className="eyebrow">
            {`FRAGMENTO ${fragment?.order || "—"}`}
          </span>
          <b>{fragment?.cipher || "EN ESPERA"}</b>
        </div>
        {fragment?.solved ? (
          <div className="solved-note">
            <CheckCircle2 size={24} />
            <b>Parte recibida · autorización validada</b>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void game.act({ type: "recovery:solve", answer });
            }}
          >
            <label>
              Fragmento descifrado
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value.toUpperCase())}
                placeholder="Escribe tu parte"
                maxLength={30}
                autoComplete="off"
                autoCapitalize="characters"
                disabled={!active || verificationPending}
              />
            </label>
            <button
              className="btn primary full"
              disabled={
                !active || verificationPending || answer.trim().length === 0
              }
            >
              Enviar fragmento
              <Send size={16} />
            </button>
          </form>
        )}
        {fragment?.altered && !fragment.verifiedShift && !fragment.solved && (
          <div className="shift-candidates" aria-label="Claves candidatas">
            <b>Elige una tabla de prueba</b>
            <div>
              {fragment.candidateShifts?.map((shift) => (
                <button
                  type="button"
                  key={shift}
                  className={trialShift === shift ? "selected" : ""}
                  aria-pressed={trialShift === shift}
                  onClick={() => setTrialShift(shift)}
                >
                  César −{shift}
                </button>
              ))}
            </div>
            <small>Ninguna opción está marcada como correcta.</small>
          </div>
        )}
        {fragment?.altered &&
          !fragment.verificationUsed &&
          !fragment.solved && (
            <button
              className="btn secondary full"
              disabled={!active}
              onClick={() => void game.act({ type: "recovery:verify" })}
            >
              <Clock3 size={16} /> Verificar clave (3 s)
            </button>
          )}
        {verificationPending && (
          <p className="verification-note">
            <Clock3 size={16} /> Verificando…{" "}
            {Math.ceil(fragment!.verificationRemaining)} s
          </p>
        )}
        {fragment?.verifiedShift && !fragment.solved && (
          <p className="verification-note">
            <CheckCircle2 size={16} /> Clave confirmada: César −
            {fragment.verifiedShift}.
          </p>
        )}
        <RestorationProgress state={state} />
      </section>

      <details className="panel cipher-reference">
        <summary>
          <LockKeyhole size={20} />
          {fragment?.verifiedShift
            ? `Tabla confirmada · César −${fragment.verifiedShift}`
            : fragment?.altered
              ? `Tabla de prueba · César −${tableShift}`
              : "Tabla César vigente"}
        </summary>
        <div className="alphabet-table">
          {letters.split("").map((letter, i) => (
            <div key={letter}>
              <b>{letter}</b>
              <span>↓</span>
              <strong>{letters[(i + 26 - tableShift) % 26]}</strong>
            </div>
          ))}
        </div>
        <p className="help-text">
          A–Z, sin ñ ni acentos. César sirve para aprender; no protege
          información moderna.
        </p>
      </details>
    </div>
  );
}

export function Voting({
  player,
  state,
  game,
}: {
  player: PlayerState;
  state: PublicState;
  game: GameConnection;
}) {
  const [suspect, setSuspect] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  if (state.judgment?.stage === "debate")
    return (
      <section className="panel vote-card">
        <h2>El juicio final</h2>
        <JudgmentTransition state={state} />
        <p>
          Conversen sobre señales y decisiones. El docente abrirá la votación
          cuando termine el debate.
        </p>
        <b>Tu rol permanece secreto.</b>
      </section>
    );

  return (
    <section className="panel vote-card">
      <Badge tone="amber">
        <Users size={13} /> VOTO PRIVADO
      </Badge>
      <h2>¿A quién sospechas?</h2>
      <p>No expulsa a nadie. Explica una señal.</p>
      {player.vote ? (
        <div className="solved-note">
          <CheckCircle2 size={28} />
          <h3>Voto registrado.</h3>
          <p>Espera el resultado.</p>
        </div>
      ) : player.voteEligible === false ? (
        <p>
          Tu terminal no estaba conectada al abrir la votación. Puedes observar
          el cierre; no se inventará un voto por ti.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirming(true);
          }}
        >
          <label>
            Dependencia sospechosa
            <select
              required
              value={suspect}
              onChange={(e) => setSuspect(e.target.value)}
            >
              <option value="">Selecciona una dependencia</option>
              {state.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Señal observada
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={160}
              required
              placeholder="¿Qué viste?"
              rows={3}
            />
          </label>
          <span className="help-text">{reason.length}/160</span>
          <button
            type="submit"
            className="btn primary full"
            disabled={
              !suspect ||
              reason.trim().length < 3 ||
              game.busy ||
              !game.connected
            }
          >
            Revisar voto
            <Send size={16} />
          </button>
          {confirming && (
            <div
              className="vote-confirm"
              role="alertdialog"
              aria-label="Confirmar voto definitivo"
            >
              <p>
                Votar por{" "}
                {state.departments.find((d) => d.id === suspect)?.name}. No
                podrás cambiarlo después.
              </p>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setConfirming(false)}
              >
                Seguir pensando
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={
                  game.busy ||
                  !game.connected ||
                  !suspect ||
                  reason.trim().length < 3
                }
                onClick={() => void game.act({ type: "vote", suspect, reason })}
              >
                Confirmar voto definitivo
              </button>
            </div>
          )}
        </form>
      )}
      <div className="vote-counter">
        {state.votesCount} de{" "}
        {state.judgment?.votesExpected ?? state.playersCount} votos recibidos
      </div>
    </section>
  );
}
