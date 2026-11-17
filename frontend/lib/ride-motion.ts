export type MapPoint = [number, number];

export function metresBetween(a: MapPoint, b: MapPoint): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b[0] - a[0]) * rad / 2) ** 2
    + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin((b[1] - a[1]) * rad / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function headingBetween(a: MapPoint, b: MapPoint): number {
  const rad = Math.PI / 180;
  const d = (b[1] - a[1]) * rad;
  return (Math.atan2(Math.sin(d) * Math.cos(b[0] * rad),
    Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos(d)) / rad + 360) % 360;
}

/** Keep rotations continuous across north (359° -> 1° turns two degrees). */
export function continuousHeading(current: number, next: number): number {
  return current + ((next - current + 540) % 360 + 360) % 360 - 180;
}

export function nearestOnPath(point: MapPoint, path: MapPoint[]) {
  let best = { point, segment: 0, fraction: 0, distance: Infinity };
  let bestSquared = Infinity;
  const scale = Math.cos(point[0] * Math.PI / 180);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const x = (b[1] - a[1]) * scale, y = b[0] - a[0];
    const fraction = Math.max(0, Math.min(1, ((point[1] - a[1]) * scale * x + (point[0] - a[0]) * y) / (x * x + y * y || 1)));
    const projected: MapPoint = [a[0] + y * fraction, a[1] + (b[1] - a[1]) * fraction];
    const squared = (point[0] - projected[0]) ** 2 + ((point[1] - projected[1]) * scale) ** 2;
    if (squared < bestSquared) { bestSquared = squared; best = { point: projected, segment: i, fraction, distance: 0 }; }
  }
  best.distance = Number.isFinite(bestSquared) ? metresBetween(point, best.point) : Infinity;
  return best;
}

/** Use nearby road bends between two observed fixes, ending at the exact reported GPS. */
export function motionPath(from: MapPoint, to: MapPoint, road: MapPoint[] = []): MapPoint[] {
  if (road.length < 2) return [from, to];
  const start = nearestOnPath(from, road), end = nearestOnPath(to, road);
  if (start.distance > 40 || end.distance > 40 || end.segment + end.fraction < start.segment + start.fraction) return [from, to];
  const path = [from, start.point, ...road.slice(start.segment + 1, end.segment + 1), end.point, to];
  const length = path.slice(1).reduce((sum, p, i) => sum + metresBetween(path[i], p), 0);
  return length <= metresBetween(from, to) * 3 + 40 ? path : [from, to];
}

export function remainingPath(point: MapPoint, road: MapPoint[]): MapPoint[] {
  const nearest = nearestOnPath(point, road);
  return nearest.distance <= 60 ? [point, nearest.point, ...road.slice(nearest.segment + 1)] : road;
}

interface MotionOptions {
  now: () => number;
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
  onFrame: (point: MapPoint, heading: number) => void;
}

/** Interruptible interpolation of observed fixes only. Never predicts future movement. */
export function createRideMotion({ now, requestFrame, cancelFrame, onFrame }: MotionOptions) {
  let current: MapPoint | null = null;
  let target: MapPoint | null = null;
  let heading = 0;
  let frame: number | null = null;
  let lastFix = -Infinity;
  let lastArrival: number | null = null;
  const stop = () => { if (frame !== null) cancelFrame(frame); frame = null; };
  return {
    moveTo(point: MapPoint, { timestamp, road = [], immediate = false }: { timestamp: number; road?: MapPoint[]; immediate?: boolean }) {
      if (!Number.isFinite(timestamp) || timestamp < lastFix) return;
      lastFix = timestamp;
      // Polling/heartbeats at the same point must not restart an in-flight animation.
      if (target && metresBetween(target, point) < 0.05) {
        if (immediate) { stop(); current = target; onFrame(current, heading); }
        return;
      }
      stop();
      const arrived = now();
      const duration = Math.min(2200, Math.max(700, lastArrival === null ? 1600 : (arrived - lastArrival) * 0.9));
      lastArrival = arrived;
      target = point;
      if (!current || immediate || metresBetween(current, point) > 1000) {
        current = point;
        onFrame(point, heading);
        return;
      }
      const path = motionPath(current, point, road);
      const lengths = path.slice(1).map((p, i) => metresBetween(path[i], p));
      const total = lengths.reduce((a, b) => a + b, 0);
      const tick = (time: number) => {
        const progress = Math.min(1, Math.max(0, (time - arrived) / duration));
        // Smooth acceleration/deceleration, with distance-based timing around bends.
        let distance = progress * progress * (3 - 2 * progress) * total;
        let segment = 0;
        while (segment < lengths.length - 1 && distance > lengths[segment]) distance -= lengths[segment++];
        const a = path[segment], b = path[segment + 1];
        const fraction = Math.min(1, distance / (lengths[segment] || 1));
        current = progress === 1 ? point : [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
        if (lengths[segment] > 0.5) heading = continuousHeading(heading, headingBetween(a, b));
        onFrame(current, heading);
        frame = progress < 1 ? requestFrame(tick) : null;
      };
      frame = requestFrame(tick);
    },
    finish() { stop(); if (target) { current = target; onFrame(target, heading); } },
    stop,
  };
}
