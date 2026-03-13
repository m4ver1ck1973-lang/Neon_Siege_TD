import { Vector2D } from './types';

export function distance(p1: Vector2D, p2: Vector2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(v: Vector2D): Vector2D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function moveTowards(current: Vector2D, target: Vector2D, maxDistanceDelta: number): Vector2D {
  const dist = distance(current, target);
  if (dist <= maxDistanceDelta || dist === 0) {
    return { ...target };
  }
  const dir = normalize({ x: target.x - current.x, y: target.y - current.y });
  return {
    x: current.x + dir.x * maxDistanceDelta,
    y: current.y + dir.y * maxDistanceDelta
  };
}
