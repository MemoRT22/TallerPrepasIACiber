import { AlertTriangle, CheckCircle2, Shield, WifiOff } from "lucide-react";
import {
  DEPARTMENTS,
  DEFAULT_SETTINGS,
  PHASE_LABELS,
  type PublicState,
} from "../../shared/types";
import CityMap from "../components/CityMap";
import JoinQR, { showJoinQR } from "../components/JoinQR";
import {
  DepartmentIcon,
  FullscreenButton,
  Scores,
  Timer,
} from "../components/UI";
export const DEMO_STATE: PublicState = {
  code: "----",
  capacity: 6,
  phase: "lobby",
  stage: "waiting",
  countdown: 0,
  roundId: "demo",
  sabotageTarget: 3,
  running: false,
  paused: false,
  assigned: false,
  remaining: 300,
  duration: 300,
  clock: 0,
  settings: DEFAULT_SETTINGS,
  departments: DEPARTMENTS.map((d) => ({
    id: d.id,
    name: d.name,
    status: "operational",
    connected: false,
    occupied: false,
  })),
  scores: { defenders: 0, impostor: 0 },
  results: [],
  health: "normal",
  playersCount: 0,
  connectedCount: 0,
  recovery: { completed: 0, total: 5, done: false },
  votesCount: 0,
};
export default function Dashboard({
  state = DEMO_STATE,
  demo = false,
}: {
  state?: PublicState;
  demo?: boolean;
}) {
  const result = state.results.find((r) => r.phase === state.phase);
  const down = state.departments.filter((d) => d.status === "down").length;
  const warning = state.departments.some((d) => d.status === "warning");
  const joining = showJoinQR(state, demo);
  const reveal = state.phase === "revealed" ? state.reveal : undefined;
  const revealedDepartment = reveal
    ? state.departments.find((d) =>
        reveal.impostorDepartmentId
          ? d.id === reveal.impostorDepartmentId
          : d.name === reveal.impostorDepartment,
      )
    : undefined;
  const revealedImpostor =
    reveal && revealedDepartment
      ? { departmentId: revealedDepartment.id, name: reveal.impostorName }
      : undefined;
  const threat =
    state.stage === "countdown" ||
    (state.stage === "playing" &&
      state.clock < 5000 &&
      state.phase !== "recovery");
  const title = state.paused
    ? "Experiencia pausada"
    : state.stage === "countdown"
      ? "Amenaza detectada"
      : state.phase === "revealed"
        ? "Impostor revelado"
        : state.phase === "voting"
          ? "¿Quién era el impostor?"
          : state.phase === "recovery"
            ? state.recovery.done
              ? "La ciudad está recuperada"
              : "Recuperemos la ciudad"
            : result
              ? result.winner === "defenders"
                ? "El equipo protegió la ciudad"
                : result.winner === "impostor"
                  ? "La amenaza logró avanzar"
                  : "Experiencia terminada"
              : state.stage === "playing"
                ? down
                  ? "Hay servicios fuera de línea"
                  : warning
                    ? "Protejan los servicios en riesgo"
                    : "La ciudad sigue en línea"
                : "La ciudad está lista";
  return (
    <main className="live-monitor">
      <div className="monitor-heading">
        <div>
          <span className="eyebrow">
            {demo ? "VISTA DE LA CIUDAD" : "ESTADO DE LOS SERVICIOS"}
          </span>
          <h1>{title}</h1>
          <p>
            {state.phase === "lobby"
              ? "Escanea el QR para incorporarte al equipo."
              : state.stage === "briefing" && state.autoStart && state.running
                ? `Equipo completo. Lean las instrucciones: ${Math.ceil(state.briefingRemaining || 0)} s.`
                : PHASE_LABELS[state.phase]}
          </p>
        </div>
        <div className="monitor-timer">
          {state.stage === "countdown" ? (
            <strong className="small-countdown">
              {Math.max(1, Math.ceil(state.countdown))}
            </strong>
          ) : state.stage === "playing" ? (
            <Timer seconds={state.remaining} />
          ) : null}
          <FullscreenButton />
        </div>
      </div>
      {threat && (
        <div className="threat-banner" role="status">
          <AlertTriangle size={30} />
          <div>
            <b>AMENAZA DETECTADA</b>
            <span>
              {state.paused
                ? "Espera la señal del administrador"
                : state.stage === "countdown"
                  ? "Prepárense en sus terminales"
                  : "¡Protejan la ciudad!"}
            </span>
          </div>
          {state.stage === "countdown" && (
            <strong>{Math.max(1, Math.ceil(state.countdown))}</strong>
          )}
        </div>
      )}
      <section
        className={`monitor-city ${joining ? "monitor-city-joining" : ""}`}
      >
        <CityMap
          departments={state.departments}
          demo={demo}
          revealedImpostor={revealedImpostor}
        />
        {joining && (
          <JoinQR
            key={state.code}
            code={state.code}
            connected={state.connectedCount}
            capacity={state.capacity}
            automatic={state.autoStart}
          />
        )}
      </section>
      <section
        className="service-status-strip"
        aria-label="Estado de cada servicio"
      >
        {state.departments.map((d) => (
          <article
            key={d.id}
            className={`service-tile ${d.status} ${revealedDepartment?.id === d.id ? "revealed-impostor" : ""}`}
          >
            <span className="service-tile-icon">
              <DepartmentIcon id={d.id} size={27} />
            </span>
            <div>
              <h2>{d.name}</h2>
              {revealedDepartment?.id === d.id && (
                <strong className="city-impostor-name">
                  IMPOSTOR · {reveal!.impostorName}
                </strong>
              )}
              <b>
                {d.status === "down"
                  ? "Fuera de línea"
                  : d.status === "warning"
                    ? "En riesgo"
                    : "En línea"}
              </b>
              <span>
                {d.signal ||
                  (d.status === "down"
                    ? "El servicio necesita recuperarse"
                    : d.status === "warning"
                      ? "Revisa con cuidado"
                      : "El servicio funciona correctamente")}
              </span>
              {d.occupied && !d.connected && (
                <small>
                  <WifiOff size={12} /> Terminal desconectada · no es ataque
                </small>
              )}
            </div>
            <span className="service-state-symbol">
              {d.status === "operational" ? (
                <CheckCircle2 size={23} />
              ) : (
                <AlertTriangle size={23} />
              )}
            </span>
          </article>
        ))}
      </section>
      {result && (
        <section className="compact-result">
          <Shield size={26} />
          <div>
            <h2>
              {result.winner === "defenders"
                ? "Punto para el equipo"
                : result.winner === "impostor"
                  ? "Punto para el impostor"
                  : "Sin puntos esta vez"}
            </h2>
            <p>{result.description}</p>
          </div>
          <Scores state={state} />
        </section>
      )}
      {state.phase === "recovery" && (
        <div className="recovery-status">
          <b>
            {state.recovery.completed} / {state.recovery.total} partes
            recuperadas
          </b>
          <span>
            {state.recovery.done
              ? "¡Mensaje recuperado!"
              : "Cada terminal aporta su parte."}
          </span>
        </div>
      )}
      {state.phase === "voting" && (
        <div className="recovery-status">
          <b>Vota desde tu terminal</b>
          <span>
            {state.votesCount} votos recibidos · los roles siguen ocultos
          </span>
        </div>
      )}
      {reveal && (
        <section className="simple-reveal">
          <span className="eyebrow">EL DISFRAZ DEL IMPOSTOR</span>
          <h2>{reveal.impostorDepartment}</h2>
          <p>
            {reveal.impostorName} ·{" "}
            {reveal.winner === "tie"
              ? "Empate"
              : reveal.winner === "defenders"
                ? "Ganó el equipo"
                : "Ganó el impostor"}
          </p>
          <Scores state={state} />
          <p>
            {state.recovery.done
              ? "La ciudad fue recuperada."
              : "La recuperación quedó incompleta."}
          </p>
        </section>
      )}
    </main>
  );
}
