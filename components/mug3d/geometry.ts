/** Kupa parçalarının geometrisi: gövde, kulp ve tabak. */
import * as THREE from 'three';
import type { MugColors, MugModel, Tube } from '@/lib/mug3d';

const WALL = 0.04;
const STEPS = 10;

/** Döner yüzey: profil noktaları (x: eksenden uzaklık, y: yükseklik). */
const lathe = (points: [number, number][]) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 128);

/** Ayak köşesinden düz gövdeye giden çeyrek elips. */
function corner(fromX: number, fromY: number, toX: number, toY: number): [number, number][] {
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const a = (i / STEPS) * (Math.PI / 2);
    return [fromX + (toX - fromX) * Math.sin(a), fromY + (toY - fromY) * (1 - Math.cos(a))];
  });
}

/** Ağız dudağının yarım yuvarlağı (dıştan içe). */
function rim(r: number, lip: number, from: number, to: number): [number, number][] {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const a = ((from + i) / 12) * Math.PI;
    return [r - WALL / 2 + (WALL / 2) * Math.cos(a), lip + (WALL / 2) * Math.sin(a)];
  });
}

export function buildBody({ radius: r, height: h, base, band }: MugModel, outer: THREE.Material, inner: THREE.Material, bottom: THREE.Material) {
  const group = new THREE.Group();
  const lip = h - WALL / 2;
  const { radius: rb, foot, rise } = base;
  const outside: [number, number][] = [
    [0, 0.012], [rb - 0.025, 0.012], [rb - 0.012, 0], [rb - 0.002, foot * 0.5],
    ...corner(rb, foot, r, rise),
    [r, lip], ...rim(r, lip, 1, 6),
  ];
  if (band) {
    // Renkli alt bant: profil bant yüksekliğinden ikiye ayrılır.
    const low = outside.filter(([, y], i) => i < outside.length - 7 && y < band);
    group.add(new THREE.Mesh(lathe([...low, [r, band]]), bottom));
    group.add(new THREE.Mesh(lathe([[r, band], ...outside.filter(([, y]) => y > band)]), outer));
  } else {
    group.add(new THREE.Mesh(lathe(outside), outer));
  }
  const floor = foot + 0.055;
  const inside: [number, number][] = [
    ...rim(r, lip, 6, 12),
    ...corner(rb - WALL - 0.02, floor, r - WALL, Math.max(rise, floor + 0.055)).reverse(),
    [0, floor],
  ];
  group.add(new THREE.Mesh(lathe(inside), inner));
  return group;
}

/** Tabak: dipten kalkık kenara, oradan ortadaki yuvaya. */
export function buildSaucer({ saucer }: MugModel, material: THREE.Material) {
  const { radius: r, height: h, seat } = saucer!;
  return new THREE.Mesh(lathe([
    [0, 0.01], [r * 0.72, 0.01], [r * 0.76, 0], [r * 0.9, 0.018], [r * 0.975, 0.06], [r, h * 0.8],
    [r - 0.012, h], [r - 0.04, h], [r - 0.065, h * 0.78], [r - 0.12, seat * 0.95], [r * 0.6, seat * 0.8], [0, seat * 0.8],
  ]), material);
}

export interface HandlePart { geometry: THREE.BufferGeometry; tube: Tube; /** Borunun halka sayısı; kapakta 0. */ rings: number; around: number }

const withColors = (geometry: THREE.BufferGeometry) => {
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
  return geometry;
};

/** Kulp: orta çizgi boyunca boru; kapaklı parçaların uçları yuvarlatılır. */
export function buildHandle(model: MugModel): HandlePart[] {
  return model.tubes.flatMap((tube) => {
    const curve = new THREE.CatmullRomCurve3(tube.path.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
    const rings = 160;
    const around = 32;
    const body = new THREE.TubeGeometry(curve, rings, tube.radius, around, false);
    body.scale(1, 1, tube.depth);
    const parts: HandlePart[] = [{ geometry: withColors(body), tube, rings, around }];
    if (tube.caps) {
      [tube.path[0], tube.path[tube.path.length - 1]].forEach(([x, y]) => {
        const cap = new THREE.SphereGeometry(tube.radius, around, 16);
        cap.scale(1, 1, tube.depth);
        cap.translate(x, y, 0);
        parts.push({ geometry: withColors(cap), tube, rings: 0, around });
      });
    }
    return parts;
  });
}

/** Kulbun renkleri: gövdeye bağlanan uçlar gövde renginde başlar; bantlı kupada alt kısım bant rengidir. */
export function paintHandle(part: HandlePart, model: MugModel, colors: MugColors) {
  const attribute = part.geometry.attributes.color as THREE.BufferAttribute;
  const position = part.geometry.attributes.position;
  const body = new THREE.Color(colors.body);
  const handle = new THREE.Color(colors.handle);
  const band = new THREE.Color(colors.band);
  const mixed = new THREE.Color();
  const { from, to } = part.tube;
  for (let i = 0; i < attribute.count; i += 1) {
    if (model.band) {
      mixed.copy(band).lerp(body, THREE.MathUtils.smoothstep(position.getY(i), model.band - 0.004, model.band + 0.004));
    } else {
      const t = part.rings ? Math.floor(i / (part.around + 1)) / part.rings : 0.5;
      let k = 1;
      if (from) k *= THREE.MathUtils.smoothstep(t, from - 0.018, from + 0.018);
      if (to) k *= THREE.MathUtils.smoothstep(1 - t, to - 0.018, to + 0.018);
      mixed.copy(body).lerp(handle, k);
    }
    attribute.setXYZ(i, mixed.r, mixed.g, mixed.b);
  }
  attribute.needsUpdate = true;
}

/** Kupanın kadraja sığması için ölçüler: yükseklik, kulp tarafı ve öbür tarafın uzaklığı. */
export function bounds(model: MugModel) {
  const handle = Math.max(model.radius, ...model.tubes.flatMap((t) => t.path.map(([x]) => x + t.radius)));
  const plate = model.saucer?.radius ?? 0;
  return {
    top: model.height + (model.saucer?.seat ?? 0),
    right: Math.max(handle, plate),
    left: Math.max(model.radius, plate),
  };
}
