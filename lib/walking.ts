export type Point = {x: number; z: number};
export type Obstacle = {x: number; z: number; w: number; d: number};

// Includes the courier's arms and parcel at every angle, not just its feet.
export const COURIER_RADIUS = .86;
const EPSILON = 1e-7;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export function floorBounds(width: number) {
  return {minX: -width / 2 + 1.15, maxX: width / 2 - 1.1, minZ: -2.25, maxZ: 2.9};
}

export function clearSegment(a: Point, b: Point, width: number, obstacles: Obstacle[]): boolean {
  const bounds = floorBounds(width);
  if (![a, b].every(p => Number.isFinite(p.x) && Number.isFinite(p.z) && p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ)) return false;
  return !obstacles.some(o => {
    let enter = 0, leave = 1;
    for (const axis of ['x', 'z'] as const) {
      const half = (axis === 'x' ? o.w : o.d) / 2 + COURIER_RADIUS;
      const low = o[axis] - half, high = o[axis] + half, delta = b[axis] - a[axis];
      if (Math.abs(delta) < EPSILON) {
        if (a[axis] <= low || a[axis] >= high) return false;
      } else {
        const t1 = (low - a[axis]) / delta, t2 = (high - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
        if (enter >= leave) return false;
      }
    }
    return enter < leave;
  });
}

export function walkingPath(from: Point, to: Point, width: number, obstacles: Obstacle[]): Point[] {
  if (![from.x, from.z, to.x, to.z].every(Number.isFinite) || !clearSegment(from, from, width, obstacles)) return [];
  if (clearSegment(from, to, width, obstacles)) return distance(from, to) < EPSILON ? [] : [{...to}];
  const {minX, maxX, minZ, maxZ} = floorBounds(width), step = .25;
  const cols = Math.ceil((maxX - minX) / step) + 1, rows = Math.ceil((maxZ - minZ) / step) + 1;
  const points: Point[] = Array.from({length: cols * rows}, (_, i) => ({x: Math.min(maxX, minX + i % cols * step), z: Math.min(maxZ, minZ + Math.floor(i / cols) * step)}));
  const free = points.map(p => clearSegment(p, p, width, obstacles));
  // Start from the actual in-flight position. A rounded cell can cut a furniture corner.
  let start = -1, closest = Infinity;
  points.forEach((p, i) => { const d = distance(from, p); if (free[i] && d < closest && clearSegment(from, p, width, obstacles)) {start = i; closest = d;} });
  if (start < 0) return [];
  const queue = [start], parents = new Map<number, number>([[start, -1]]);
  let goal = start, best = distance(points[start], to);
  for (let at = 0; at < queue.length; at++) {
    const i = queue[at], x = i % cols, z = Math.floor(i / cols);
    const d = distance(points[i], to);
    if (d < best - EPSILON) {goal = i; best = d;}
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, nz = z + dz, next = nz * cols + nx;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows || !free[next] || parents.has(next) || !clearSegment(points[i], points[next], width, obstacles)) continue;
      parents.set(next, i); queue.push(next);
    }
  }
  // The nearest reachable position handles taps on furniture and outside the floor.
  const route: Point[] = [];
  for (let i = goal; i !== -1; i = parents.get(i)!) route.push(points[i]);
  route.reverse();
  if (clearSegment(points[goal], to, width, obstacles)) route.push({...to});
  const smooth: Point[] = [];
  let anchor = from, index = 0;
  while (index < route.length) {
    let end = route.length - 1;
    while (end > index && !clearSegment(anchor, route[end], width, obstacles)) end--;
    if (distance(anchor, route[end]) > EPSILON) smooth.push(route[end]);
    anchor = route[end]; index = end + 1;
  }
  return smooth;
}

// Consume the entire frame budget across waypoints: no idle frame or heading reset.
export function advanceWalk(from: Point, route: Point[], seconds: number, instant = false) {
  const position = {...from}; let remaining = route.slice(), travelled = 0, heading: number | undefined;
  let budget = instant ? Infinity : Math.max(0, Math.min(seconds, .05)) * 3.6;
  while (remaining.length) {
    const next = remaining[0], length = distance(position, next);
    if (length <= EPSILON) {remaining.shift(); continue;}
    if (budget <= EPSILON) break;
    heading = Math.atan2(next.x - position.x, next.z - position.z);
    const amount = Math.min(budget, length);
    position.x += (next.x - position.x) / length * amount;
    position.z += (next.z - position.z) / length * amount;
    budget -= amount; travelled += amount;
    if (amount >= length - EPSILON) {position.x = next.x; position.z = next.z; remaining.shift();}
  }
  return {position, route: remaining, travelled, heading};
}

export function turnTowards(current: number, target: number, seconds: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-16 * Math.max(0, seconds)));
}
