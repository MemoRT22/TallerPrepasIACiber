import { useEffect, useRef, useState } from "react";
import { Circle, MousePointer2, Server, Shield, Waves, X } from "lucide-react";
import type { PlayerState, PublicState } from "../../shared/types";
import type { GameConnection } from "../useGame";
import { Badge } from "../components/UI";
import { ddosPressureStage } from "../../shared/ddosRules";
import { hitTraffic, pointPosition } from "./ddosRadar";

const BLUE_DEEP = "#123e70";
const BLUE_SIGNAL = "#2788e8";
const LIGHT_SURFACE = "#eef6ff";
const ORANGE = "#f58232";
const LIGHT_ORANGE = "#fff0e5";

export default function DdosGame({
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redraw = useRef<(() => void) | null>(null);
  const [target, setTarget] = useState("");
  const [tapFeedback, setTapFeedback] = useState<{
    id: string;
    kind: "blue" | "red";
    x: number;
    y: number;
  } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);
  const current = useRef({ player, state, received: performance.now() });
  current.current = { player, state, received: performance.now() };

  const interpolatedClock = () => {
    const snapshot = current.current;
    return (
      snapshot.state.clock +
      (snapshot.state.running && !snapshot.state.paused
        ? Math.min(1000, performance.now() - snapshot.received)
        : 0)
    );
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let lastDraw = -Infinity;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );

    function schedule() {
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function draw(timestamp: number) {
      frame = 0;
      if (!ctx) return;
      const { player: p, state: s } = current.current;
      const animating =
        s.stage === "playing" &&
        s.running &&
        !s.paused &&
        !p.blocked &&
        !document.hidden;
      if (document.hidden) return;
      if (
        animating &&
        timestamp - lastDraw < (reducedMotion?.matches ? 33 : 16)
      ) {
        schedule();
        return;
      }
      lastDraw = timestamp;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 440, 440);
      ctx.fillStyle = LIGHT_SURFACE;
      ctx.fillRect(0, 0, 440, 440);
      ctx.strokeStyle = BLUE_DEEP;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      for (const radius of [95, 145, 195]) {
        ctx.beginPath();
        ctx.arc(220, 220, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(220 + Math.cos(angle) * 62, 220 + Math.sin(angle) * 62);
        ctx.lineTo(220 + Math.cos(angle) * 200, 220 + Math.sin(angle) * 200);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const clock = interpolatedClock();
      for (const traffic of p.traffic) {
        if (traffic.born > clock || traffic.arrives <= clock) continue;
        const pos = pointPosition(traffic, clock);
        const malicious = traffic.kind === "red";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = malicious ? LIGHT_ORANGE : LIGHT_SURFACE;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = malicious ? ORANGE : BLUE_SIGNAL;
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = malicious ? ORANGE : BLUE_SIGNAL;
        ctx.lineWidth = 2;
        if (malicious) {
          ctx.moveTo(pos.x - 5, pos.y - 5);
          ctx.lineTo(pos.x + 5, pos.y + 5);
          ctx.moveTo(pos.x + 5, pos.y - 5);
          ctx.lineTo(pos.x - 5, pos.y + 5);
        } else {
          ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

      const capacity = s.settings.saturationLimit;
      for (let i = 0; i < capacity; i++) {
        ctx.beginPath();
        ctx.arc(
          220,
          220,
          61,
          (i * Math.PI * 2) / capacity - Math.PI / 2 + 0.035,
          ((i + 1) * Math.PI * 2) / capacity - Math.PI / 2 - 0.035,
        );
        ctx.strokeStyle = i < p.saturation ? ORANGE : BLUE_DEEP;
        ctx.globalAlpha = i < p.saturation ? 1 : 0.2;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const shieldRemaining =
        (p.ddosDefense?.remaining ?? 0) - (clock - s.clock) / 1000;
      if (shieldRemaining > 0) {
        ctx.beginPath();
        ctx.arc(220, 220, 73, 0, Math.PI * 2);
        ctx.strokeStyle = "#168d83";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          220,
          220,
          80,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * Math.min(1, shieldRemaining / 4),
        );
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if ((p.ddosDefense?.feedbackRemaining ?? 0) > (clock - s.clock) / 1000) {
        ctx.beginPath();
        ctx.arc(220, 220, 87, 0, Math.PI * 2);
        ctx.strokeStyle = "#168d83";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(220, 220, 48, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = BLUE_DEEP;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = BLUE_DEEP;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SERVIDOR", 220, 212);
      ctx.font = "bold 22px monospace";
      ctx.fillText(`${p.saturation}/${capacity}`, 220, 240);
      if (animating) schedule();
    }

    const visibility = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      schedule();
    };
    redraw.current = schedule;
    document.addEventListener("visibilitychange", visibility);
    reducedMotion?.addEventListener?.("change", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      redraw.current = null;
      document.removeEventListener("visibilitychange", visibility);
      reducedMotion?.removeEventListener?.("change", schedule);
    };
  }, []);
  useEffect(() => {
    redraw.current?.();
  }, [player, state]);
  useEffect(() => {
    if (!roleVisible) setTarget("");
  }, [roleVisible]);

  const enabled =
    state.stage === "playing" &&
    state.running &&
    !state.paused &&
    !game.busy &&
    !player.blocked &&
    game.connected;
  const pressureStage = ddosPressureStage(state.clock, state.duration * 1000);
  const defense = player.ddosDefense;
  const challenge =
    roleVisible && player.role === "impostor"
      ? player.ddosChallenge
      : undefined;
  const targetAvailable = challenge?.targets.some(
    (candidate) => candidate.department === target,
  );
  const pressure = [
    "TRÁFICO MODERADO",
    "TRÁFICO EN AUMENTO",
    "TRÁFICO CRÍTICO",
  ][pressureStage];

  return (
    <div className="game-layout">
      <section className="panel ddos-game">
        <div className="minor-heading">
          <h2>
            <Server size={21} />
            Defiende tu servidor
          </h2>
          <div className="ddos-badges">
            <Badge
              tone={
                pressureStage === 2
                  ? "red"
                  : pressureStage === 1
                    ? "amber"
                    : "mint"
              }
            >
              {pressure}
            </Badge>
            <Badge tone={player.saturation >= 6 ? "amber" : "mint"}>
              {player.saturation}/{state.settings.saturationLimit} SATURACIÓN
            </Badge>
          </div>
        </div>
        <p className="game-instruction">Deja pasar azul. Toca naranja.</p>
        {defense && (
          <div
            className={`ddos-defense ${defense.remaining > 0 ? "protected" : ""}`}
          >
            <button
              className="btn secondary"
              disabled={!enabled || !defense.available}
              onClick={() => void game.act({ type: "ddos:shield" })}
            >
              <Shield size={21} />
              {defense.remaining > 0
                ? `ESCUDO · ${defense.remaining.toFixed(1)} s`
                : defense.available
                  ? "ACTIVAR ESCUDO"
                  : "ESCUDO UTILIZADO"}
            </button>
            <small>
              {defense.remaining > 0
                ? "Los impactos naranjas no suman saturación."
                : "Un uso por ronda · protege durante 4 s."}
            </small>
            {(defense.waveRemaining > 0 || defense.feedbackRemaining > 0) && (
              <b role="status">
                {defense.feedbackRemaining > 0
                  ? `Impacto absorbido · ${defense.absorbed}`
                  : "Oleada entrante · intercepta o protege tu servidor"}
              </b>
            )}
          </div>
        )}
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={880}
            height={880}
            aria-label="Tráfico radial: círculos azules legítimos y cruces naranjas maliciosas"
            onPointerDown={(e) => {
              if (!enabled) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 440;
              const y = ((e.clientY - rect.top) / rect.height) * 440;
              const clock = interpolatedClock();
              const point = hitTraffic(player.traffic, clock, x, y);
              if (point) {
                void game.act({ type: "ddos:tap", pointId: point.id }).then((ack) => {
                  if (!ack.ok) return; // No confirmar un toque expirado o rechazado.
                  if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
                  setTapFeedback({ id: point.id, kind: point.kind, x, y });
                  feedbackTimer.current = setTimeout(() => {
                    setTapFeedback(null);
                    feedbackTimer.current = null;
                  }, 750);
                });
              }
            }}
          />
          {tapFeedback && (
            <span
              key={tapFeedback.id}
              className={`ddos-tap-pulse ${tapFeedback.kind === "red" ? "good" : "mistake"}`}
              style={{ left: `${(tapFeedback.x / 440) * 100}%`, top: `${(tapFeedback.y / 440) * 100}%` }}
              aria-hidden="true"
            />
          )}
          {player.blocked && (
            <div className="canvas-overlay">
              <X size={40} />
              <h3>Servicio detenido</h3>
              <p>Espera la siguiente ronda.</p>
            </div>
          )}
          {state.paused && (
            <div className="canvas-overlay">
              <h3>Ronda pausada</h3>
              <p>Espera la señal.</p>
            </div>
          )}
        </div>
        <p
          className={`ddos-tap-feedback ${tapFeedback?.kind === "blue" ? "mistake" : ""}`}
          role="status"
          aria-live="polite"
        >
          {tapFeedback
            ? tapFeedback.kind === "red"
              ? "Intercepción confirmada"
              : "Tráfico legítimo bloqueado"
            : "\u00a0"}
        </p>
        <div className="traffic-legend">
          <span style={{ color: BLUE_SIGNAL }}>
            <Circle size={17} />
            Azul = legítimo
          </span>
          <span style={{ color: ORANGE }}>
            <X size={17} />
            Naranja = malicioso
          </span>
        </div>
        <p className="help-text">
          <MousePointer2 size={14} /> Toca cerca de cada señal · llega en 4 s.
        </p>
      </section>

      <aside className="panel instruction-panel compact-tip">
        <span className="eyebrow">CONSEJO</span>
        <p>Deja pasar círculos azules. Toca cruces naranjas.</p>
        {challenge && (
          <details className="private-tip">
            <summary>
              ANÁLISIS PRIVADO ·{" "}
              {challenge.waveUsed
                ? "oleada utilizada"
                : challenge.solved
                  ? "oleada lista"
                  : "desbloquea tu oleada"}
            </summary>
            {challenge.solved ? (
              challenge.waveUsed ? (
                <p>
                  Ya lanzaste tu única oleada. Sigue interceptando para mantener
                  tu cobertura.
                </p>
              ) : (
                <div className="ddos-wave-controls">
                  <p>
                    Tres cruces interceptables. Elige objetivo y momento;
                    necesita 4 s de viaje.
                  </p>
                  <label>
                    Objetivo
                    <select
                      value={targetAvailable ? target : ""}
                      onChange={(event) => setTarget(event.target.value)}
                    >
                      <option value="">Selecciona dependencia</option>
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
                    className="btn primary full"
                    disabled={
                      !enabled ||
                      !targetAvailable ||
                      state.remaining < 4 ||
                      !challenge.waveAvailable
                    }
                    onClick={() => void game.act({ type: "ddos:wave", target })}
                  >
                    <Waves size={20} />{" "}
                    {state.remaining < 4 ? "OLEADAS CERRADAS" : "LANZAR OLEADA"}
                  </button>
                </div>
              )
            ) : (
              <div className="ddos-analysis">
                <p>
                  Solicitudes en tres ventanas de 2 s. ¿Qué origen repite muchas
                  peticiones por cliente en todas las ventanas? Un pico
                  repartido entre muchos clientes no basta.
                </p>
                <div className="ddos-pattern-head" aria-hidden="true">
                  <span>Origen</span>
                  <span>Peticiones</span>
                  <span>Clientes</span>
                </div>
                {challenge.patterns.map((pattern) => (
                  <button
                    key={pattern.id}
                    className="ddos-pattern btn secondary"
                    disabled={!enabled || challenge.retryIn > 0}
                    onClick={() =>
                      void game.act({
                        type: "ddos:challenge-solve",
                        answer: pattern.id,
                      })
                    }
                  >
                    <b>{pattern.label}</b>
                    <span>{pattern.requests.join(" · ")}</span>
                    <span>{pattern.clients}</span>
                  </button>
                ))}
                {challenge.retryIn > 0 && (
                  <small role="status">
                    Reintento en {Math.ceil(challenge.retryIn)} s.
                  </small>
                )}
              </div>
            )}
          </details>
        )}
      </aside>
    </div>
  );
}
