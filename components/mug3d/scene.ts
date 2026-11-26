/** three.js sahnesi: kupa geometrisi, ışık, döndürme ve ekran görüntüsü. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { MugColors, MugModel } from '@/lib/mug3d';
import { printSize } from '@/lib/mug3d';
import { SIDES, SIDE_LABELS, SideId } from '@/lib/design-sides';

const FOV = 26;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.6;
const MIN_TILT = -0.05;
const MAX_TILT = 0.75;

export interface View { turn: number; tilt: number }
export const VIEWS = {
  front: { turn: 0, tilt: 0.27 },
  back: { turn: Math.PI, tilt: 0.27 },
  handle: { turn: -Math.PI / 2, tilt: 0.27 },
} satisfies Record<string, View>;

/** Döner yüzey için profil noktaları (x: eksenden uzaklık, y: yükseklik). */
const profile = (points: [number, number][]) => points.map(([x, y]) => new THREE.Vector2(x, y));

function buildBody({ radius: r, height: h }: MugModel, outer: THREE.Material, inner: THREE.Material) {
  const group = new THREE.Group();
  const wall = 0.04;
  const lip = h - wall / 2;
  // Dış yüzey: taban, yuvarlatılmış alt köşe, düz gövde, ağzın dış yarısı.
  const outside: [number, number][] = [[0, 0.012], [r - 0.07, 0.012], [r - 0.045, 0], [r - 0.018, 0.004], [r - 0.004, 0.02], [r, 0.05], [r, lip]];
  for (let i = 1; i <= 6; i += 1) {
    const a = (i / 12) * Math.PI;
    outside.push([r - wall / 2 + (wall / 2) * Math.cos(a), lip + (wall / 2) * Math.sin(a)]);
  }
  // İç yüzey: ağzın iç yarısından tabana.
  const inside: [number, number][] = [];
  for (let i = 6; i <= 12; i += 1) {
    const a = (i / 12) * Math.PI;
    inside.push([r - wall / 2 + (wall / 2) * Math.cos(a), lip + (wall / 2) * Math.sin(a)]);
  }
  inside.push([r - wall, 0.12], [r - wall - 0.02, 0.08], [r - wall - 0.06, 0.065], [0, 0.065]);
  group.add(new THREE.Mesh(new THREE.LatheGeometry(profile(outside), 128), outer));
  group.add(new THREE.Mesh(new THREE.LatheGeometry(profile(inside), 128), inner));
  return group;
}

/** Kulp: orta çizgi boyunca boru; gövdeye bağlandığı uçlar gövde renginde başlar. */
function buildHandle(model: MugModel) {
  const curve = new THREE.CatmullRomCurve3(model.handle.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, 160, model.handleThickness, 32, false);
  geometry.scale(1, 1, 1.35);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
  return geometry;
}

function paintHandle(geometry: THREE.TubeGeometry, body: string, handle: string) {
  const colors = geometry.attributes.color as THREE.BufferAttribute;
  const { tubularSegments, radialSegments } = geometry.parameters;
  const a = new THREE.Color(body);
  const b = new THREE.Color(handle);
  const mixed = new THREE.Color();
  for (let i = 0; i <= tubularSegments; i += 1) {
    const t = i / tubularSegments;
    const edge = Math.min(t, 1 - t);
    const k = THREE.MathUtils.smoothstep(edge, 0.1, 0.135);
    mixed.copy(a).lerp(b, k);
    for (let j = 0; j <= radialSegments; j += 1) colors.setXYZ(i * (radialSegments + 1) + j, mixed.r, mixed.g, mixed.b);
  }
  colors.needsUpdate = true;
}

