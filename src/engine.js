/* ═══════════════════════════════════════════════════════════════════════════════
   Engine: stripes as rulings of higher-order surfaces.
   Two generators:
     lines   — flat parallel stripes (the brand barcode, stairs, overlapping layers)
     surface — a parametric surface S(u,v) in 3D; every stripe is a band u ∈ [uᵢ−δ, uᵢ+δ]
               of that surface, projected with perspective. Width therefore changes smoothly
               along each stripe (foreshortening, depth, taper), bands overlap by depth and
               show their front or back side.
   Output strips:
     { k:'line', p:[x0,y0,x1,y1,…], h: halfWidth | [per point], u, role, id }
     { k:'band', L:[x,y,…], R:[x,y,…], u, role, id, depth, lit }
   Time enters only through integer frequencies, so frame t=0 equals frame t=1.
   No circles, no rounded corners: every turn in the geometry is a fold or a smooth surface.
   ═══════════════════════════════════════════════════════════════════════════════ */
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = x => x - Math.floor(x);
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function hash(i, s) {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((s | 0) + 0x632be5ab, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, seed) { const i = Math.floor(x), f = x - i; return lerp(hash(i, seed), hash(i + 1, seed), smooth(f)); }
function wnoise(x, t, seed) {
  let s = 0, n = 0;
  const F = [1, 1.83, 3.11, 4.97];
  for (let k = 0; k < 4; k++) {
    const a = 1 / (1 + k * 0.8), m = (hash(k, seed) < 0.5 ? -1 : 1) * (1 + (k >> 1));
    s += a * Math.sin(TAU * (F[k] * x + m * t) + hash(k + 9, seed) * TAU); n += a;
  }
  return (s / n) * 1.5;
}
const tri = x => 1 - 2 * Math.abs(2 * fract(x) - 1); /* sharp fold wave in [-1,1] */

/* ───── thickness across the set: the brand "barcode with acceleration" ───── */
function saw(f, soft) { if (!(soft > 0)) return f; const r = 1 - soft; return f < r ? f / r : 1 - smooth((f - r) / soft); }
function fillOf(g, u, q, t) {
  const k = Math.max(1, g.teeth || 1);
  const x = u - ((g.rampSpeed || 0) * t) / k;
  let w;
  switch (g.ramp) {
    case 'flat': w = 1; break;
    case 'up': w = saw(fract(x * k - 1e-9), g.soft); break;
    case 'down': w = saw(fract(-x * k + 1e-9), g.soft); break;
    case 'peak': w = 1 - Math.abs(2 * fract(x * k) - 1); break;
    case 'vee': w = Math.abs(2 * fract(x * k) - 1); break;
    case 'wave': w = 0.5 - 0.5 * Math.cos(TAU * x * k); break;
    case 'code': { const r = vnoise(q, (g.seed | 0) + 101); w = r < 0.5 ? r * r * 2 : r; break; }
    default: w = 1;
  }
  if (g.gamma && g.gamma !== 1) w = Math.pow(clamp(w, 0, 1), g.gamma);
  return lerp(g.fMin, g.fMax, w);
}
/* thickness along a stripe: −1 thins towards the end, +1 thins towards the start */
function taperOf(g, v) {
  const tp = g.taper || 0;
  if (!tp) return 1;
  return tp > 0 ? lerp(1 - tp, 1, v) : lerp(1, 1 + tp, v);
}

/* ───── how far each stripe reaches ───── */
function profOf(g, u, q, t) {
  let p;
  switch (g.prof) {
    case 'stair': p = Math.pow(clamp(u, 0, 1), g.pCurve || 1); break;
    case 'peak': p = 1 - Math.abs(2 * clamp(u, 0, 1) - 1); break;
    case 'valley': p = Math.abs(2 * clamp(u, 0, 1) - 1); break;
    case 'growth': { const c = 0.5 + (g.pDrift || 0) * Math.sin(TAU * t); p = 1 / (1 + Math.exp(-9 * (u - c))); break; }
    case 'random': p = vnoise(q, (g.seed | 0) + 31); break;
    default: p = 1;
  }
  p = lerp(g.pLo, g.pHi, p);
  if (g.wob === 'wave') p += g.pAmp * Math.sin(TAU * (g.pFreq * u - Math.round(g.pSpeed) * t));
  else if (g.wob === 'eq') p += g.pAmp * wnoise(u * g.pFreq, t * Math.round(g.pSpeed), (g.seed | 0) + 5);
  return clamp(p, 0, 1);
}

/* local frame for flat stripes: b runs across, a along; angle 0 = vertical stripes growing upwards */
function frameOf(F, angleDeg, cx, cy) {
  const th = angleDeg * DEG;
  const Ax = Math.sin(th), Ay = -Math.cos(th), Bx = Math.cos(th), By = Math.sin(th);
  if (cx == null) { cx = F.x + F.w / 2; cy = F.y + F.h / 2; }
  let bmin = Infinity, bmax = -Infinity, amin = Infinity, amax = -Infinity;
  for (const [x, y] of [[F.x, F.y], [F.x + F.w, F.y], [F.x, F.y + F.h], [F.x + F.w, F.y + F.h]]) {
    const dx = x - cx, dy = y - cy, b = dx * Bx + dy * By, a = dx * Ax + dy * Ay;
    if (b < bmin) bmin = b; if (b > bmax) bmax = b; if (a < amin) amin = a; if (a > amax) amax = a;
  }
  return { Ax, Ay, Bx, By, cx, cy, bmin, bmax, amin, amax, X: (b, a) => cx + b * Bx + a * Ax, Y: (b, a) => cy + b * By + a * Ay };
}

/* dashes along [a0,a1]: a seeded rhythm per line that slides by whole periods per loop */
function dashRun(a0, a1, id, g, t, U, cb) {
  const D = Math.max(2, g.dLen * U);
  const m = 2 + Math.floor(hash(id, (g.seed | 0) + 3) * 4);
  const pat = []; let P = 0;
  for (let j = 0; j < m; j++) {
    const d = D * lerp(0.3, 1.8, hash(id * 7 + j, (g.seed | 0) + 5));
    const gp = D * lerp(0.25, 1.1, hash(id * 13 + j, (g.seed | 0) + 9)) * g.dGap;
    pat.push(d, gp); P += d + gp;
  }
  let sp = 1 + Math.floor(hash(id, (g.seed | 0) + 11) * (g.dVar + 0.999));
  if (g.dAlt && id % 2) sp = -sp;
  sp *= Math.round(g.dSpeed == null ? 1 : g.dSpeed);
  let a = a0 - P + fract(sp * t) * P;
  for (let guard = 0; a < a1 && guard < 4000; guard++) {
    for (let j = 0; j < pat.length; j += 2) {
      const s = Math.max(a, a0), e = Math.min(a + pat[j], a1);
      if (e - s > 0.4) cb(s, e);
      a += pat[j] + pat[j + 1];
      if (a >= a1) break;
    }
  }
}

/* ═════════════ generator: flat stripes ═════════════ */
function genLines(g, t, F, U, out) {
  const fr = frameOf(F, g.angle || 0);
  const span = fr.bmax - fr.bmin, len = fr.amax - fr.amin;
  const N = Math.max(1, Math.round(g.n)), pitch = span / N;
  const B = Math.max(1, Math.round(g.bands || 1));
  const flowK = g.dash ? 0 : Math.round(g.flow || 0);
  const layer = g._layer || 0;
  const tap = a => taperOf(g, (a - fr.amin) / len);
  const rect = (b, a0, a1, hw, u, role, id) => {
    if (a1 - a0 < 0.3) return;
    const h = g.taper ? [hw * tap(a0), hw * tap(a1)] : hw;
    out.push({ k: 'line', p: [fr.X(b, a0), fr.Y(b, a0), fr.X(b, a1), fr.Y(b, a1)], h, u, role: layer ? 1 : role, id });
  };
  for (let bi = 0; bi < B; bi++) {
    const odd = bi % 2 === 1;
    const dir = B > 1 && odd ? -1 : 1;
    const sh = fract(dir * flowK * t + (B > 1 && odd ? g.bandShift : 0) + (g._shift || 0));
    const moving = sh !== 0 || flowK !== 0;
    const ov = B > 1 ? g.bandOv : 0;
    const ba0 = fr.amin + len * Math.max(0, bi / B - ov), ba1 = fr.amin + len * Math.min(1, (bi + 1) / B + ov);
    for (let k = moving ? -1 : 0; k < N; k++) {
      const pos = k + 0.5 + sh, u0 = pos / N, u = g._mirror ? 1 - u0 : u0;
      const uf = B > 1 && odd && g.bandFlip ? 1 - u : u;
      const hw = 0.5 * fillOf(g, uf, pos - 0.5, t) * pitch;
      if (hw < 0.05) continue;
      const b = fr.bmin + pos * pitch;
      const id = k + 1000 * bi + 5000 * layer;
      if (B > 1) {
        if (g.dash) dashRun(ba0, ba1, id, g, t, U, (s, e) => rect(b, s, e, hw, u, bi % 2, id));
        else rect(b, ba0, ba1, hw, u, bi % 2, id);
        continue;
      }
      const P = profOf(g, u, pos - 0.5, t);
      const segs = [];
      if (g.duo && g.anchor !== 'mid') {
        const gap = g.gap * len;
        if (g.anchor === 'end') { const cut = fr.amax - P * len; segs.push([cut + gap / 2, fr.amax, 0], [fr.amin, cut - gap / 2, 1]); }
        else { const cut = fr.amin + P * len; segs.push([fr.amin, cut - gap / 2, 0], [cut + gap / 2, fr.amax, 1]); }
      } else {
        const L = P * len;
        if (g.anchor === 'end') segs.push([fr.amax - L, fr.amax, 0]);
        else if (g.anchor === 'mid') { const m = (fr.amin + fr.amax) / 2; segs.push([m - L / 2, m + L / 2, 0]); }
        else segs.push([fr.amin, fr.amin + L, 0]);
      }
      for (const [a0, a1, role] of segs) {
        if (a1 - a0 < 0.3) continue;
        if (g.dash) dashRun(a0, a1, id + role * 500, g, t, U, (s, e) => rect(b, s, e, hw, u, role, id));
        else rect(b, a0, a1, hw, u, role, id);
      }
    }
  }
}

/* ═════════════ surfaces ═════════════
   Each takes s,r ∈ [−1,1] (and u,v ∈ [0,1]), the params and the phase; writes x,y,z into o.
   y is up, z goes away from the viewer. */
function waveOf(g, u, ph) {
  const f = g.f || 1;
  switch (g.wform) {
    case 'zig': return tri(f * u - ph);
    case 'bump': { const c = 0.5 + 0.28 * Math.sin(TAU * ph); const x = (u - c) / 0.17; return 2 * Math.exp(-x * x) - 1 - 0.55 * Math.exp(-(((u - c - 0.3) / 0.2) ** 2)); }
    case 'step': { const x = fract(f * u - ph); return x < 0.5 ? smooth(x * 4) * 2 - 1 : 1 - smooth((x - 0.5) * 4) * 2; }
    default: return Math.sin(TAU * (f * u - ph));
  }
}
const SURF = {
  /* conoid: rulings from a straight line to a curve, all parallel to one plane */
  conoid(s, r, u, v, g, ph, o) {
    const W = waveOf(g, u, ph);
    o[0] = s * lerp(1 - 0.5 * g.B, 1 + 0.5 * g.B, v); o[1] = lerp(1, -1, v); o[2] = v * g.A * W;
  },
  /* cylindroid: rulings between two different curves */
  cylindroid(s, r, u, v, g, ph, o) {
    const W1 = waveOf(g, u, ph), W2 = waveOf(g, fract(u + g.C), -ph);
    o[0] = s; o[1] = lerp(1, -1, v); o[2] = lerp(g.A * W1, g.B * W2, v);
  },
  /* hyperbolic paraboloid (skew plane): z = A·x·y, straight rulings both ways */
  hypar(s, r, u, v, g, ph, o) {
    const a = g.A * Math.cos(TAU * ph) + g.B;
    o[0] = s; o[1] = r; o[2] = a * s * r + g.C * s;
  },
  /* conical surface: every ruling passes the apex and a wavy directrix */
  fan(s, r, u, v, g, ph, o) {
    const vv = lerp(g.C, 1, v), W = waveOf(g, u, ph);
    const ax = g.B, ay = 1.5, az = 0, bx = s * 1.25, by = -1 + 0.35 * W * g.A, bz = g.A * W;
    o[0] = lerp(ax, bx, vv); o[1] = lerp(ay, by, vv); o[2] = lerp(az, bz, vv);
  },
  /* torse: tangent developable of a twisted cubic, with its cuspidal edge */
  torse(s, r, u, v, g, ph, o) {
    const sw = Math.sin(TAU * ph) * 0.35;
    const cx = 1.3 * s, cy = g.A * (s * s - 0.4) + sw * s, cz = g.B * s * s * s;
    let tx = 1.3, ty = 2 * g.A * s + sw, tz = 3 * g.B * s * s;
    const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    const L = r * g.C;
    o[0] = cx + L * tx; o[1] = cy + L * ty; o[2] = cz + L * tz;
  },
  /* right helicoid: straight rulings turning along an axis */
  helicoid(s, r, u, v, g, ph, o) {
    /* minus: with a positive speed the screw visibly travels up its axis */
    const th = Math.PI * g.B * r - TAU * ph + g.C * Math.PI;
    o[0] = g.A * s * Math.cos(th); o[1] = r; o[2] = g.A * s * Math.sin(th);
  },
  /* translation surface: a profile slid along a parabolic path */
  translation(s, r, u, v, g, ph, o) {
    o[0] = 1.15 * s; o[1] = r * 0.9 + g.B * (s * s - 0.5); o[2] = g.A * Math.sin(TAU * ((g.f || 1) * 0.5 * v - ph)) + g.C * s;
  },
  /* relief: a sheet with a ridge and a trough wandering on a closed path */
  relief(s, r, u, v, g, ph, o) {
    const px = 0.42 * Math.sin(TAU * ph), py = 0.3 * Math.cos(TAU * ph), w = 0.18 + 0.5 * g.B;
    const qx = -px * 0.8, qy = -py - 0.15;
    const z = Math.exp(-((s - px) ** 2 + (r - py) ** 2) / (w * w)) - g.C * Math.exp(-((s - qx) ** 2 + (r - qy) ** 2) / (w * w * 1.6));
    o[0] = s; o[1] = r; o[2] = -g.A * z;
  },
  /* monkey saddle: a cubic surface z = x³ − 3xy², turned by thirds of a turn */
  saddle(s, r, u, v, g, ph, o) {
    const ps = (TAU * ph) / 3, c = Math.cos(ps), sn = Math.sin(ps);
    const x = s * c - r * sn, y = s * sn + r * c;
    o[0] = s; o[1] = r; o[2] = g.A * 0.55 * (x * x * x - 3 * x * y * y) + g.B * s * r;
  },
  /* folded plates: sharp folds, no rounding; the stripes break into planes */
  fold(s, r, u, v, g, ph, o) {
    o[0] = s; o[1] = r; o[2] = g.A * tri((g.f || 1) * 0.5 * (u + g.C * v) - ph) * 0.5 + g.B * r * 0.5;
  },
  /* Plücker conoid: rulings through one axis, height follows sin 2θ */
  plucker(s, r, u, v, g, ph, o) {
    const th = Math.PI * g.B * (v - 0.5) + TAU * ph;
    o[0] = s * Math.cos(th); o[1] = g.A * Math.sin(2 * th); o[2] = s * Math.sin(th);
    o[3] = Math.sin(2 * th) >= 0 ? 0 : 1; /* upper and lower wings take the two colours */
  },
  /* travelling wave sheet */
  wave(s, r, u, v, g, ph, o) {
    const f = g.f || 1;
    o[0] = s; o[1] = r; o[2] = g.A * Math.sin(TAU * (f * 0.5 * s + g.C * r - ph)) + g.B * 0.5 * Math.sin(TAU * (1.7 * f * 0.5 * s - 0.6 * r + ph) + 1.3);
  },
};

/* surfaces that repeat after a fraction of their phase can move slower and still loop:
   the Plücker conoid is the same surface after half a turn */
const KIND_PERIOD = { plucker: 0.5 };
function genSurface(g, t, F, U, out) {
  const fn = SURF[g.kind] || SURF.wave;
  const ph = Math.round(g.k || 0) * t * (KIND_PERIOD[g.kind] || 1) + (g._phase || 0);
  const yaw = (g.yaw + (g._yaw || 0) + g.sway * Math.sin(TAU * t) + 360 * Math.round(g.spin || 0) * t) * DEG;
  const pitch = (g.pitch + (g.swayP || 0) * Math.sin(TAU * t + Math.PI / 2)) * DEG, roll = g.roll * DEG;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const D = lerp(14, 2.2, clamp(g.persp, 0, 1));
  const cx0 = F.x + g.fx * F.w, cy0 = F.y + g.fy * F.h;
  const m = (Math.min(F.w, F.h) / 2) * g.zoom;
  const KX = lerp(m, (F.w / 2) * g.zoom, g.fit), KY = lerp(m, (F.h / 2) * g.zoom, g.fit);
  const fam = g.family === 'v', mir = !!g._mirror;
  const o3 = [0, 0, 0, -1];
  /* evaluate + project: writes screen x,y, depth and camera-space xyz */
  const ev = (u, v, dst, i) => {
    let a = fam ? v : u; const b = fam ? u : v;
    if (mir) a = 1 - a;
    o3[3] = -1;
    fn(2 * a - 1, 2 * b - 1, a, b, g, ph, o3);
    const x = o3[0], y = o3[1], z = o3[2];
    const X = x * cyw + z * syw, Z = -x * syw + z * cyw;
    const Y2 = y * cp - Z * sp, Z2 = y * sp + Z * cp;
    const X3 = X * cr - Y2 * sr, Y3 = X * sr + Y2 * cr;
    const d = D + Z2, f = D / Math.max(0.25, d);
    dst[i] = cx0 + X3 * f * KX; dst[i + 1] = cy0 - Y3 * f * KY; dst[i + 2] = d; dst[i + 3] = X3; dst[i + 4] = Y3; dst[i + 5] = Z2;
  };
  const N = Math.max(1, Math.round(g.n));
  const SEG = 6;
  /* a multiple of SEG keeps the cut points symmetric when a surface's parametrisation runs backwards */
  const M = Math.ceil(clamp(Math.round(g.res || 64), 12, 240) / SEG) * SEG;
  const flowK = Math.round(g.flow || 0), sh = fract(flowK * t);
  const hmin = U * 0.0007 * (g.hair == null ? 1 : g.hair);
  const Lb = new Float64Array((M + 1) * 6), Rb = new Float64Array((M + 1) * 6), CB = new Float64Array(6);
  const lx = -0.42, ly = 0.62, lz = -0.66; /* light from upper left, towards the viewer */
  const layer = g._layer || 0;
  for (let i = flowK ? -1 : 0; i < N; i++) {
    const uc = (i + 0.5 + sh) / N;
    if (uc < -0.5 / N || uc > 1 + 0.5 / N) continue;
    const d0 = (0.5 * fillOf(g, clamp(uc, 0, 1), i, t)) / N;
    const P = profOf(g, clamp(uc, 0, 1), i, t);
    let va = 0, vb = 1;
    if (g.anchor === 'end') va = 1 - P; else if (g.anchor === 'mid') { va = 0.5 - P / 2; vb = 0.5 + P / 2; } else vb = P;
    if (vb - va < 1e-3) continue;
    let alive = false;
    for (let k = 0; k <= M; k++) {
      const v = va + ((vb - va) * k) / M, dd = d0 * taperOf(g, v);
      const uL = clamp(uc - dd, 0, 1), uR = clamp(uc + dd, 0, 1);
      if (uR - uL > 1e-6) alive = true;
      ev(uL, v, Lb, k * 6); ev(uR, v, Rb, k * 6);
    }
    if (!alive) continue;
    ev(clamp(uc, 0, 1), (va + vb) / 2, CB, 0);
    const hint = o3[3];
    /* hairline floor: a band seen edge-on stays a thin line instead of vanishing */
    let px = 0, py = 0;
    for (let k = 0; k <= M; k++) {
      const j = k * 6, cx = (Lb[j] + Rb[j]) / 2, cy = (Lb[j + 1] + Rb[j + 1]) / 2;
      let hx = (Rb[j] - Lb[j]) / 2, hy = (Rb[j + 1] - Lb[j + 1]) / 2;
      const hl = Math.hypot(hx, hy);
      if (hl < hmin) {
        let dx, dy;
        if (hl > 1e-9) { dx = hx / hl; dy = hy / hl; }
        else {
          const j2 = Math.min(M, k + 1) * 6, j1 = Math.max(0, k - 1) * 6;
          const tx = (Lb[j2] + Rb[j2] - Lb[j1] - Rb[j1]) / 2, ty = (Lb[j2 + 1] + Rb[j2 + 1] - Lb[j1 + 1] - Rb[j1 + 1]) / 2, tl = Math.hypot(tx, ty) || 1;
          dx = -ty / tl; dy = tx / tl;
          if (dx * px + dy * py < 0) { dx = -dx; dy = -dy; }
        }
        hx = dx * hmin; hy = dy * hmin;
        Lb[j] = cx - hx; Lb[j + 1] = cy - hy; Rb[j] = cx + hx; Rb[j + 1] = cy + hy;
      }
      px = hx; py = hy;
    }
    /* split into segments by facing, at most SEG quads each, so depth sorting works */
    let a = 0;
    while (a < M) {
      const face0 = faceOf(Lb, Rb, a);
      let b = a + 1;
      while (b < M && b % SEG !== 0 && faceOf(Lb, Rb, b) === face0) b++;
      let dep = 0, lit;
      const L = [], R = [];
      /* one quad of overlap on both sides hides antialiasing seams between pieces */
      const a0 = a > 0 && faceOf(Lb, Rb, a - 1) === face0 ? a - 1 : a;
      const b0 = b < M && faceOf(Lb, Rb, b) === face0 ? b + 1 : b;
      for (let k = a0; k <= b0; k++) {
        const j = k * 6; L.push(Lb[j], Lb[j + 1]); R.push(Rb[j], Rb[j + 1]);
        if (k >= a && k <= b) dep += Lb[j + 2] + Rb[j + 2];
      }
      dep /= 2 * (b - a + 1);
      {
        /* normal from the band's two tangents, in camera space */
        const ja = a * 6, jb = b * 6;
        const ux = Rb[ja + 3] + Rb[jb + 3] - Lb[ja + 3] - Lb[jb + 3], uy = Rb[ja + 4] + Rb[jb + 4] - Lb[ja + 4] - Lb[jb + 4], uz = Rb[ja + 5] + Rb[jb + 5] - Lb[ja + 5] - Lb[jb + 5];
        const vx = Lb[jb + 3] + Rb[jb + 3] - Lb[ja + 3] - Rb[ja + 3], vy = Lb[jb + 4] + Rb[jb + 4] - Lb[ja + 4] - Rb[ja + 4], vz = Lb[jb + 5] + Rb[jb + 5] - Lb[ja + 5] - Rb[ja + 5];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz);
        lit = nl > 1e-12 ? Math.abs((nx * lx + ny * ly + nz * lz) / nl) : 0.5;
      }
      out.push({ k: 'band', L, R, u: clamp(uc, 0, 1), role: layer ? 1 : hint >= 0 ? hint : face0 < 0 ? 1 : 0, id: i + layer * 5000, depth: dep, lit, layer });
      a = b;
    }
  }
}
function faceOf(Lb, Rb, k) {
  const j = k * 6, j2 = j + 6;
  const hx = Rb[j] - Lb[j], hy = Rb[j + 1] - Lb[j + 1];
  const tx = (Lb[j2] + Rb[j2] - Lb[j] - Rb[j]) / 2, ty = (Lb[j2 + 1] + Rb[j2 + 1] - Lb[j + 1] - Rb[j + 1]) / 2;
  return hx * ty - hy * tx >= 0 ? 1 : -1;
}

