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

  if (challenge) {
    if (!roleVisible)
      return (
        <section className="panel recovery-card private-recovery-locked">
          <LockKeyhole size={38} />
          <h2>Tarea privada disponible</h2>
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
        <RecoveryProgress state={state} />
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
        <h2>Descifra tu fragmento</h2>
        {fragment?.altered && (
          <div className="private-cipher-alert" role="alert">
            <AlertTriangle size={22} />
            <div>
              <b>¡ALERTA! Tu clave de cifrado fue alterada.</b>
              <span>Descifra con la tabla o verifica la nueva clave.</span>
            </div>
          </div>
        )}
        <p className="cipher-hint">
          {fragment?.verifiedShift
            ? `Retrocede ${fragment.verifiedShift} letras.`
            : fragment?.altered
              ? "El texto usa otra clave. La tabla ya refleja el cambio."
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
            <b>Parte recibida</b>
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
        <RecoveryProgress state={state} />
      </section>

      <details className="panel cipher-reference">
        <summary>
          <LockKeyhole size={20} />
          Tabla César vigente
        </summary>
        <div className="alphabet-table">
          {letters.split("").map((letter, i) => (
            <div key={letter}>
              <b>{letter}</b>
              <span>↓</span>
              <strong>{letters[(i + 26 - (fragment?.shift ?? 3)) % 26]}</strong>
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

function RecoveryProgress({ state }: { state: PublicState }) {
  return (
    <div className="recovery-progress">
      <span>Partes recibidas</span>
      <b>
        {state.recovery.completed} / {state.recovery.total}
      </b>
      <div>
        <i
          style={{
            width: `${state.recovery.total ? (state.recovery.completed / state.recovery.total) * 100 : 0}%`,
          }}
        />
      </div>
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
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void game.act({ type: "vote", suspect, reason });
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
            Registrar voto
            <Send size={16} />
          </button>
        </form>
      )}
      <div className="vote-counter">
        {state.votesCount} de {state.playersCount} votos recibidos
      </div>
    </section>
  );
}