function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export function createMugScene(host: HTMLElement, model: MugModel) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.75;
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-2.2, 3.2, 2.4);
  scene.add(key);

  const glaze = { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 };
  const outer = new THREE.MeshPhysicalMaterial(glaze);
  const inner = new THREE.MeshPhysicalMaterial({ ...glaze, side: THREE.DoubleSide });
  const handleMaterial = new THREE.MeshPhysicalMaterial({ ...glaze, vertexColors: true });

  const mug = new THREE.Group();
  mug.add(buildBody(model, outer, inner));
  const handleGeometry = buildHandle(model);
  mug.add(new THREE.Mesh(handleGeometry, handleMaterial));

  // Baskı: gövdenin hemen üstünde, ön ve arka yüzü saran ince silindir parçaları.
  const size = printSize(model);
  const { angle, height, centerY } = model.print;
  const buildPrint = (middle: number) => {
    const sheet = document.createElement('canvas');
    sheet.width = size.width;
    sheet.height = size.height;
    const texture = new THREE.CanvasTexture(sheet);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(model.radius + 0.0012, model.radius + 0.0012, height, 128, 1, true, middle - angle / 2, angle),
      new THREE.MeshPhysicalMaterial({ ...glaze, map: texture, transparent: true, depthWrite: false }),
    );
    mesh.position.y = centerY;
    mug.add(mesh);
    return { sheet, texture, mesh };
  };
  const prints: Record<SideId, ReturnType<typeof buildPrint>> = { front: buildPrint(0), back: buildPrint(Math.PI) };
  prints.back.mesh.visible = false;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.62 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.004;
  scene.add(shadow, mug);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const target = new THREE.Vector3(0, model.height * 0.4, 0);
  const now: View & { zoom: number } = { ...VIEWS.front, zoom: 1 };
  const goal = { ...now };
  let spinning = false;
  let frame = 0;
  let disposed = false;

  const place = (view: View, zoom: number) => {
    mug.rotation.y = view.turn;
    // Kulp dönerken de kadraja sığsın: yarı genişlik ve yarı yükseklik.
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const distance = Math.max(0.74 / t, 0.98 / (t * camera.aspect)) / zoom;
    camera.position.set(0, target.y + Math.sin(view.tilt) * distance, Math.cos(view.tilt) * distance);
    camera.lookAt(target);
  };

  const tick = () => {
    frame = 0;
    if (disposed) return;
    if (spinning) goal.turn += 0.012;
    let moving = spinning;
    for (const k of ['turn', 'tilt', 'zoom'] as const) {
      const d = goal[k] - now[k];
      if (Math.abs(d) > 0.0005) { now[k] += d * 0.18; moving = true; } else now[k] = goal[k];
    }
    place(now, now.zoom);
    renderer.render(scene, camera);
    if (moving) request();
  };
  const request = () => { if (!frame && !disposed) frame = requestAnimationFrame(tick); };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Boyut değişince tuval silinir: hemen çiz.
    place(now, now.zoom);
    renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return {
    sheets: { front: prints.front.sheet, back: prints.back.sheet },
    canvas: renderer.domElement,
    printChanged: (side: SideId) => { prints[side].texture.needsUpdate = true; request(); },
    setBackVisible: (on: boolean) => { prints.back.mesh.visible = on; request(); },
    setColors: (c: MugColors) => {
      outer.color.set(c.body);
      inner.color.set(c.inner);
      paintHandle(handleGeometry, c.body, c.handle);
      request();
    },
    turnBy: (dx: number, dy: number) => {
      spinning = false;
      goal.turn += dx;
      goal.tilt = THREE.MathUtils.clamp(goal.tilt + dy, MIN_TILT, MAX_TILT);
      request();
    },
    zoomBy: (factor: number) => { goal.zoom = THREE.MathUtils.clamp(goal.zoom * factor, MIN_ZOOM, MAX_ZOOM); request(); },
    show: (view: View) => {
      spinning = false;
      // En kısa yoldan dön.
      const full = Math.PI * 2;
      goal.turn = view.turn + Math.round((now.turn - view.turn) / full) * full;
      goal.tilt = view.tilt;
      goal.zoom = 1;
      request();
    },
    setSpinning: (on: boolean) => { spinning = on; request(); },
    /**
     * Verilen zemin rengiyle JPEG yapar. Tek yüzde önden kare görüntü (küçük resimde kulp kesilmesin);
     * iki yüzde ön ve arka yan yana, altlarında adlarıyla.
     */
    snapshot: (background: string, twoSided = false): Promise<Blob | null> => {
      const { width, height } = renderer.domElement;
      const out = document.createElement('canvas');
      const ctx = out.getContext('2d');
      if (!ctx) return Promise.resolve(null);
      out.width = twoSided ? height * 2 : Math.max(width, height);
      out.height = twoSided ? height : out.width;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, out.width, out.height);
      if (twoSided) {
        // Kulp bir yana taşar: kare kesit kulbun tarafına kaydırılır.
        const shift = height * 0.115;
        SIDES.forEach((side, i) => {
          place(VIEWS[side], 1);
          renderer.render(scene, camera);
          const from = (width - height) / 2 + (side === 'front' ? shift : -shift);
          ctx.drawImage(renderer.domElement, from, 0, height, height, i * height, 0, height, height);
          ctx.fillStyle = '#17171A';
          ctx.font = `700 ${Math.round(height * 0.055)}px 'Archivo Variable', sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(SIDE_LABELS[side], i * height + height / 2, height * 0.95);
        });
      } else {
        place(VIEWS.front, 1);
        renderer.render(scene, camera);
        ctx.drawImage(renderer.domElement, (out.width - width) / 2, (out.height - height) / 2);
      }
      request();
      return new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.9));
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        const m = o.material as THREE.MeshPhysicalMaterial;
        m.map?.dispose();
        m.dispose();
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

export type MugScene = ReturnType<typeof createMugScene>;
