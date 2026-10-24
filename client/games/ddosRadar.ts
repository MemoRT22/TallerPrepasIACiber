import type { TrafficPoint } from "../../shared/types";

export function pointPosition(point: TrafficPoint, clock: number) {
  const progress = Math.max(
    0,
    Math.min(1, (clock - point.born) / (point.arrives - point.born)),
  );
  const radius = 187 - progress * 137;
  return {
    x: 220 + Math.cos(point.angle) * radius,
    y: 220 + Math.sin(point.angle) * radius,
  };
}

export function hitTraffic(
  points: TrafficPoint[],
  clock: number,
  x: number,
  y: number,
): TrafficPoint | undefined {
  const nearest = points
    .filter((point) => point.born <= clock && point.arrives > clock)
    .map((point) => {
      const position = pointPosition(point, clock);
      return { point, distance: Math.hypot(x - position.x, y - position.y) };
    })
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest && nearest.distance <= 24 ? nearest.point : undefined;
}
