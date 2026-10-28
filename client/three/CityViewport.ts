import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CityNarrative, DepartmentState } from "../../shared/types";
import { buildCity } from "./cityScene";
import { applyServiceStates } from "./services";

export interface ProjectedLabel {
  x: number;
  y: number;
  visible: boolean;
}
export interface CityViewport {
  update(departments: DepartmentState[], narrative?: CityNarrative): void;
  select(id: string | null): void;
  zoom(direction: number): void;
  reset(): void;
  setAnimated(value: boolean): void;
  dispose(): void;
}
interface Options {
  onSelect(id: string): void;
  onLabels(labels: Record<string, ProjectedLabel>): void;
  onFailure(): void;
}
export function makeCamera(width: number, height: number) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const viewHeight = Math.max(27, 43 / aspect);
  const camera = new THREE.OrthographicCamera(
    (-viewHeight * aspect) / 2,
    (viewHeight * aspect) / 2,
    viewHeight / 2,
    -viewHeight / 2,
    0.1,
    180,
  );
  camera.position.set(30, 27, 33);
  camera.lookAt(0, 0.6, 0);
  return camera;
}

export function createCityViewport(
  host: HTMLDivElement,
  options: Options,
): CityViewport {
  const cleanup: (() => void)[] = [];
  let disposed = false,
    frame = 0;
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    while (cleanup.length) {
      try {
        cleanup.pop()!();
      } catch {
        /* Completar las demás liberaciones. */
      }
    }
  }

  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "low-power",
    });
    cleanup.push(() => renderer.dispose());
    const world = buildCity();
    cleanup.push(() => world.dispose());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.city3d = "true";
    host.appendChild(canvas);
    cleanup.push(() => canvas.remove());
    const camera = makeCamera(host.clientWidth, host.clientHeight);
    const controls = new OrbitControls(camera, canvas);
    cleanup.push(() => controls.dispose());
    controls.target.set(0, 0.6, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    controls.minZoom = 0.85;
    controls.maxZoom = 2.5;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = 1.14;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.65;
    const raycaster = new THREE.Raycaster(),
      vector = new THREE.Vector3();
    let dirty = true,
      labelsDirty = true;
    let animated = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    let lastFrame = 0,
      elapsed = 0,
      previous = performance.now();
    let pointerDown = { x: 0, y: 0, id: -1 };

    function requestFrame() {
      if (!disposed && !document.hidden && !frame)
        frame = requestAnimationFrame(draw);
    }
    function changed() {
      dirty = true;
      labelsDirty = true;
      requestFrame();
    }
    controls.addEventListener("change", changed);
    cleanup.push(() => controls.removeEventListener("change", changed));
    function resize() {
      const width = Math.max(1, host.clientWidth),
        height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height);
      const aspect = width / height,
        viewHeight = Math.max(27, 43 / aspect);
      Object.assign(camera, {
        left: (-viewHeight * aspect) / 2,
        right: (viewHeight * aspect) / 2,
        top: viewHeight / 2,
        bottom: -viewHeight / 2,
      });
      camera.updateProjectionMatrix();
      changed();
    }
    const observer = new ResizeObserver(resize);
    cleanup.push(() => observer.disconnect());
    observer.observe(host);
    resize();
    const onDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const onUp = (event: PointerEvent) => {
      if (
        event.pointerId !== pointerDown.id ||
        Math.hypot(
          event.clientX - pointerDown.x,
          event.clientY - pointerDown.y,
        ) > 6
      )
        return;
      const bounds = canvas.getBoundingClientRect();
      camera.updateMatrixWorld();
      world.scene.updateMatrixWorld(true);
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
        ),
        camera,
      );
      const hits = raycaster.intersectObjects(
        world.services.filter((s) => s.group.visible).map((s) => s.hitbox),
        false,
      );
      if (hits[0]) options.onSelect(hits[0].object.userData.service as string);
    };
    canvas.addEventListener("pointerdown", onDown);
    cleanup.push(() => canvas.removeEventListener("pointerdown", onDown));
    canvas.addEventListener("pointerup", onUp);
    cleanup.push(() => canvas.removeEventListener("pointerup", onUp));
    function projectLabels() {
      camera.updateMatrixWorld();
      const labels: Record<string, ProjectedLabel> = {};
      for (const service of world.services) {
        vector.copy(service.anchor).project(camera);
        labels[service.id] = {
          x: ((vector.x + 1) / 2) * host.clientWidth,
          y: ((1 - vector.y) / 2) * host.clientHeight,
          visible:
            service.group.visible &&
            Math.abs(vector.x) < 0.95 &&
            Math.abs(vector.y) < 0.91 &&
            vector.z >= -1 &&
            vector.z <= 1,
        };
      }
      options.onLabels(labels);
      labelsDirty = false;
    }
    function draw(now: number) {
      frame = 0;
      if (disposed || document.hidden) return;
      if (now - lastFrame < 32) {
        requestFrame();
        return;
      }
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      lastFrame = now;
      const moved = controls.update();
      if (animated) {
        elapsed += delta;
        world.animate(elapsed);
      }
      if (dirty || animated || moved) {
        if (labelsDirty) projectLabels();
        renderer.render(world.scene, camera);
        dirty = false;
      }
      // No hay RAF permanente en reposo: la interacción o un estado nuevo lo despiertan.
      if (animated || moved) requestFrame();
    }
    function visibility() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        previous = performance.now();
        dirty = true;
        requestFrame();
      }
    }
    const lost = (event: Event) => {
      event.preventDefault();
      dispose();
      options.onFailure();
    };
    canvas.addEventListener("webglcontextlost", lost);
    cleanup.push(() => canvas.removeEventListener("webglcontextlost", lost));
    document.addEventListener("visibilitychange", visibility);
    cleanup.push(() =>
      document.removeEventListener("visibilitychange", visibility),
    );
    requestFrame();
    return {
      update(departments, narrative) {
        if (!disposed) {
          const servicesChanged = applyServiceStates(
            world.services,
            departments,
            narrative,
          );
          const effectsChanged = world.effects.update(departments, narrative);
          if (servicesChanged || effectsChanged) changed();
        }
      },
      select(id) {
        if (disposed) return;
        for (const service of world.services) {
          service.ring.scale.setScalar(service.id === id ? 1.13 : 1);
          service.signal.emissiveIntensity = service.id === id ? 0.6 : 0.18;
        }
        dirty = true;
        requestFrame();
      },
      zoom(direction) {
        if (disposed) return;
        camera.zoom = THREE.MathUtils.clamp(
          camera.zoom * (direction > 0 ? 1.18 : 1 / 1.18),
          controls.minZoom,
          controls.maxZoom,
        );
        camera.updateProjectionMatrix();
        controls.update();
        changed();
      },
      reset() {
        if (disposed) return;
        camera.position.set(30, 27, 33);
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0.6, 0);
        controls.update();
        changed();
      },
      setAnimated(value) {
        if (!disposed) {
          animated = value;
          previous = performance.now();
          dirty = true;
          requestFrame();
        }
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
