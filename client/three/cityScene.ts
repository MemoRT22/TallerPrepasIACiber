import * as THREE from "three";
import { ModelKit } from "./primitives";
import { buildServices, SERVICE_SITES, applyServiceStates } from "./services";
import { buildCityEffects, type CityTrafficController } from "./cityEffects";

function avenue(
  kit: ModelKit,
  group: THREE.Group,
  x: number,
  z: number,
  length: number,
  vertical = false,
) {
  const road = new THREE.Group();
  road.position.set(x, 0.04, z);
  if (vertical) road.rotation.y = Math.PI / 2;
  group.add(road);
  kit.box(road, length, 0.035, 1.1, 0, 0, 0, "#829294");
  for (const side of [-1, 1])
    kit.box(road, length, 0.06, 0.24, 0, 0.01, side * 0.67, "#e8e4d3");
  for (let i = -length / 2 + 0.5; i < length / 2; i += 1.25)
    kit.box(road, 0.55, 0.012, 0.04, i, 0.025, 0, "#f9eac1");
}

function house(
  kit: ModelKit,
  group: THREE.Group,
  x: number,
  z: number,
  index: number,
) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  group.add(g);
  const colors = ["#e9b6a1", "#b4cdda", "#e7d59f", "#c6bfdb", "#c2d4ae"];
  const h = 0.72 + (index % 3) * 0.23;
  kit.box(g, 1.6, 0.035, 1.65, 0, 0.025, 0, "#c4d3ab");
  kit.box(g, 1.2, h, 1.05, 0, h / 2, -0.18, colors[index % colors.length]);
  kit.roof(
    g,
    1.38,
    0.42,
    1.22,
    0,
    h + 0.23,
    -0.18,
    index % 2 ? "#c68677" : "#aa9b88",
  );
  kit.windows(g, 1.2, h, 1.05, "#a0c8d2", 1, 2);
  kit.box(g, 0.24, 0.43, 0.03, 0, 0.22, 0.37, "#87796d");
  kit.box(g, 0.25, 0.025, 0.5, 0, 0.05, 0.63, "#efe4cd");
  kit.tree(g, -0.8, 0.25, 0.5);
}

type MovingCarPart = { mesh: THREE.InstancedMesh; local: THREE.Matrix4 };

/**
 * Three public cars share the six pieces produced by ModelKit.car through
 * instancing. The two extra slots only appear for the public mobility jam.
 */