const GENS = { lines: genLines, surface: genSurface };

/* ───── defaults shared by every generator ───── */
const BASE = {
  n: 40, fMin: 0.12, fMax: 0.62, ramp: 'up', teeth: 1, soft: 0, gamma: 1, rampSpeed: 0, seed: 7, taper: 0,
  prof: 'full', pLo: 0, pHi: 1, pCurve: 1, pDrift: 0, wob: 'none', pAmp: 0.12, pFreq: 1, pSpeed: 1,
  anchor: 'start', duo: false, gap: 0.03, angle: 0, flow: 0,
  dash: false, dLen: 0.05, dGap: 1, dVar: 2, dAlt: false, dSpeed: 1,
  bands: 1, bandOv: 0, bandShift: 0.5, bandFlip: true,
  l2: false, l2Mirror: true, l2Shift: 0.5, l2Yaw: 0, l2Phase: 0.5,
  fx: 0.5, fy: 0.5,
  /* surface */
  kind: 'wave', family: 'u', A: 0.6, B: 0.3, C: 0.3, f: 1, wform: 'sine', k: 1,
  yaw: -28, pitch: 22, roll: 0, persp: 0.45, zoom: 0.82, fit: 0.65, sway: 0, swayP: 0, spin: 0,
  res: 64, hair: 1, shade: 0, fog: 0, glass: 0, zsort: true,
};

