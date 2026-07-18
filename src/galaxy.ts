import * as THREE from "three";
import type { Lesson, Module } from "./types";

interface GalaxyOptions {
  host: HTMLElement;
  modules: Module[];
  lessons: Lesson[];
  completed: Set<string>;
  onModule: (module: Module) => void;
  onLesson: (lesson: Lesson) => void;
}

function seededRandom(seed = 7041): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export interface GalaxyController {
  dispose: () => void;
  setCompleted: (ids: Set<string>) => void;
  setVisibleLessons: (ids: Set<string>) => void;
}

export function initGalaxy(options: GalaxyOptions): GalaxyController {
  const { host, modules, lessons, completed, onModule, onLesson } = options;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b17, 0.028);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
  camera.position.set(0, 5, 28);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x070b17, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.className = "galaxy-canvas";
  host.prepend(renderer.domElement);

  const random = seededRandom();
  const starPositions = new Float32Array(600 * 3);
  for (let i = 0; i < starPositions.length; i += 3) {
    const radius = 18 + random() * 34;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i + 1] = radius * Math.cos(phi);
    starPositions[i + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x92a6d0, size: 0.055, transparent: true, opacity: 0.58 }));
  scene.add(stars);

  const clickable: THREE.Object3D[] = [];
  const completionRings = new Map<string, THREE.Mesh>();
  const modulePositions = new Map<string, THREE.Vector3>();
  modules.forEach((module, index) => {
    const angle = (index / modules.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 8.3 + (index % 3) * 0.7;
    const position = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * 5.3, Math.sin(angle * 1.6) * 2.2);
    modulePositions.set(module.id, position);
    const color = new THREE.Color(module.color);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.64, 20, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 }));
    glow.scale.setScalar(1.65);
    glow.position.copy(position);
    scene.add(glow);
    const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.53, 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    node.position.copy(position);
    node.userData = { type: "module", id: module.id, label: `${module.title} · 第${module.lessonRange[0]}–${module.lessonRange[1]}课` };
    scene.add(node);
    clickable.push(node);

    const moduleLessons = lessons.filter((lesson) => lesson.moduleId === module.id);
    moduleLessons.forEach((lesson, lessonIndex) => {
      const lessonAngle = (lessonIndex / moduleLessons.length) * Math.PI * 2 + angle;
      const orbitRadius = 1.35 + lessonIndex * 0.12;
      const lessonPosition = position.clone().add(new THREE.Vector3(Math.cos(lessonAngle) * orbitRadius, Math.sin(lessonAngle) * orbitRadius * 0.62, Math.sin(lessonAngle * 1.4) * 0.35));
      const lessonNode = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      lessonNode.position.copy(lessonPosition);
      lessonNode.userData = { type: "lesson", id: lesson.id, label: `${String(lesson.number).padStart(2, "0")} · ${lesson.title}` };
      scene.add(lessonNode);
      clickable.push(lessonNode);
      const connectionGeometry = new THREE.BufferGeometry().setFromPoints([position, lessonPosition]);
      scene.add(new THREE.Line(connectionGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 })));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      ring.position.copy(lessonPosition);
      ring.lookAt(camera.position);
      ring.visible = completed.has(lesson.id);
      completionRings.set(lesson.id, ring);
      scene.add(ring);
    });
  });

  const modulePath = new THREE.BufferGeometry().setFromPoints(modules.map((module) => modulePositions.get(module.id)!).concat(modulePositions.get(modules[0]!.id)!));
  scene.add(new THREE.Line(modulePath, new THREE.LineBasicMaterial({ color: 0x89a0d0, transparent: true, opacity: 0.18 })));

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.4;
  const pointer = new THREE.Vector2();
  const tooltip = host.querySelector<HTMLElement>("[data-galaxy-tooltip]")!;
  let hovered: THREE.Object3D | null = null;
  let isVisible = true;
  let animationFrame = 0;

  const updatePointer = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    hovered = raycaster.intersectObjects(clickable, false)[0]?.object ?? null;
    renderer.domElement.style.cursor = hovered ? "pointer" : "default";
    if (hovered) {
      tooltip.hidden = false;
      tooltip.textContent = hovered.userData.label as string;
      tooltip.style.left = `${event.clientX - rect.left + 14}px`;
      tooltip.style.top = `${event.clientY - rect.top + 14}px`;
    } else tooltip.hidden = true;
  };

  const click = () => {
    if (!hovered) return;
    if (hovered.userData.type === "module") {
      const module = modules.find((item) => item.id === hovered!.userData.id);
      if (module) {
        onModule(module);
        const target = modulePositions.get(module.id)!;
        camera.position.lerp(target.clone().add(new THREE.Vector3(0, 1.4, 8.5)), 0.72);
        camera.lookAt(target);
      }
    } else {
      const lesson = lessons.find((item) => item.id === hovered!.userData.id);
      if (lesson) onLesson(lesson);
    }
  };

  const resize = () => {
    const width = host.clientWidth;
    const height = Math.max(480, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(([entry]) => { isVisible = Boolean(entry?.isIntersecting); }, { rootMargin: "160px" });
  intersectionObserver.observe(host);
  const visibility = () => { isVisible = !document.hidden; };
  document.addEventListener("visibilitychange", visibility);
  renderer.domElement.addEventListener("pointermove", updatePointer);
  renderer.domElement.addEventListener("pointerleave", () => { hovered = null; tooltip.hidden = true; });
  renderer.domElement.addEventListener("click", click);

  const startedAt = performance.now();
  const animate = () => {
    animationFrame = requestAnimationFrame(animate);
    if (!isVisible) return;
    const elapsed = (performance.now() - startedAt) / 1000;
    stars.rotation.y = elapsed * 0.006;
    clickable.forEach((node, index) => {
      if (node.userData.type === "module") node.scale.setScalar(1 + Math.sin(elapsed * 1.2 + index) * 0.045);
    });
    renderer.render(scene, camera);
  };
  resize();
  animate();

  const setVisibleLessons = (ids: Set<string>) => {
    const visibleModules = new Set(lessons.filter((lesson) => ids.has(lesson.id)).map((lesson) => lesson.moduleId));
    clickable.forEach((node) => {
      const material = (node as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const visible = node.userData.type === "lesson" ? ids.has(node.userData.id as string) : visibleModules.has(node.userData.id as string);
      material.opacity = visible ? (node.userData.type === "lesson" ? 0.9 : 1) : 0.16;
      node.scale.setScalar(visible ? 1 : 0.72);
    });
  };

  const setCompleted = (ids: Set<string>) => completionRings.forEach((ring, id) => { ring.visible = ids.has(id); });

  const dispose = () => {
    cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect(); intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    renderer.domElement.removeEventListener("pointermove", updatePointer);
    renderer.domElement.removeEventListener("click", click);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        object.geometry.dispose();
        const material = object.material as THREE.Material | THREE.Material[];
        (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
      }
    });
    renderer.dispose(); renderer.domElement.remove();
  };
  return { dispose, setCompleted, setVisibleLessons };
}
