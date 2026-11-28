/** three.js sahnesi: kupa geometrisi, ışık, döndürme ve ekran görüntüsü. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { MugColors, MugModel } from '@/lib/mug3d';
import { MAGIC_COLD, printSize } from '@/lib/mug3d';
import { bounds, buildBody, buildHandle, buildSaucer, paintHandle } from './geometry';
import { SIDES, SIDE_LABELS, SideId } from '@/lib/design-sides';

const FOV = 26;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.6;
const MIN_TILT = -0.05;
const MAX_TILT = 0.75;
const SHOT_WIDTH = 960;
const SHOT_HEIGHT = 720;

export interface View { turn: number; tilt: number }
export const VIEWS = {
  front: { turn: 0, tilt: 0.27 },
  back: { turn: Math.PI, tilt: 0.27 },
  handle: { turn: -Math.PI / 2, tilt: 0.27 },
} satisfies Record<string, View>;

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
  const bandMaterial = new THREE.MeshPhysicalMaterial(glaze);
  const handleMaterial = new THREE.MeshPhysicalMaterial({ ...glaze, vertexColors: true });
  // Yatay duran tabak tavan ışığını çok yansıtır; koyu renk gri görünmesin diye parlaklığı kısılır.
  const saucerMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.1, specularIntensity: 0.3, side: THREE.DoubleSide });

  // `mug` döner; tabaklı fincanda kupa tabağın yuvasına oturur.
  const mug = new THREE.Group();
  const cup = new THREE.Group();
  cup.position.y = model.saucer?.seat ?? 0;
  mug.add(cup);
  cup.add(buildBody(model, outer, inner, bandMaterial));
  const handle = buildHandle(model);
  handle.forEach((part) => cup.add(new THREE.Mesh(part.geometry, handleMaterial)));
  if (model.saucer) mug.add(buildSaucer(model, saucerMaterial));
  const size3d = bounds(model);

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
    cup.add(mesh);
    return { sheet, texture, mesh };
  };
  const prints: Record<SideId, ReturnType<typeof buildPrint>> = { front: buildPrint(0), back: buildPrint(Math.PI) };
  prints.back.mesh.visible = false;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(1.6, size3d.left * 2.25), Math.max(1.6, size3d.left * 2.25)),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.62 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.004;
  scene.add(shadow, mug);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const raycaster = new THREE.Raycaster();
  const target = new THREE.Vector3(0, size3d.top * (model.saucer ? 0.3 : 0.4), 0);
  const now: View & { zoom: number } = { ...VIEWS.front, zoom: 1 };
  const goal = { ...now };
  let spinning = false;
  // Sihirli Kupa: 1 sıcak (baskı görünür), 0 soğuk (siyah).
  let heat = 1;
  let heatGoal = 1;
  let hot = new THREE.Color();
  const cold = new THREE.Color(MAGIC_COLD);
  const applyHeat = (value: number) => {
    if (model.finish !== 'magic') return;
    outer.color.copy(cold).lerp(hot, value);
    handleMaterial.color.copy(cold).lerp(new THREE.Color(1, 1, 1), value);
    SIDES.forEach((id) => { (prints[id].mesh.material as THREE.MeshPhysicalMaterial).opacity = value; });
  };
  let frame = 0;
  let disposed = false;

  const place = (view: View, zoom: number) => {
    mug.rotation.y = view.turn;
    // Kulp dönerken de kadraja sığsın: yarı genişlik ve yarı yükseklik.
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const halfHeight = Math.max(0.58, size3d.top * 0.62 + (model.saucer ? 0.27 : 0.15));
    const halfWidth = size3d.right + 0.1;
    const distance = Math.max(halfHeight / t, halfWidth / (t * camera.aspect)) / zoom;
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
    if (Math.abs(heatGoal - heat) > 0.002) { heat += (heatGoal - heat) * 0.08; moving = true; } else heat = heatGoal;
    applyHeat(heat);
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
    /**
     * Ekran noktasının baskı alanındaki yeri (0–1, sol üstten). Nokta baskı alanında değilse
     * ya da önünde kulp varsa null.
     */
    pick: (clientX: number, clientY: number): { side: SideId; u: number; v: number } | null => {
      const r = renderer.domElement.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      mug.updateMatrixWorld();
      const first = raycaster.intersectObject(mug, true).find((h) => h.object.visible);
      const side = SIDES.find((id) => prints[id].mesh === first?.object);
      return side && first?.uv ? { side, u: first.uv.x, v: 1 - first.uv.y } : null;
    },
    setBackVisible: (on: boolean) => { prints.back.mesh.visible = on; request(); },
    setColors: (c: MugColors) => {
      outer.color.set(c.body);
      inner.color.set(c.inner);
      bandMaterial.color.set(c.band);
      saucerMaterial.color.set(c.saucer);
      handle.forEach((part) => paintHandle(part, model, c));
      hot = new THREE.Color(c.body);
      applyHeat(heat);
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
    setCold: (on: boolean) => { heatGoal = on ? 0 : 1; request(); },
    /**
     * Verilen zemin rengiyle JPEG yapar. Tek yüzde önden kare görüntü (küçük resimde kulp kesilmesin);
     * iki yüzde ön ve arka yan yana, altlarında adlarıyla.
     */
    snapshot: (background: string, twoSided = false): Promise<Blob | null> => {
      // Ekrandaki alan küçük ya da gizli olsa da görüntü aynı boyda alınır.
      const shown = renderer.getSize(new THREE.Vector2());
      const ratio = renderer.getPixelRatio();
      const aspect = camera.aspect;
      renderer.setPixelRatio(1);
      renderer.setSize(SHOT_WIDTH, SHOT_HEIGHT, false);
      camera.aspect = SHOT_WIDTH / SHOT_HEIGHT;
      camera.updateProjectionMatrix();
      const { width, height } = renderer.domElement;
      const restore = () => {
        renderer.setPixelRatio(ratio);
        renderer.setSize(shown.x, shown.y, false);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        place(now, now.zoom);
        renderer.render(scene, camera);
      };
      const out = document.createElement('canvas');
      const ctx = out.getContext('2d');
      if (!ctx) { restore(); return Promise.resolve(null); }
      out.width = twoSided ? height * 2 : Math.max(width, height);
      out.height = twoSided ? height : out.width;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, out.width, out.height);
      // Sepet görüntüsünde baskı görünür.
      applyHeat(1);
      if (twoSided) {
        SIDES.forEach((side, i) => {
          place(VIEWS[side], 1);
          camera.updateMatrixWorld();
          renderer.render(scene, camera);
          // Kulp bir yana taşar: kesit, kupanın ekrandaki sınırlarına göre alınır.
          const edge = (x: number) => ((new THREE.Vector3(x, target.y, 0).project(camera).x + 1) / 2) * width;
          const a = edge(side === 'front' ? -size3d.left : -size3d.right);
          const b = edge(side === 'front' ? size3d.right : size3d.left);
          const crop = Math.max(height, (b - a) * 1.08);
          const fitted = (height * height) / crop;
          ctx.drawImage(renderer.domElement, (a + b - crop) / 2, 0, crop, height, i * height, (height - fitted) / 2, height, fitted);
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
      applyHeat(heat);
      restore();
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
