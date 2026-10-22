import { useEffect, useRef } from "react";
import { Circle, MousePointer2, Server, X } from "lucide-react";
import type {
  PlayerState,
  PublicState,
  TrafficPoint,
} from "../../shared/types";
import type { GameConnection } from "../useGame";
import { Badge } from "../components/UI";

const BLUE_DEEP = "#123e70";
const BLUE_SIGNAL = "#2788e8";
const LIGHT_SURFACE = "#eef6ff";
const ORANGE = "#f58232";
const LIGHT_ORANGE = "#fff0e5";

function pointPosition(p: TrafficPoint, clock: number) {
  const progress = Math.max(
    0,
    Math.min(1, (clock - p.born) / (p.arrives - p.born)),
  );
  const radius = 187 - progress * 137;
  return {
    x: 220 + Math.cos(p.angle) * radius,
    y: 220 + Math.sin(p.angle) * radius,
  };
}

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

    function draw() {
      if (!ctx) return;
      const { player: p, state: s } = current.current;
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
        if (traffic.arrives <= clock) continue;
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
      frame = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  const enabled =
    state.stage === "playing" &&
    state.running &&
    !state.paused &&
    !game.busy &&
    !player.blocked &&
    game.connected;
  const pressureStage = Math.min(
    2,
    Math.floor((state.clock / Math.max(1, state.duration * 1000)) * 3),
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
              const nearest = player.traffic
                .filter((point) => point.arrives > clock)
                .map((point) => ({
                  point,
                  position: pointPosition(point, clock),
                }))
                .map(({ point, position }) => ({
                  point,
                  distance: Math.hypot(x - position.x, y - position.y),
                }))
                .sort((a, b) => a.distance - b.distance)[0];
              if (nearest && nearest.distance <= 24)
                void game.act({ type: "ddos:tap", pointId: nearest.point.id });
            }}
          />
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
        {roleVisible && player.role === "impostor" && (
          <details className="private-tip">
            <summary>Guía privada</summary>
            <p>
              Al detener una cruz naranja, envías otra a un defensor. En los
              últimos 10 segundos, envías 3 en total entre los demás servicios.
            </p>
            {state.remaining > 0 && state.remaining <= 10 && (
              <Badge tone="red">REFUERZO FINAL ×3</Badge>
            )}
          </details>
        )}
      </aside>
    </div>
  );
}
