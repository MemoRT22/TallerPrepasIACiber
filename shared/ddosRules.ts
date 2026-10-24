export const DDOS_TRAVEL_MS = 4_000;
export const DDOS_SHIELD_MS = 4_000;
export const DDOS_WAVE_SIZE = 3;

export function ddosPressureStage(clock: number, durationMs: number): number {
  return Math.min(
    2,
    Math.max(0, Math.floor((clock / Math.max(1, durationMs)) * 3)),
  );
}

export function ddosSpawnInterval(clock: number, durationMs: number): number {
  return [2_000, 1_500, 1_100][ddosPressureStage(clock, durationMs)];
}
