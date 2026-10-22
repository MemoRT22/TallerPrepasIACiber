import { useState } from "react";
import {
  Check,
  Circle,
  Fingerprint,
  Hexagon,
  Send,
  ShieldCheck,
  Square,
  Triangle,
  X,
} from "lucide-react";
import type { Credential, PlayerState, PublicState } from "../../shared/types";
import type { GameConnection } from "../useGame";
import { Badge } from "../components/UI";

const COLORS = [
  "#2788e8",
  "#f58232",
  "#76a9df",
  "#efaa74",
  "#6c91c8",
  "#e48b54",
];

export function Avatar({ value }: { value: number }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className="credential-avatar"
      role="img"
      aria-label={`Foto ${value + 1}`}
      style={{ backgroundColor: "#ffffff" }}
    >
      <rect width="80" height="80" rx="9" fill="#ffffff" />
      <path d="M12 80c0-24 56-24 56 0" fill={COLORS[value % 6]} />
      <rect x="34" y="48" width="12" height="13" rx="4" fill="#d5b799" />
      <ellipse cx="40" cy="34" rx={16 + (value % 3)} ry="20" fill="#d5b799" />
      <path
        d={
          value % 2
            ? "M23 29Q17 5 40 10Q62 5 60 31L47 20L25 31Z"
            : "M22 30Q19 8 41 10Q66 10 58 31L43 19L23 30Z"
        }
        fill={
          value % 3 === 0 ? "#123e70" : value % 3 === 1 ? "#805a42" : "#243b5b"
        }
      />
      <circle cx="34" cy="34" r="1.6" fill="#123e70" />
      <circle cx="46" cy="34" r="1.6" fill="#123e70" />
      <path
        d="M35 45q5 3 10 0"
        fill="none"
        stroke="#a77466"
        strokeWidth="1.5"
      />
      {value > 2 && (
        <path
          d="M28 31h11v7H28Zm13 0h11v7H41ZM39 33h2"
          fill="none"
          stroke="#123e70"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

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
      <span className="eyebrow">FOTO</span>
      <Avatar value={credential.avatar} />
      <span className="eyebrow">CÓDIGO</span>
      <strong>{credential.code}</strong>
      <div className="credential-permission">
        <Symbol size={21} />
        <span>ICONO DE ACCESO</span>
      </div>
    </div>
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
  const [alteration, setAlteration] = useState<
    "none" | "avatar" | "code" | "symbol"
  >("avatar");
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

  return (
    <div className="game-layout">
      <section className="panel identity-game">
        <div className="minor-heading">
          <h2>
            <Fingerprint size={21} />
            Control de acceso
          </h2>
          <span className="pending-count">{player.pendingCards} en espera</span>
        </div>
        <p className="game-instruction">Compara foto, 4 dígitos e icono.</p>
        {card ? (
          <>
            <div className="credential-timer">
              <span>TIEMPO</span>
              <b className={seconds <= 3 ? "red" : ""}>{seconds} s</b>
            </div>
            <div
              className="credential-pair"
              key={card.id}
              data-request-id={card.id}
            >
              <CredentialCard credential={card.reference} reference />
              <CredentialCard credential={card.presented} />
            </div>
            <div className="decision-buttons">
              <button
                className="btn reject"
                disabled={!active}
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
                className="btn primary"
                disabled={!active}
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
        <p className="help-text">
          Si foto, código e icono son iguales, permite. Si cambia uno, bloquea.
        </p>
        {roleVisible && player.role === "impostor" && (
          <details className="optional-action private-tip">
            <summary>Enviar solicitud</summary>
            <div className="optional-action-content">
              <label>
                Alteración
                <select
                  value={alteration}
                  onChange={(e) =>
                    setAlteration(e.target.value as typeof alteration)
                  }
                >
                  <option value="avatar">Cambiar foto</option>
                  <option value="code">Cambiar dígitos</option>
                  <option value="symbol">Cambiar icono</option>
                  <option value="none">Enviar sin cambio</option>
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
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