function createMovingCars(
  kit: ModelKit,
  parent: THREE.Object3D,
): CityTrafficController & { group: THREE.Group } {
  const prototypeParent = new THREE.Group();
  const prototype = kit.car(prototypeParent, 0, 0, "#efb691");
  prototypeParent.updateMatrixWorld(true);
  prototype.updateMatrixWorld(true);
  const parts = prototype.children.filter(
    (node): node is THREE.Mesh => node instanceof THREE.Mesh,
  );
  const group = new THREE.Group();
  group.name = "moving-cars";
  parent.add(group);
  const instancedParts: MovingCarPart[] = parts.map((part, index) => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, 5);
    mesh.name = `moving-car-part-${index}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, local: part.matrix.clone() };
  });
  prototypeParent.clear();

  const entries = [
    {
      axis: "x" as const,
      lane: -0.98,
      phase: 0,
      speed: 0.58,
      rotation: Math.PI / 2,
    },
    {
      axis: "x" as const,
      lane: -0.63,
      phase: 8,
      speed: 0.4,
      rotation: Math.PI / 2,
    },
    { axis: "z" as const, lane: -4.12, phase: 3, speed: 0.47, rotation: 0 },
  ];
  let mode: "normal" | "slow" | "jammed" = "normal";
  let speedScale = 1;
  let currentTime = 0;

  function positionFor(index: number, time: number) {
    if (mode === "jammed") {
      return new THREE.Vector3(-8.1 + index * 1.3, 0, -0.98);
    }
    const entry = entries[index];
    const t = time * entry.speed * speedScale + entry.phase;
    if (entry.axis === "x")
      return new THREE.Vector3(-14 + (t % 18), 0, entry.lane);
    return new THREE.Vector3(entry.lane, 0, 9.7 - (t % 19.4));
  }

  function updateInstances(time: number) {
    currentTime = Number.isFinite(time) ? time : currentTime;
    const visibleCars = mode === "jammed" ? 5 : 3;
    instancedParts.forEach(({ mesh, local }) => {
      mesh.count = visibleCars;
      for (let index = 0; index < visibleCars; index++) {
        const entry = entries[index % entries.length];
        const position = positionFor(index % entries.length, currentTime);
        const transform = new THREE.Matrix4().compose(
          position,
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            mode === "jammed" ? Math.PI / 2 : entry.rotation,
          ),
          new THREE.Vector3(1, 1, 1),
        );
        mesh.setMatrixAt(index, transform.multiply(local));
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
  updateInstances(0);

  return {
    group,
    setMode(status) {
      const next =
        status === "down"
          ? "jammed"
          : status === "warning" || status === "scarred"
            ? "slow"
            : "normal";
      const nextScale = status === "scarred" ? 0.8 : next === "slow" ? 0.32 : 1;
      const changed = next !== mode || nextScale !== speedScale;
      mode = next;
      speedScale = nextScale;
      updateInstances(currentTime);
      return changed;
    },
    animate(time) {
      updateInstances(time);
    },
    describe() {
      return {
        mode,
        speedScale,
        stopped: mode === "jammed",
        visibleCars: mode === "jammed" ? 5 : 3,
      };
    },
  };
}

export function buildCity() {
  const kit = new ModelKit();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d8eced");
  const landscape = new THREE.Group();
  landscape.name = "Cancún: maqueta costera";
  scene.add(landscape);
  // Base de maqueta y costa. La zona hotelera es una franja al este de la laguna.
  kit.box(landscape, 34, 0.65, 25, 0, -0.75, 0, "#6aabb9");
  kit.box(landscape, 33.8, 0.08, 24.8, 0, -0.37, 0, "#77c9d4");
  const coast: [number, number][] = [
    [-16, -11],
    [3, -11],
    [5, -8],
    [4, -5],
    [5, -1],
    [3.5, 3],
    [4, 8],
    [1, 11],
    [-16, 11],
  ];
  kit.polygon(landscape, coast, "#d9d4a5", -0.1, 0.5);
  kit.polygon(
    landscape,
    coast.map(
      ([x, z]) =>
        [x === -16 ? x + 0.15 : x - 0.2, z * 0.98] as [number, number],
    ),
    "#a5cb91",
    0.02,
    0.07,
  );
  const hotelCoast: [number, number][] = [
    [7, -10],
    [12, -10],
    [13, -7],
    [12.4, -4],
    [12.9, 0],
    [12.5, 5],
    [11, 10],
    [8.5, 10],
    [9.1, 5],
    [9, 0],
    [9.3, -5],
    [7, -7],
  ];
  kit.polygon(landscape, hotelCoast, "#f4e4ba", -0.06, 0.36);
  kit.polygon(
    landscape,
    [
      [8.8, -8.5],
      [11.3, -8.5],
      [11.4, -3],
      [11.2, 3],
      [10.6, 8.5],
      [9.7, 8.5],
      [9.8, 3],
      [9.7, -3],
    ],
    "#b0ce95",
    0.015,
    0.055,
  );
  const lagoon = kit.cylinder(
    landscape,
    1,
    1,
    0.035,
    6.2,
    -0.27,
    1,
    "#78b9b0",
    40,
  );
  lagoon.scale.set(1.45, 1, 7.7);
  for (const [x, z] of [
    [6.4, 4.7],
    [6.6, -0.6],
    [5.8, 7.8],
  ]) {
    const isle = kit.cylinder(
      landscape,
      0.42,
      0.58,
      0.18,
      x,
      -0.13,
      z,
      "#8eb88d",
      8,
    );
    isle.scale.z = 1.5;
    kit.palm(landscape, x, z, 0.7);
  }
  avenue(kit, landscape, -5.7, -0.8, 19.4);
  avenue(kit, landscape, -4.3, 0, 20.8, true);
  avenue(kit, landscape, -6, -8, 19.5);
  avenue(kit, landscape, -6, 7.5, 18.8);
  avenue(kit, landscape, -12, 0, 20, true);
  // Puente hacia la zona hotelera: pilares y barandillas.
  avenue(kit, landscape, 6.2, -8, 8);
  for (const x of [4.3, 6, 7.7])
    for (const z of [-8.55, -7.45])
      kit.box(landscape, 0.14, 0.8, 0.14, x, -0.4, z, "#d5d7cc");
  for (const z of [-8.55, -7.45])
    kit.box(landscape, 8, 0.08, 0.07, 6.2, 0.3, z, "#e6e8da");
  avenue(kit, landscape, 10.45, -0.5, 15.6, true);
  let index = 0;
  for (const x of [-13.7, -10, -6.7, -0.7, 2.3])
    for (const z of [-9.8, -4.1, 1.6, 6.6, 9.3]) {
      if (
        SERVICE_SITES.some(
          (s) => Math.abs(x - s.x) < 3 && Math.abs(z - s.z) < 3,
        )
      )
        continue;
      house(kit, landscape, x, z, index++);
    }
  // Pequeños edificios urbanos y villas costeras fuera de los seis servicios.
  for (const [x, z] of [
    [-14, -6],
    [-14, 3],
    [-0.8, -9.5],
    [2.2, 9.5],
  ])
    house(kit, landscape, x, z, index++);
  for (const z of [-5.3, -1.7, 7.8]) house(kit, landscape, 11.5, z, index++);
  for (const [x, z] of [
    [-14, 8],
    [-10.8, -1.8],
    [-5, 9],
    [1.6, 6.9],
    [2.9, 1.2],
    [-9.4, 7],
    [-13.6, -8.2],
    [-1.4, -2],
    [-7, -9.5],
  ])
    kit.tree(landscape, x, z, 0.85);
  for (const [x, z] of [
    [12.3, -6.5],
    [12.7, -2.5],
    [12.6, 1],
    [11.9, 6.4],
    [10.6, 9.5],
    [7.8, -9.4],
    [3.2, 2],
    [-13.5, 5.7],
    [-8.7, 1],
    [-2.8, 6.9],
  ])
    kit.palm(landscape, x, z, 0.9);
  // Cruces peatonales, farolas y bancos.
  for (const z of [-1.1, -0.8, -0.5])
    for (let i = 0; i < 5; i++)
      kit.box(
        landscape,
        0.08,
        0.017,
        0.19,
        -4.65 + i * 0.17,
        0.09,
        z,
        "#f7f1d9",
      );
  for (const x of [-11, -8, -1, 2]) {
    kit.cylinder(landscape, 0.025, 0.045, 1.15, x, 0.575, -1.52, "#718d83", 5);
    kit.box(landscape, 0.17, 0.1, 0.24, x, 1.17, -1.45, "#f7ebba");
  }
  kit.merge(landscape);
  const services = buildServices(kit);
  services.forEach((s) => scene.add(s.group));
  const moving = new THREE.Group();
  moving.name = "city-moving-elements";
  scene.add(moving);
  const cars = createMovingCars(kit, moving);
  const boat = new THREE.Group();
  boat.position.set(14.6, -0.14, 2);
  moving.add(boat);
  kit.box(boat, 0.5, 0.12, 1.3, 0, 0.1, 0, "#f3f0db");
  kit.box(boat, 0.32, 0.25, 0.55, 0, 0.26, -0.12, "#c5e8e7");
  kit.box(boat, 0.36, 0.05, 0.6, 0, 0.41, -0.12, "#e9ce95");
  const hemi = new THREE.HemisphereLight("#f5ffff", "#b9c29b", 2.3);
  hemi.name = "city-hemisphere-light";
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff2d5", 3.1);
  sun.name = "city-sun-light";
  sun.position.set(-12, 25, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -23,
    right: 23,
    top: 23,
    bottom: -23,
    near: 0.5,
    far: 65,
  });
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const ambient = new THREE.AmbientLight("#d9e6f5", 0.25);
  ambient.name = "city-ambient-light";
  scene.add(ambient);
  const effects = buildCityEffects({
    scene,
    lights: { hemisphere: hemi, sun, ambient },
    cars,
  });
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  let disposed = false;
  const updatePublic = (
    departments: Parameters<typeof applyServiceStates>[1],
    narrative?: Parameters<typeof applyServiceStates>[2],
  ) => {
    const servicesChanged = applyServiceStates(
      services,
      departments,
      narrative,
    );
    const effectsChanged = effects.update(departments, narrative);
    return servicesChanged || effectsChanged;
  };
  return {
    scene,
    services,
    kit,
    cars,
    lights: { hemisphere: hemi, sun, ambient },
    effects,
    updatePublic,
    animate(time: number) {
      boat.position.z = 2 + Math.sin(time * 0.13) * 3.5;
      boat.rotation.y = Math.sin(time * 0.13) * 0.06;
      effects.animate(time);
      services.forEach((s) => {
        s.diamond.rotation.y = time * 0.4;
        s.diamond.position.y =
          SERVICE_SITES.find((site) => site.id === s.id)!.height +
          Math.sin(time * 1.7) * 0.065;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      effects.dispose();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          geometries.add(node.geometry);
          (Array.isArray(node.material)
            ? node.material
            : [node.material]
          ).forEach((m) => materials.add(m));
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      sun.shadow.dispose();
      kit.dispose();
    },
  };
}
