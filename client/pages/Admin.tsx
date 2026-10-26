import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Shield,
  Square,
  Users,
} from "lucide-react";
import {
  DEFAULT_SETTINGS,
  NEXT_PHASE_LABELS,
  PHASE_LABELS,
  type AdminCommand,
  type Settings,
} from "../../shared/types";
import type { GameConnection } from "../useGame";
import AdminCapacityPanel from "../components/AdminCapacityPanel";
import AdminAccess from "../components/AdminAccess";
import {
  Badge,
  DepartmentIcon,
  ErrorNote,
  Scores,
  Timer,
} from "../components/UI";
export default function Admin({ game }: { game: GameConnection }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [copied, setCopied] = useState("");
  const [qr, setQr] = useState<{ code: string; image: string } | null>(null);
  const [confirm, setConfirm] = useState<AdminCommand | null>(null);
  const state = game.snapshot?.public,
    admin = game.snapshot?.admin;
  const restoring = !!game.session && !state && !game.error;
  const complete = !!state?.results.find((r) => r.phase === state.phase);
  const adjustable =
    !!state &&
    (state.paused || state.stage === "waiting" || state.stage === "briefing") &&
    !["voting", "revealed"].includes(state.phase);
  const canBegin =
    !!state &&
    state.playersCount >= 3 &&
    (state.assigned || state.connectedCount === state.playersCount);
  useEffect(() => {
    if (state) setSettings(state.settings);
  }, [state?.code]);
  useEffect(() => {
    let active = true;
    const code = state?.code;
    setQr(null);
    if (code)
      void QRCode.toDataURL(`${location.origin}/jugar?code=${code}`, {
        margin: 1,
        color: { dark: "#123e70", light: "#ffffff" },
      })
        .then((image) => {
          if (active) setQr({ code, image });
        })
        .catch(() => {
          if (active) setQr(null);
        });
    return () => {
      active = false;
    };
  }, [state?.code]);
  const privateLink = (slot: number, invite: string) =>
    `${location.origin}/jugar/${state?.code}/${slot}#invite=${invite}`;
  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      game.setError("Selecciona y copia el enlace en Accesos privados.");
    }
  }
  return (
    <main className="simple-admin">
      <div className="admin-title">
        <div>
          <span className="eyebrow">ACCESO PRIVADO · NO PROYECTAR</span>
          <h1>Panel de administrador</h1>
        </div>
        <span className="admin-role-label">
          <Shield size={17} />
          Administrador
        </span>
      </div>
      <ErrorNote error={game.error} close={() => game.setError("")} />
      {restoring ? (
        <section className="panel admin-create" role="status">
          <Settings2 size={34} />
          <h2>Recuperando tu experiencia…</h2>
          <p>
            Estamos conectando con la sala guardada. No se creará otra
            automáticamente.
          </p>
        </section>
      ) : game.canCreate || admin ? (
        <AdminCapacityPanel game={game} />
      ) : (
        <AdminAccess game={game} />
      )}
      {!state && game.session && game.error && (
        <button className="text-button" onClick={game.forget}>
          Descartar acceso anterior
        </button>
      )}
      {state && admin && (
        <>
          <section
            className="panel admin-live-controls"
            id="admin-console"
            aria-label="Control de la experiencia"
          >
            <div className="admin-current">
              <div>
                <span className="eyebrow">{PHASE_LABELS[state.phase]}</span>
                <h2>
                  {state.paused
                    ? "En pausa"
                    : state.stage === "countdown"
                      ? `Comienza en ${Math.ceil(state.countdown)}…`
                      : state.stage === "briefing" &&
                          state.running &&
                          state.autoStart
                        ? `Lean las instrucciones · ${Math.ceil(state.briefingRemaining || 0)} s`
                        : state.stage === "playing"
                          ? "En juego"
                          : state.stage === "briefing"
                            ? "Lean las instrucciones"
                            : state.phase === "lobby"
                              ? "Prepara al equipo"
                              : "Experiencia terminada"}
                </h2>
              </div>
              {state.stage === "playing" ? (
                <Timer seconds={state.remaining} large />
              ) : (
                <Badge>
                  {state.connectedCount}/{state.playersCount || state.capacity}{" "}
                  conectados
                </Badge>
              )}
            </div>
            {state.phase === "revealed" && (
              <p role="status">
                La experiencia terminó. Reinicia toda la actividad desde este
                mismo panel para recibir al siguiente grupo. Conservas tu acceso
                y las ligas.
              </p>
            )}
            <div className="admin-main-actions">
              {state.phase === "lobby" &&
                !state.assigned &&
                !state.autoStart && (
                  <button
                    className="btn primary"
                    disabled={game.busy || !game.connected}
                    onClick={() => void game.admin("auto-start")}
                  >
                    <Users size={19} />
                    Mostrar QR e iniciar con grupo completo
                  </button>
                )}
              {state.phase === "lobby" &&
                !state.assigned &&
                state.autoStart && (
                  <>
                    <a
                      className="btn primary"
                      href={`/pantalla/${state.code}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye size={19} /> Abrir ciudad con QR
                    </a>
                    <button
                      className="btn secondary"
                      disabled={game.busy || !game.connected}
                      onClick={() => void game.admin("manual-start")}
                    >
                      <Pause size={18} /> Desactivar inicio automático
                    </button>
                  </>
                )}
              {state.phase === "lobby" &&
                !state.assigned &&
                !state.autoStart && (
                  <button
                    className="btn primary"
                    disabled={!canBegin || game.busy || !game.connected}
                    onClick={() => void game.admin("assign")}
                  >
                    <Shield size={19} />
                    Asignar roles secretos
                  </button>
                )}
              {state.assigned &&
                !state.running &&
                !complete &&
                state.stage !== "finished" &&
                !["voting", "revealed"].includes(state.phase) && (
                  <button
                    className="btn primary"
                    disabled={!canBegin || game.busy || !game.connected}
                    onClick={() => void game.admin("start")}
                  >
                    <Play size={19} />
                    Dar señal e iniciar
                  </button>
                )}
              {state.running && (
                <button
                  className="btn primary"
                  disabled={game.busy || !game.connected}
                  onClick={() =>
                    void game.admin(state.paused ? "resume" : "pause")
                  }
                >
                  {state.paused ? <Play size={19} /> : <Pause size={19} />}{" "}
                  {state.paused ? "Continuar" : "Pausar experiencia"}
                </button>
              )}
              {complete &&
                ["mail", "ddos", "identity"].includes(state.phase) && (
                  <button
                    className="btn primary"
                    disabled={game.busy || !game.connected}
                    onClick={() => void game.admin("next")}
                  >
                    Preparar: {NEXT_PHASE_LABELS[state.phase]}
                    <ArrowRight size={19} />
                  </button>
                )}
              {state.phase === "recovery" && state.stage === "finished" && (
                <button
                  className="btn primary"
                  disabled={game.busy}
                  onClick={() => void game.admin("judgment")}
                >
                  <Users size={19} />
                  Iniciar juicio final y debate
                </button>
              )}
              {state.phase === "voting" &&
                state.judgment?.stage === "debate" && (
                  <button
                    className="btn primary"
                    disabled={game.busy || !game.connected}
                    onClick={() => void game.admin("voting")}
                  >
                    Abrir votación privada
                  </button>
                )}
              {state.phase === "voting" &&
                state.judgment?.stage !== "debate" && (
                  <button
                    className="btn primary"
                    disabled={game.busy || !game.connected}
                    onClick={() => setConfirm("reveal")}
                  >
                    <Eye size={19} />
                    Revelar al impostor en la ciudad
                  </button>
                )}
              {state.running && (
                <button
                  className="btn secondary"
                  onClick={() => setConfirm("stop")}
                  disabled={game.busy}
                >
                  <Square size={17} />
                  Terminar sin puntos
                </button>
              )}
              <button
                className="btn secondary admin-reset-all"
                disabled={game.busy || !game.connected}
                onClick={() => setConfirm("reset-all")}
              >
                <RotateCcw size={18} />
                Reiniciar toda la actividad
              </button>
            </div>
            <p className="admin-flow-help">
              {state.phase === "lobby" && !state.assigned
                ? state.autoStart
                  ? `Proyecta la ciudad: allí está el QR. Faltan ${Math.max(0, state.capacity - state.connectedCount)} de ${state.capacity} jugadores. Con el grupo completo se oculta el QR, se asignan roles, leen las instrucciones 20 segundos y comienza la cuenta de 5 segundos.`
                  : "Puedes usar el QR con inicio automático o asignar manualmente con al menos 3 personas conectadas."
                : state.stage === "briefing" && state.running && state.autoStart
                  ? "El QR ya se ocultó. El grupo está leyendo las instrucciones; puedes pausar antes de que empiece la cuenta regresiva."
                  : state.stage === "briefing" || state.phase === "lobby"
                    ? "Las instrucciones están en cada terminal. Cuando estén listos, da la señal: aparecerá Amenaza detectada y una cuenta de 5 segundos."
                    : state.paused
                      ? "Puedes ajustar los parámetros o resolver una desconexión antes de continuar."
                      : "Solo tú controlas el inicio, la pausa y el cambio de experiencia."}
            </p>
          </section>
          <div className="admin-two-columns">
            <section className="panel admin-accesses">
              <div className="minor-heading">
                <h2>Accesos del equipo</h2>
                <Badge>{state.code}</Badge>
              </div>
              <div className="admin-public-link">
                <a
                  className="btn secondary"
                  href={`/pantalla/${state.code}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye size={17} />
                  Abrir pantalla
                </a>
                <button
                  className="icon-button"
                  aria-label="Copiar enlace de pantalla"
                  onClick={() =>
                    void copy(
                      `${location.origin}/pantalla/${state.code}`,
                      "public",
                    )
                  }
                >
                  {copied === "public" ? <Check /> : <Copy size={18} />}
                </button>
              </div>
              {qr?.code === state.code &&
                !state.assigned &&
                state.autoStart && (
                  <div className="simple-qr">
                    <img src={qr.image} alt="QR de acceso a terminales" />
                    <div>
                      <b>Código {state.code}</b>
                      <p>
                        El QR también aparece sobre la ciudad en la pantalla
                        pública.
                      </p>
                    </div>
                  </div>
                )}
              <div className="simple-roster">
                {admin.invites
                  .filter(
                    (v) =>
                      !state.assigned ||
                      admin.players.some((p) => p.department === v.department),
                  )
                  .map((v) => {
                    const p = admin.players.find(
                      (p) => p.department === v.department,
                    );
                    return (
                      <div key={v.slot}>
                        <DepartmentIcon id={v.department} size={22} />
                        <div>
                          <b>
                            {state.departments.find(
                              (d) => d.id === v.department,
                            )?.name || v.department}
                          </b>
                          <span>{p ? p.name : "Puesto libre"}</span>
                          {p && p.inactivityPenalties !== undefined && (
                            <small>
                              Inactividad: {p.inactivityPenalties} puntos malos
                            </small>
                          )}
                        </div>
                        <span
                          className={`roster-status ${p?.connected ? "online" : ""}`}
                        >
                          {p?.connected
                            ? p.waitingForNextRound
                              ? "Vuelve en el siguiente juego"
                              : "Conectado"
                            : p
                              ? "Sin conexión"
                              : "Disponible"}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Copiar acceso ${v.slot}`}
                          onClick={() =>
                            void copy(
                              privateLink(v.slot, v.invite),
                              `p${v.slot}`,
                            )
                          }
                        >
                          {copied === `p${v.slot}` ? (
                            <Check size={17} />
                          ) : (
                            <Copy size={17} />
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
              <details className="private-links-details">
                <summary>Ver y copiar accesos privados</summary>
                {admin.invites.map((v) => (
                  <label key={v.slot}>
                    Terminal {v.slot}
                    <input
                      value={privateLink(v.slot, v.invite)}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                ))}
                <label>
                  Administrador
                  <input
                    readOnly
                    value={`${location.origin}/docente#room=${state.code}&token=${game.session?.token}`}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <p className="help-text">
                  Comparte cada enlace solo con su destinatario.
                </p>
              </details>
            </section>
            <div className="admin-options">
              <details className="panel admin-settings">
                <summary>
                  <Settings2 size={19} />
                  Parámetros de la experiencia
                </summary>
                <p>
                  {adjustable
                    ? "Ajusta antes de empezar o mientras está pausada."
                    : "Pausa la experiencia para cambiar parámetros."}
                </p>
                <div className="settings-fields">
                  {(
                    [
                      {
                        field: "mailSeconds",
                        label: "Tiempo de correos (s)",
                        min: 60,
                        max: 600,
                      },
                      {
                        field: "ddosSeconds",
                        label: "Tiempo de tráfico (s)",
                        min: 30,
                        max: 600,
                      },
                      {
                        field: "identitySeconds",
                        label: "Tiempo de tarjetas (s)",
                        min: 30,
                        max: 600,
                      },
                      {
                        field: "recoverySeconds",
                        label: "Tiempo de recuperación (s)",
                        min: 60,
                        max: 600,
                      },
                      {
                        field: "mailAccuracy",
                        label: "Meta de correos (%)",
                        min: 50,
                        max: 100,
                      },
                      {
                        field: "blueAccuracy",
                        label: "Meta de azules (%)",
                        min: 50,
                        max: 100,
                      },
                      {
                        field: "identityAccuracy",
                        label: "Meta de tarjetas (%)",
                        min: 50,
                        max: 100,
                      },
                      {
                        field: "saturationLimit",
                        label: "Capacidad del servidor",
                        min: 5,
                        max: 20,
                      },
                    ] as const
                  ).map((f) => (
                    <label key={f.field}>
                      {f.label}
                      <input
                        type="number"
                        min={f.min}
                        max={f.max}
                        value={settings[f.field]}
                        disabled={!adjustable}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [f.field]: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  className="btn secondary full"
                  disabled={!adjustable || game.busy}
                  onClick={() => void game.admin("settings", settings)}
                >
                  Guardar parámetros
                </button>
                <p className="help-text">
                  El inicio siempre incluye 5 segundos de cuenta regresiva.
                </p>
              </details>
              <details className="panel admin-intervention">
                <summary>Intervenir o repetir</summary>
                <p>
                  Una desconexión no es un ataque ni detiene al equipo. La
                  persona conserva su rol y vuelve en el siguiente juego.
                </p>
                {!["lobby", "voting", "revealed"].includes(state.phase) && (
                  <button
                    className="btn secondary full"
                    disabled={game.busy}
                    onClick={() => setConfirm("restart")}
                  >
                    <RotateCcw size={17} />
                    Repetir esta experiencia
                  </button>
                )}
                <p className="help-text">
                  Repetir retira el resultado de esta ronda y vuelve a las
                  instrucciones. Los roles no cambian.
                </p>
              </details>
              <section className="panel admin-score">
                <h2>Resultado del equipo</h2>
                <Scores state={state} />
                {state.results.map((r) => (
                  <p key={r.phase}>
                    <b>{PHASE_LABELS[r.phase]}:</b>{" "}
                    {r.winner === "defenders"
                      ? "Equipo +1"
                      : r.winner === "impostor"
                        ? "Impostor +1"
                        : "Sin puntos"}
                  </p>
                ))}
              </section>
            </div>
          </div>
          {state.reveal && (
            <details className="panel admin-log">
              <summary>Resultados y registro final</summary>
              <h2>
                El impostor: {state.reveal.impostorName} ·{" "}
                {state.reveal.impostorDepartment}
              </h2>
              {(admin.closingAudit?.votes ?? []).map((v, i) => (
                <p key={i}>
                  <b>{v.voter}</b> sospechó de {v.suspect}: {v.reason}
                </p>
              ))}
              <button
                className="btn secondary"
                onClick={() => {
                  const blob = new Blob(
                    [
                      JSON.stringify(
                        {
                          sala: state.code,
                          resultados: state.results,
                          parametros: state.settings,
                          revelacion: state.reveal,
                          auditoriaPrivada: admin.closingAudit,
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `cancun-${state.code}-resultados.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Descargar registro
              </button>
              <div className="log-list">
                {(admin.closingAudit?.logs ?? []).map((l, i) => (
                  <p key={i}>
                    {PHASE_LABELS[l.phase]} · {l.department} · {l.detail}
                  </p>
                ))}
              </div>
            </details>
          )}
          {confirm && (
            <div
              className="admin-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="admin-confirm-title"
              aria-describedby="admin-confirm-description"
            >
              <div>
                <h2 id="admin-confirm-title">
                  {confirm === "reset-all"
                    ? "¿Reiniciar toda la actividad?"
                    : confirm === "stop"
                      ? "¿Terminar esta ronda?"
                      : confirm === "restart"
                        ? "¿Repetir esta experiencia?"
                        : "¿Revelar al impostor?"}
                </h2>
                <p id="admin-confirm-description">
                  {confirm === "reset-all"
                    ? "Se cerrarán las sesiones de todos los jugadores y se borrarán sus nombres, roles, puntos, rondas, votos y registro. La sala quedará vacía y lista para otro grupo. Conservas tu acceso, la pantalla, las ligas de terminales y los parámetros. Esta limpieza no se puede deshacer."
                    : confirm === "stop"
                      ? "No se otorgarán puntos. Podrás repetir o preparar la siguiente."
                      : confirm === "restart"
                        ? "Se retira su resultado y vuelve a las instrucciones. Los roles y accesos no cambian."
                        : `Se cerrará la votación con ${state.votesCount} de ${state.judgment?.votesExpected ?? state.playersCount} votos. Los pendientes se consideran abstenciones; no se inventan votos. La secuencia de revelación dura 30 segundos.`}
                </p>
                <div>
                  <button
                    className="btn secondary"
                    onClick={() => setConfirm(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn primary"
                    disabled={game.busy || !game.connected}
                    onClick={async () => {
                      const result = await game.admin(confirm);
                      if (result.ok) setConfirm(null);
                    }}
                  >
                    {confirm === "reset-all"
                      ? "Reiniciar y sacar a todos"
                      : "Confirmar"}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="terminal-exit">
            <span>Solo comparte la pantalla pública en el proyector.</span>
            <button className="text-button" onClick={game.forget}>
              Salir del administrador
            </button>
          </div>
        </>
      )}
    </main>
  );
}
