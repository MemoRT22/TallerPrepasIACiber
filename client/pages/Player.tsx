import { useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Shield } from "lucide-react";
import { DEPARTMENTS, PHASE_LABELS } from "../../shared/types";
import type { GameConnection } from "../useGame";
import { DepartmentIcon, ErrorNote, Scores, Timer } from "../components/UI";
import Briefing from "../components/Briefing";
import MissionTransition from "../components/MissionTransition";
import EducationalDebrief from "../components/EducationalDebrief";
import MailGame from "../games/MailGame";
import DdosGame from "../games/DdosGame";
import IdentityGame from "../games/IdentityGame";
import { Recovery, Voting } from "../games/Closing";
import Finale from "../components/Finale";
import {
  RestorationProgress,
  RestorationOutcome,
} from "../components/Restoration";
export default function Player({
  game,
  code: inviteCode,
  slot,
}: {
  game: GameConnection;
  code?: string;
  slot?: number;
}) {
  const [code, setCode] = useState(
    inviteCode || new URLSearchParams(location.search).get("code") || "",
  );
  const [name, setName] = useState("");
  const [roleShown, setRoleShown] = useState(false);
  const [invite] = useState(
    new URLSearchParams(location.hash.slice(1)).get("invite") || "",
  );
  const state = game.snapshot?.public,
    player = game.snapshot?.player;
  const dep = DEPARTMENTS.find((d) => d.id === player?.department);
  const result = state?.results.find((r) => r.phase === state.phase);
  return (
    <main className="simple-player">
      <ErrorNote error={game.error} close={() => game.setError("")} />
      {game.left ? (
        <section className="panel terminal-finish" role="status">
          <Shield size={36} />
          <h1>Saliste de tu terminal</h1>
          <p>El equipo sigue jugando. Guardamos tu servicio y tu rol.</p>
          <button className="btn primary full" onClick={game.reconnect}>
            Reconectarme
          </button>
          <p className="help-text">
            Si el juego actual sigue en marcha, te reincorporas en el siguiente.
          </p>
        </section>
      ) : !state || !player ? (
        <section className="panel simple-join">
          <span className="briefing-icon">
            <Shield size={35} />
          </span>
          <span className="eyebrow">TU TERMINAL</span>
          <h1>Protege tu servicio</h1>
          {new URLSearchParams(location.search).get("reset") === "1" && (
            <p role="status">
              El administrador reinició la actividad. Ingresa de nuevo para el
              siguiente grupo.
            </p>
          )}
          <p>Escribe tu nombre para entrar a la experiencia.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void game
                .request("join", {
                  code,
                  name: name.trim(),
                  ...(slot ? { slot, invite } : {}),
                })
                .then((r) => {
                  if (r.ok)
                    history.replaceState(
                      null,
                      "",
                      location.pathname + location.search,
                    );
                });
            }}
          >
            {!inviteCode && (
              <label>
                Código de acceso
                <input
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  minLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="0000"
                  required
                />
              </label>
            )}
            <label>
              Tu nombre o apodo
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={24}
                autoComplete="off"
                placeholder="¿Cómo te llamas?"
                required
              />
            </label>
            <button
              className="btn primary full"
              disabled={
                game.busy ||
                !game.connected ||
                code.length !== 4 ||
                name.trim().length < 2
              }
            >
              Entrar a jugar
              <ArrowRight size={19} />
            </button>
          </form>
          <p className="help-text">Usa solo tu pantalla. Tu rol es secreto.</p>
          {game.session && (
            <button className="text-button" onClick={game.forget}>
              Volver a entrar
            </button>
          )}
        </section>
      ) : (
        <>
          <header className="simple-terminal-header">
            <div className="simple-terminal-identity">
              <span className="dependency-icon">
                <DepartmentIcon id={player.department} size={28} />
              </span>
              <div>
                <h1>{dep?.name || player.department}</h1>
                <span>{player.name}</span>
              </div>
            </div>
            {state.stage === "playing" && (
              <Timer seconds={state.remaining} large />
            )}
          </header>
          <section className="cover-role">
            <span>
              {player.coverRole ||
                `Responsable de ${dep?.name || player.department}`}
            </span>
            {player.role && (
              <button
                className="text-button"
                onClick={() => setRoleShown((v) => !v)}
              >
                {roleShown ? <EyeOff size={17} /> : <Eye size={17} />}
                {roleShown ? "Ocultar rol" : "Mi rol secreto"}
              </button>
            )}
          </section>
          {player.role && roleShown && (
            <div className={`role-message ${player.role}`}>
              <b>
                {player.role === "impostor"
                  ? "Eres el impostor"
                  : "Eres parte del equipo"}
              </b>
              <p>
                {player.role === "impostor"
                  ? `Tu disfraz: ${player.coverRole || `responsable de ${dep?.name}`}. ${player.coverTask || "Aparenta mantener tu servicio en línea mientras saboteas sin ser descubierto."}`
                  : player.coverTask ||
                    "Toma buenas decisiones para mantener tu servicio en línea."}
              </p>
            </div>
          )}
          {state.stage === "playing" &&
            ["ddos", "identity"].includes(state.phase) &&
            game.connected &&
            !player.waitingForNextRound &&
            !player.blocked && (
              <div
                className="inactivity-status"
                aria-label="Puntos malos por inactividad"
              >
                <span>
                  Inactividad:{" "}
                  <b>{player.inactivityPenalties ?? 0} puntos malos</b>
                </span>
                <small>
                  {state.paused
                    ? "La pausa no cuenta."
                    : state.phase === "ddos"
                      ? (player.ddosDefense?.remaining ?? 0) > 0
                        ? "Escudo activo: la protección no cuenta como inactividad."
                        : "Esperar azul es correcto; intercepta las cruces naranjas."
                      : "Responde antes de 5 s si hay una credencial."}
                </small>
              </div>
            )}
          {state.paused && (
            <div className="pause-banner" role="status">
              Pausa. Espera la señal del administrador.
            </div>
          )}
          {!game.connected ? (
            <section className="panel terminal-finish" role="status">
              <h2>Recuperando tu conexión…</h2>
              <p>
                La experiencia continúa para el equipo. Conservas tu rol y te
                reincorporas en el siguiente juego.
              </p>
            </section>
          ) : player.waitingForNextRound ? (
            <section className="panel terminal-finish" role="status">
              <CheckCircle2 size={36} />
              <h2>Te reincorporas en el siguiente juego</h2>
              <p>
                Tu conexión está lista. Conservas tu servicio y tu rol; espera
                la siguiente experiencia.
              </p>
              <EducationalDebrief
                state={state}
                debrief={player.educationalDebrief}
              />
            </section>
          ) : state.phase === "revealed" &&
            (state.reveal || state.judgment?.step === "truth") ? (
            <Finale state={state} />
          ) : state.phase === "voting" ? (
            <Voting player={player} state={state} game={game} />
          ) : state.phase === "recovery" && state.stage === "finished" ? (
            <section className="panel terminal-finish">
              <RestorationOutcome state={state} />
              <RestorationProgress state={state} />
              <EducationalDebrief
                state={state}
                debrief={player.educationalDebrief}
              />
              <MissionTransition state={state} />
              <p>
                Recuperar la ciudad y ganar por puntos son objetivos distintos.
                El juicio final identifica al responsable.
              </p>
              <p>Espera la señal del docente para debatir y votar.</p>
            </section>
          ) : result ? (
            <section className="panel terminal-finish">
              <CheckCircle2 size={40} />
              <span className="eyebrow">{PHASE_LABELS[state.phase]}</span>
              <h2>
                {result.winner === "defenders"
                  ? "¡El equipo ganó esta ronda!"
                  : result.winner === "impostor"
                    ? "La amenaza ganó esta ronda"
                    : "Ronda terminada"}
              </h2>
              <p>{result.description}</p>
              <EducationalDebrief
                state={state}
                debrief={player.educationalDebrief}
              />
              <MissionTransition state={state} />
            </section>
          ) : state.stage === "countdown" ||
            state.stage === "briefing" ||
            state.phase === "lobby" ? (
            <Briefing
              key={state.roundId}
              state={state}
              player={player}
              roleVisible={roleShown}
            />
          ) : state.stage === "playing" ? (
            <div className="terminal-game" key={state.roundId}>
              {state.phase === "mail" && (
                <MailGame
                  player={player}
                  state={state}
                  game={game}
                  roleVisible={roleShown}
                />
              )}
              {state.phase === "ddos" && (
                <DdosGame
                  player={player}
                  state={state}
                  game={game}
                  roleVisible={roleShown}
                />
              )}
              {state.phase === "identity" && (
                <IdentityGame
                  player={player}
                  state={state}
                  game={game}
                  roleVisible={roleShown}
                />
              )}
              {state.phase === "recovery" && (
                <Recovery
                  player={player}
                  state={state}
                  game={game}
                  roleVisible={roleShown}
                />
              )}
            </div>
          ) : (
            <section className="panel terminal-finish">
              <h2>Espera la siguiente señal</h2>
              <p>El administrador prepara la experiencia.</p>
            </section>
          )}
          <div className="terminal-exit">
            <span>
              {state.phase === "revealed"
                ? "Identidad revelada · simulación concluida"
                : "Tu rol permanece secreto"}
            </span>
            <button className="text-button" onClick={game.leave}>
              Salir de mi terminal
            </button>
          </div>
        </>
      )}
    </main>
  );
}