/* ───── the catalogue of moves ───── */
const PRESETS = [
  /* flat — the brand base */
  { id: 'razgon', name: 'Разгон', gen: 'lines', color: 'solid',
    g: { n: 46, ramp: 'up', teeth: 2, fMin: 0.1, fMax: 0.68, soft: 0.16, flow: 2 } },
  { id: 'lesenka', name: 'Лесенка', gen: 'lines', color: 'duo',
    g: { n: 26, ramp: 'up', fMin: 0.14, fMax: 0.62, prof: 'stair', pLo: 0.04, pHi: 0.92, duo: true, gap: 0.035, wob: 'wave', pAmp: 0.07, pFreq: 0.8, pSpeed: 1 } },
  { id: 'vstrechnye', name: 'Встречные', gen: 'lines', color: 'solid',
    g: { n: 22, ramp: 'up', fMin: 0.2, fMax: 0.62, taper: -0.5, prof: 'stair', pLo: 0.12, pHi: 0.72, l2: true, l2Mirror: false, l2Shift: 0.5, anchor: 'start', wob: 'wave', pAmp: 0.06, pFreq: 0.7, pSpeed: 1 } },
  { id: 'sdvig', name: 'Сдвиг', gen: 'lines', color: 'solid',
    g: { n: 22, ramp: 'up', fMin: 0.12, fMax: 0.64, bands: 2, bandOv: 0.2, bandShift: 0.5, bandFlip: true, flow: 1 } },
  { id: 'rost', name: 'Рост', gen: 'lines', color: 'spectrum',
    g: { n: 34, ramp: 'up', fMin: 0.16, fMax: 0.7, taper: -0.6, prof: 'growth', pLo: 0.06, pHi: 0.96, pDrift: 0.12, wob: 'wave', pAmp: 0.04, pFreq: 2, pSpeed: 2 } },
  { id: 'potok', name: 'Поток данных', gen: 'lines', color: 'spectrum',
    g: { n: 24, angle: 90, ramp: 'code', fMin: 0.14, fMax: 0.82, dash: true, dLen: 0.14, dGap: 0.5, dVar: 2 } },
  /* surfaces */
  { id: 'konoid', name: 'Коноид', gen: 'surface', color: 'solid',
    g: { kind: 'conoid', n: 48, A: 0.85, B: 0.7, wform: 'bump', k: 1, ramp: 'up', fMin: 0.16, fMax: 0.62, taper: 0.6, yaw: -14, pitch: 24, persp: 0.5, zoom: 1.2, fit: 0.9, fy: 0.3 } },
  { id: 'veer', name: 'Веер', gen: 'surface', color: 'spectrum',
    g: { kind: 'fan', n: 44, A: 0.9, B: -0.9, C: 0.12, f: 1.4, k: 1, ramp: 'up', fMin: 0.14, fMax: 0.7, yaw: -22, pitch: 30, persp: 0.55, zoom: 1.15, fit: 0.75 } },
  { id: 'cilindroid', name: 'Цилиндроид', gen: 'surface', color: 'duo',
    g: { kind: 'cylindroid', n: 36, A: 0.8, B: 0.8, C: 0.37, f: 1, k: 1, ramp: 'up', teeth: 1, fMin: 0.22, fMax: 0.7, yaw: -36, pitch: 34, persp: 0.5, zoom: 1.1, fit: 0.7, shade: 0.25 } },
  { id: 'gipar', name: 'Косая плоскость', gen: 'surface', color: 'duo',
    g: { kind: 'hypar', n: 30, A: 0.35, B: 0.9, C: 0, k: 1, ramp: 'up', fMin: 0.2, fMax: 0.72, yaw: -38, pitch: 26, persp: 0.4, zoom: 1.0, fit: 0.7, l2: true, l2Yaw: 90, shade: 0.2 } },
  { id: 'tors', name: 'Торс', gen: 'surface', color: 'duo',
    g: { kind: 'torse', n: 60, A: 1.1, B: 0.9, C: 1.6, k: 1, ramp: 'vee', fMin: 0.12, fMax: 0.66, yaw: -38, pitch: 14, persp: 0.55, zoom: 1.25, fit: 0.75, shade: 0.3, res: 40 } },
  { id: 'gelikoid', name: 'Геликоид', gen: 'surface', color: 'duo',
    g: { kind: 'helicoid', n: 26, A: 0.75, B: 1.25, C: 0, k: 1, ramp: 'up', fMin: 0.2, fMax: 0.75, yaw: 0, pitch: 12, roll: -18, persp: 0.45, zoom: 1.15, fit: 0.8, res: 96 } },
  { id: 'perenos', name: 'Перенос', gen: 'surface', color: 'spectrum',
    g: { kind: 'translation', n: 32, A: 0.32, B: 0.45, C: 0.3, f: 1.4, k: 1, ramp: 'up', fMin: 0.2, fMax: 0.68, yaw: -32, pitch: 30, persp: 0.5, zoom: 1.1, fit: 0.75, res: 80 } },
  { id: 'relef', name: 'Рельеф', gen: 'surface', color: 'solid',
    g: { kind: 'relief', n: 48, A: 0.85, B: 0.3, C: 0.6, k: 1, ramp: 'up', fMin: 0.18, fMax: 0.66, yaw: -20, pitch: 48, persp: 0.55, zoom: 1.2, fit: 0.8, fog: 0.35, res: 80 } },
  { id: 'sedlo', name: 'Седло', gen: 'surface', color: 'spectrum',
    g: { kind: 'saddle', n: 40, A: 0.75, B: 0, k: 1, ramp: 'wave', teeth: 1, fMin: 0.16, fMax: 0.66, yaw: -24, pitch: 40, persp: 0.5, zoom: 1.05, fit: 0.7, shade: 0.3, res: 72 } },
  { id: 'garmoshka', name: 'Гармошка', gen: 'surface', color: 'duo',
    g: { kind: 'fold', n: 44, A: 0.55, B: 0, C: 0.35, f: 3, k: 1, ramp: 'up', fMin: 0.2, fMax: 0.7, family: 'v', yaw: -34, pitch: 24, persp: 0.45, zoom: 1.1, fit: 0.8, shade: 0.35 } },
  { id: 'plukker', name: 'Плюккер', gen: 'surface', color: 'duo',
    g: { kind: 'plucker', n: 44, A: 0.55, B: 1, k: 1, family: 'v', ramp: 'vee', fMin: 0.14, fMax: 0.7, yaw: -20, pitch: 22, persp: 0.45, zoom: 1.2, fit: 0.75, res: 48, shade: 0.25 } },
  { id: 'volna', name: 'Волна', gen: 'surface', color: 'spectrum',
    g: { kind: 'wave', n: 56, A: 0.35, B: 0.18, C: 0.25, f: 1.2, k: 1, ramp: 'up', teeth: 2, soft: 0.2, fMin: 0.16, fMax: 0.64, yaw: -30, pitch: 34, persp: 0.55, zoom: 1.15, fit: 0.85, fog: 0.3, res: 80 } },
];

