import { useState } from "react";
import { CheckCircle2, KeyRound, LockKeyhole, Send, Users } from "lucide-react";
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
  const [decoyDone, setDecoyDone] = useState(false);
  const fragment = player.fragment;
  const solved = player.decoy ? decoyDone : fragment?.solved;
  const active =
    state.stage === "playing" &&
    state.running &&
    !state.paused &&
    !game.busy &&
    game.connected;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  return (
    <div className="recovery-layout">
      <section className="panel recovery-card">
        <span className="eyebrow">CÉSAR · −3</span>
        <div className="large-shield">
          <KeyRound size={35} />
        </div>
        <h2>Descifra tu fragmento</h2>
        <p className="cipher-hint">Retrocede tres letras.</p>
        <div className="cipher-box">
          <span className="eyebrow">
            {player.decoy ? "FRAGMENTO" : `FRAGMENTO ${fragment?.order || "—"}`}
          </span>
          <b>{player.decoy ? "UHFXSHUD" : fragment?.cipher || "EN ESPERA"}</b>
        </div>
        {solved ? (
          <div className="solved-note">
            <CheckCircle2 size={24} />
            <b>Parte recibida</b>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void game
                .act({ type: "recovery:solve", answer })
                .then((result) => {
                  if (result.ok && player.decoy) setDecoyDone(true);
                });
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
                disabled={!active}
              />
            </label>
            <button
              className="btn primary full"
              disabled={!active || answer.trim().length === 0}
            >
              Enviar fragmento
              <Send size={16} />
            </button>
          </form>
        )}
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
        {roleVisible && player.decoy && (
          <div className="private-tip">
            <Badge tone="red">PRIVADO</Badge>
            <p>Tu terminal es un señuelo.</p>
          </div>
        )}
      </section>

      <details className="panel cipher-reference">
        <summary>
          <LockKeyhole size={20} />
          Tabla César
        </summary>
        <div className="alphabet-table">
          {letters.split("").map((letter, i) => (
            <div key={letter}>
              <b>{letter}</b>
              <span>↓</span>
              <strong>{letters[(i + 23) % 26]}</strong>
            </div>
          ))}
        </div>
        <p className="help-text">A–Z, sin ñ ni acentos.</p>
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