/* ───── colour helpers (OKLab mixing so palettes blend without muddy middles) ───── */
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const l2s = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055);
function toOklab(hex) {
  const [R, G, B] = hexToRgb(hex).map(s2l);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return rgbToHex(l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), l2s(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
}
function mixHex(a, b, t) { const A = toOklab(a), B = toOklab(b); return fromOklab([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]); }
function rampLut(cols, n = 64) {
  const out = [];
  if (cols.length === 1) { for (let i = 0; i < n; i++) out.push(cols[0]); return out; }
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (cols.length - 1), k = Math.min(cols.length - 2, Math.floor(x));
    out.push(mixHex(cols[k], cols[k + 1], x - k));
  }
  return out;
}
function luminance(hex) { const [r, g, b] = hexToRgb(hex).map(s2l); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const mixMemo = new Map();
function mixQ(a, b, t) {
  t = Math.round(clamp(t, 0, 1) * 24) / 24;
  if (t === 0) return a;
  const key = a + b + t;
  let v = mixMemo.get(key);
  if (!v) { v = mixHex(a, b, t); if (mixMemo.size > 6000) mixMemo.clear(); mixMemo.set(key, v); }
  return v;
}

/* ───── strips → geometry ───── */
function stripOutline(s) {
  const p = s.p, n = p.length / 2, L = new Float64Array(n * 2), R = new Float64Array(n * 2), h = s.h, arr = typeof h !== 'number';
  for (let i = 0; i < n; i++) {
    const i0 = i > 0 ? i - 1 : 0, i1 = i < n - 1 ? i + 1 : n - 1;
    let tx = p[i1 * 2] - p[i0 * 2], ty = p[i1 * 2 + 1] - p[i0 * 2 + 1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = arr ? h[i] : h;
    L[i * 2] = p[i * 2] - ty * w; L[i * 2 + 1] = p[i * 2 + 1] + tx * w;
    R[i * 2] = p[i * 2] + ty * w; R[i * 2 + 1] = p[i * 2 + 1] - tx * w;
  }
  return [L, R];
}
function edgesOf(s) { return s.k === 'band' ? [s.L, s.R] : stripOutline(s); }
function pathStrip(ctx, s) {
  const [L, R] = edgesOf(s), n = L.length / 2;
  ctx.moveTo(L[0], L[1]);
  for (let k = 1; k < n; k++) ctx.lineTo(L[k * 2], L[k * 2 + 1]);
  for (let k = n - 1; k >= 0; k--) ctx.lineTo(R[k * 2], R[k * 2 + 1]);
  ctx.closePath();
}
function stripSvgD(s, dp) {
  const f = v => +v.toFixed(dp);
  const [L, R] = edgesOf(s), n = L.length / 2;
  let d = `M${f(L[0])} ${f(L[1])}`;
  for (let k = 1; k < n; k++) d += `L${f(L[k * 2])} ${f(L[k * 2 + 1])}`;
  for (let k = n - 1; k >= 0; k--) d += `L${f(R[k * 2])} ${f(R[k * 2 + 1])}`;
  return d + 'Z';
}

/* ───── masks: angular windows only ───── */
function maskPath(m, F) {
  if (!m || m.shape === 'none') return null;
  const s = Math.min(F.w, F.h) * m.size, cx = F.x + m.x * F.w, cy = F.y + m.y * F.h, r = s / 2;
  let pts;
  switch (m.shape) {
    case 'square': pts = [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]]; break;
    case 'diamond': pts = [[cx, cy - r * 1.2], [cx + r * 0.85, cy], [cx, cy + r * 1.2], [cx - r * 0.85, cy]]; break;
    case 'tri': pts = [[cx - r * 1.1, cy + r * 0.95], [cx + r * 1.1, cy + r * 0.95], [cx + r * 1.1, cy - r * 0.95]]; break;
    case 'slant': pts = [[cx - r * 0.55, cy - r], [cx + r * 0.95, cy - r], [cx + r * 0.55, cy + r], [cx - r * 0.95, cy + r]]; break;
    case 'band': { const w = r * 0.55, L = Math.hypot(F.w, F.h); pts = [[cx - L - w, cy + L], [cx - L + w, cy + L], [cx + L + w, cy - L], [cx + L - w, cy - L]]; break; }
    default: return null;
  }
  return [['poly', pts]];
}
function maskToCanvas(ctx, path) {
  ctx.beginPath();
  for (const c of path) {
    if (c[0] === 'poly') { const p = c[1]; ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); }
    else if (c[0] === 'rr') roundRectPath(ctx, c[1], c[2], c[3], c[4], c[5] || 0);
  }
}
function maskToSvgD(path) {
  let d = '';
  const f = v => +v.toFixed(2);
  for (const c of path) {
    if (c[0] === 'poly') d += 'M' + c[1].map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
    else if (c[0] === 'rr') d += roundRectD(c[1], c[2], c[3], c[4], c[5] || 0);
  }
  return d;
}
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  if (r < 0.01) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function roundRectD(x, y, w, h, r) {
  r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  const f = v => +v.toFixed(2);
  if (r < 0.01) return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

/* run a generator (plus its second, overlapping layer) */
function buildStrips(gen, g, t, F, U) {
  const out = [];
  const fn = GENS[gen] || genLines;
  fn(g, t, F, U, out);
  if (g.l2) {
    const g2 = Object.assign({}, g, { _layer: 1 });
    if (gen === 'lines') {
      g2.anchor = g.anchor === 'end' ? 'start' : g.anchor === 'mid' ? 'mid' : 'end';
      g2._shift = g.l2Shift; g2._mirror = g.l2Mirror; g2.duo = false;
    } else {
      g2._mirror = g.l2Mirror; g2._yaw = g.l2Yaw; g2._phase = g.l2Phase;
    }
    fn(g2, t, F, U, out);
  }
  if (gen === 'surface') {
    let dmin = Infinity, dmax = -Infinity;
    for (const s of out) { if (s.depth < dmin) dmin = s.depth; if (s.depth > dmax) dmax = s.depth; }
    const span = dmax - dmin || 1;
    for (const s of out) s.fogv = (s.depth - dmin) / span;
    if (g.zsort) out.sort((a, b) => b.depth - a.depth);
  }
  return out;
}
/* give each strip its colour: palette mode, then light and depth fog */
function colorize(strips, mode, lut, pal, o) {
  const n = lut.length - 1;
  const shade = (o && o.shade) || 0, fog = (o && o.fog) || 0;
  for (const s of strips) {
    let c;
    if (mode === 'duo') c = s.role ? pal[1] || pal[0] : pal[0];
    else if (mode === 'spectrum') c = lut[Math.round(clamp(s.u, 0, 1) * n)];
    else if (mode === 'alt') c = pal[((s.id % pal.length) + pal.length) % pal.length];
    else c = pal[0];
    if (shade > 0 && s.lit != null) c = mixQ(c, o.dark, shade * (1 - s.lit));
    if (fog > 0 && s.fogv != null) c = mixQ(c, o.bg, fog * s.fogv);
    s.col = c;
  }
  return strips;
}
