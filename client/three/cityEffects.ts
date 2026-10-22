import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { DepartmentState } from "../../shared/types";

export type CityEffectStatus = DepartmentState["status"] | "absent";
export type CityTrafficStatus = "operational" | "warning" | "down" | "absent";

export interface CityLightSet {
  hemisphere: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
}

/** The moving road vehicles are owned by the scene, while effects only select a public mode. */
export interface CityTrafficController {
  setMode(status: CityTrafficStatus): boolean;
  animate(time: number): void;
  describe(): {
    mode: "normal" | "slow" | "jammed";
    speedScale: number;
    stopped: boolean;
    visibleCars: number;
  };
}

export interface CityIncidentState {
  status: CityEffectStatus;
  visible: boolean;
  count: number;
  kind:
    | "water-queue"
    | "municipal-queue"
    | "communications-phones"
    | "tourism-luggage";
}

export interface CityEffectsState {
  anonymous: true;
  normalCrowd: {
    visible: true;
    count: number;
  };
  energy: {
    status: CityEffectStatus;
    mode: "normal" | "dim" | "blackout";
    night: boolean;
    intensityScale: number;
  };
  mobility: {
    status: CityEffectStatus;
    mode: "normal" | "slow" | "jammed";
    speedScale: number;
    carsStopped: boolean;
    visibleQueue: number;
  };
  incidents: Record<string, CityIncidentState>;
}

export interface CityEffects {
  readonly state: CityEffectsState;
  readonly group: THREE.Group;
  readonly lights: CityLightSet;
  /** Apply only public id/status/existence. No private or player payload is retained. */
  updatePublic(
    departments: readonly Pick<DepartmentState, "id" | "status">[],
  ): boolean;
  /** Alias used by the viewport's public-state update path. */
  update(
    departments: readonly Pick<DepartmentState, "id" | "status">[],
  ): boolean;
  /** Advance local motion; the viewport calls this only while animation is enabled. */
  animate(time: number): void;
  describe(): CityEffectsState;
  snapshot(): CityEffectsState;
  dispose(): void;
}

type PersonSpec = {
  x: number;
  z: number;
  phase: number;
  driftX: number;
  driftZ: number;
  heading: number;
};

type PersonBatch = {
  id: string;
  group: THREE.Group;
  specs: PersonSpec[];
  meshes: THREE.InstancedMesh[];
  accessory?: THREE.InstancedMesh;
  status: CityEffectStatus;
  count: number;
  kind: CityIncidentState["kind"];
};

const IMPACT_IDS = ["agua", "municipal", "comunicaciones", "turismo"] as const;
const NORMAL_PERSONS: PersonSpec[] = [
  { x: -13.2, z: -1.35, phase: 0.2, driftX: 0.22, driftZ: 0.08, heading: 0.2 },
  { x: -10.4, z: 1.25, phase: 1.6, driftX: 0.12, driftZ: 0.18, heading: 1.2 },
  { x: -7.0, z: -2.1, phase: 2.9, driftX: 0.18, driftZ: 0.1, heading: -0.4 },
  { x: -3.2, z: 2.55, phase: 4.1, driftX: 0.1, driftZ: 0.2, heading: 2.4 },
  { x: 0.5, z: -1.9, phase: 5.3, driftX: 0.2, driftZ: 0.1, heading: 0.8 },
  { x: 2.8, z: 5.2, phase: 0.9, driftX: 0.16, driftZ: 0.12, heading: -1.1 },
  { x: 8.0, z: -6.2, phase: 2.1, driftX: 0.12, driftZ: 0.2, heading: 1.8 },
  { x: 10.5, z: 6.6, phase: 3.5, driftX: 0.2, driftZ: 0.1, heading: -2.3 },
];

const INCIDENT_PERSONS: Record<(typeof IMPACT_IDS)[number], PersonSpec[]> = {
  agua: [
    {
      x: -11.7,
      z: -5.65,
      phase: 0.1,
      driftX: 0.02,
      driftZ: 0.03,
      heading: 0.3,
    },
    {
      x: -10.8,
      z: -5.65,
      phase: 1.2,
      driftX: 0.02,
      driftZ: 0.03,
      heading: 0.3,
    },
    { x: -9.9, z: -5.65, phase: 2.4, driftX: 0.02, driftZ: 0.03, heading: 0.3 },
    { x: -9.0, z: -5.65, phase: 3.6, driftX: 0.02, driftZ: 0.03, heading: 0.3 },
    { x: -8.1, z: -5.65, phase: 4.8, driftX: 0.02, driftZ: 0.03, heading: 0.3 },
  ],
  municipal: [
    { x: -2.3, z: 5.2, phase: 0.3, driftX: 0.03, driftZ: 0.02, heading: -0.2 },
    { x: -1.35, z: 5.2, phase: 1.5, driftX: 0.03, driftZ: 0.02, heading: -0.2 },
    { x: -0.4, z: 5.2, phase: 2.7, driftX: 0.03, driftZ: 0.02, heading: -0.2 },
    { x: 0.55, z: 5.2, phase: 3.9, driftX: 0.03, driftZ: 0.02, heading: -0.2 },
    { x: 1.5, z: 5.2, phase: 5.1, driftX: 0.03, driftZ: 0.02, heading: -0.2 },
  ],
  comunicaciones: [
    { x: 0.1, z: -4.75, phase: 0.4, driftX: 0.04, driftZ: 0.03, heading: 1.4 },
    { x: 1.0, z: -4.75, phase: 1.6, driftX: 0.04, driftZ: 0.03, heading: 1.4 },
    { x: 1.9, z: -4.75, phase: 2.8, driftX: 0.04, driftZ: 0.03, heading: 1.4 },
    { x: 2.8, z: -4.75, phase: 4.0, driftX: 0.04, driftZ: 0.03, heading: 1.4 },
    { x: 3.7, z: -4.75, phase: 5.2, driftX: 0.04, driftZ: 0.03, heading: 1.4 },
  ],
  turismo: [
    {
      x: 7.8,
      z: 4.65,
      phase: 0.7,
      driftX: 0.025,
      driftZ: 0.025,
      heading: -1.3,
    },
    {
      x: 8.7,
      z: 4.65,
      phase: 1.9,
      driftX: 0.025,
      driftZ: 0.025,
      heading: -1.3,
    },
    {
      x: 9.6,
      z: 4.65,
      phase: 3.1,
      driftX: 0.025,
      driftZ: 0.025,
      heading: -1.3,
    },
    {
      x: 10.5,
      z: 4.65,
      phase: 4.3,
      driftX: 0.025,
      driftZ: 0.025,
      heading: -1.3,
    },
    {
      x: 11.4,
      z: 4.65,
      phase: 5.5,
      driftX: 0.025,
      driftZ: 0.025,
      heading: -1.3,
    },
  ],
};

const INCIDENT_KIND: Record<
  (typeof IMPACT_IDS)[number],
  CityIncidentState["kind"]
> = {
  agua: "water-queue",
  municipal: "municipal-queue",
  comunicaciones: "communications-phones",
  turismo: "tourism-luggage",
};

function mergeBoxes(parts: THREE.BoxGeometry[]) {
  const geometries = parts.map((part) => {
    const geometry = part.toNonIndexed();
    part.dispose();
    return geometry;
  });
  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  if (!merged)
    throw new Error("No se pudo construir la geometría de población");
  return merged;
}

function personGeometrySet() {
  const head = new THREE.IcosahedronGeometry(0.115, 0);
  const torso = new THREE.BoxGeometry(0.24, 0.34, 0.17);
  const arms = [
    new THREE.BoxGeometry(0.065, 0.3, 0.07),
    new THREE.BoxGeometry(0.065, 0.3, 0.07),
  ];
  arms[0].translate(-0.17, -0.01, 0);
  arms[1].translate(0.17, -0.01, 0);
  const legs = [
    new THREE.BoxGeometry(0.075, 0.29, 0.08),
    new THREE.BoxGeometry(0.075, 0.29, 0.08),
  ];
  legs[0].translate(-0.075, -0.31, 0);
  legs[1].translate(0.075, -0.31, 0);
  const armGeometry = mergeBoxes(arms);
  const legGeometry = mergeBoxes(legs);
  return { head, torso, armGeometry, legGeometry };
}

function createInstanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  name: string,
) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function compose(position: THREE.Vector3, rotation: number, scale = 1) {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    position,
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotation,
    ),
    new THREE.Vector3(scale, scale, scale),
  );
  return matrix;
}

function withOffset(base: THREE.Matrix4, x: number, y: number, z: number) {
  return base.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));
}

export function buildCityEffects(options: {
  scene: THREE.Scene;
  lights: CityLightSet;
  cars: CityTrafficController;
}): CityEffects {
  const { scene, lights, cars } = options;
  const group = new THREE.Group();
  group.name = "city-effects";
  scene.add(group);

  const geometries = personGeometrySet();
  const materials = [
    new THREE.MeshStandardMaterial({ color: "#6c82a1", roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: "#f0bd79", roughness: 0.86 }),
    new THREE.MeshStandardMaterial({ color: "#719b82", roughness: 0.9 }),
  ];
  const accessoryMaterials = [
    new THREE.MeshStandardMaterial({ color: "#4fabc0", roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ color: "#334f78", roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: "#d48755", roughness: 0.88 }),
  ];
  const accessoryGeometries = {
    bucket: new THREE.CylinderGeometry(0.095, 0.12, 0.18, 8),
    phone: new THREE.BoxGeometry(0.045, 0.12, 0.025),
    luggage: new THREE.BoxGeometry(0.2, 0.2, 0.13),
  };
  const allMeshes: THREE.InstancedMesh[] = [];
  const allBatches: PersonBatch[] = [];

  function makeBatch(
    id: string,
    specs: PersonSpec[],
    kind: PersonBatch["kind"],
    parent: THREE.Object3D,
    accessory?: {
      geometry: THREE.BufferGeometry;
      material: THREE.Material;
      name: string;
    },
  ) {
    const batchGroup = new THREE.Group();
    batchGroup.name = `anonymous-${id}`;
    batchGroup.visible = false;
    parent.add(batchGroup);
    const meshes = [
      createInstanced(
        geometries.head,
        materials[1],
        specs.length,
        `${id}-heads`,
      ),
      createInstanced(
        geometries.torso,
        materials[0],
        specs.length,
        `${id}-torsos`,
      ),
      createInstanced(
        geometries.armGeometry,
        materials[2],
        specs.length,
        `${id}-arms`,
      ),
      createInstanced(
        geometries.legGeometry,
        materials[0],
        specs.length,
        `${id}-legs`,
      ),
    ];
    meshes.forEach((mesh) => {
      batchGroup.add(mesh);
      mesh.count = 0;
      allMeshes.push(mesh);
    });
    let accessoryMesh: THREE.InstancedMesh | undefined;
    if (accessory) {
      accessoryMesh = createInstanced(
        accessory.geometry,
        accessory.material,
        specs.length,
        accessory.name,
      );
      accessoryMesh.count = 0;
      batchGroup.add(accessoryMesh);
      allMeshes.push(accessoryMesh);
    }
    const batch: PersonBatch = {
      id,
      group: batchGroup,
      specs,
      meshes,
      accessory: accessoryMesh,
      status: "absent",
      count: 0,
      kind,
    };
    allBatches.push(batch);
    return batch;
  }

  const normalGroup = new THREE.Group();
  normalGroup.name = "anonymous-normal-crowd";
  normalGroup.visible = true;
  group.add(normalGroup);
  const normal = makeBatch(
    "normal-crowd",
    NORMAL_PERSONS,
    "municipal-queue",
    normalGroup,
  );
  normal.status = "operational";
  normal.count = NORMAL_PERSONS.length;
  normal.group.visible = true;
  normal.meshes.forEach((mesh) => (mesh.count = normal.count));

  const incidentRoot = new THREE.Group();
  incidentRoot.name = "anonymous-city-impacts";
  group.add(incidentRoot);
  const batches: Record<(typeof IMPACT_IDS)[number], PersonBatch> = {
    agua: makeBatch(
      "agua-queue",
      INCIDENT_PERSONS.agua,
      "water-queue",
      incidentRoot,
      {
        geometry: accessoryGeometries.bucket,
        material: accessoryMaterials[0],
        name: "agua-buckets",
      },
    ),
    municipal: makeBatch(
      "municipal-queue",
      INCIDENT_PERSONS.municipal,
      "municipal-queue",
      incidentRoot,
    ),
    comunicaciones: makeBatch(
      "communications-phones",
      INCIDENT_PERSONS.comunicaciones,
      "communications-phones",
      incidentRoot,
      {
        geometry: accessoryGeometries.phone,
        material: accessoryMaterials[1],
        name: "communications-phones",
      },
    ),
    turismo: makeBatch(
      "tourism-luggage",
      INCIDENT_PERSONS.turismo,
      "tourism-luggage",
      incidentRoot,
      {
        geometry: accessoryGeometries.luggage,
        material: accessoryMaterials[2],
        name: "tourism-luggage",
      },
    ),
  };
  const mobilityGroup = new THREE.Group();
  mobilityGroup.name = "anonymous-mobility-impact";
  mobilityGroup.visible = false;
  group.add(mobilityGroup);

  const baselineBackground =
    scene.background instanceof THREE.Color
      ? scene.background.clone()
      : new THREE.Color("#d8eced");
  const background =
    scene.background instanceof THREE.Color
      ? scene.background
      : baselineBackground.clone();
  if (!(scene.background instanceof THREE.Color)) scene.background = background;
  const baseline = {
    hemisphere: {
      color: lights.hemisphere.color.clone(),
      groundColor: lights.hemisphere.groundColor.clone(),
      intensity: lights.hemisphere.intensity,
    },
    sun: { color: lights.sun.color.clone(), intensity: lights.sun.intensity },
    ambient: {
      color: lights.ambient.color.clone(),
      intensity: lights.ambient.intensity,
    },
    background: baselineBackground,
  };

  const state: CityEffectsState = {
    anonymous: true,
    normalCrowd: { visible: true, count: normal.count },
    energy: {
      status: "absent",
      mode: "normal",
      night: false,
      intensityScale: 1,
    },
    mobility: {
      status: "absent",
      mode: "normal",
      speedScale: 1,
      carsStopped: false,
      visibleQueue: 0,
    },
    incidents: {
      agua: { status: "absent", visible: false, count: 0, kind: "water-queue" },
      municipal: {
        status: "absent",
        visible: false,
        count: 0,
        kind: "municipal-queue",
      },
      comunicaciones: {
        status: "absent",
        visible: false,
        count: 0,
        kind: "communications-phones",
      },
      turismo: {
        status: "absent",
        visible: false,
        count: 0,
        kind: "tourism-luggage",
      },
    },
  };
  let currentTime = 0;
  let disposed = false;

  function updateBatchTransforms(batch: PersonBatch, time: number) {
    batch.specs.forEach((spec, index) => {
      const walking = batch === normal || batch.status === "warning";
      const x =
        spec.x +
        (walking ? Math.sin(time * 0.35 + spec.phase) * spec.driftX : 0);
      const z =
        spec.z +
        (walking ? Math.cos(time * 0.31 + spec.phase) * spec.driftZ : 0);
      const base = compose(new THREE.Vector3(x, 0.46, z), spec.heading);
      const head = withOffset(base, 0, 0.43, 0);
      const torso = withOffset(base, 0, 0.15, 0);
      const arms = withOffset(base, 0, 0.15, 0);
      const legs = withOffset(base, 0, 0.0, 0);
      batch.meshes[0].setMatrixAt(index, head);
      batch.meshes[1].setMatrixAt(index, torso);
      batch.meshes[2].setMatrixAt(index, arms);
      batch.meshes[3].setMatrixAt(index, legs);
      if (batch.accessory) {
        const accessoryOffset =
          batch.kind === "water-queue"
            ? [-0.2, -0.1, 0.14]
            : batch.kind === "communications-phones"
              ? [0.15, 0.2, 0.12]
              : [0.28, -0.1, 0.08];
        batch.accessory.setMatrixAt(
          index,
          withOffset(
            base,
            accessoryOffset[0],
            accessoryOffset[1],
            accessoryOffset[2],
          ),
        );
      }
    });
    batch.meshes.forEach((mesh) => (mesh.instanceMatrix.needsUpdate = true));
    if (batch.accessory) batch.accessory.instanceMatrix.needsUpdate = true;
  }

  updateBatchTransforms(normal, 0);
  allBatches
    .filter((batch) => batch !== normal)
    .forEach((batch) => updateBatchTransforms(batch, 0));

  function applyEnergy(status: CityEffectStatus) {
    const scale = status === "down" ? 0.06 : status === "warning" ? 0.58 : 1;
    const night = status === "down";
    lights.hemisphere.color
      .copy(baseline.hemisphere.color)
      .lerp(
        new THREE.Color("#263a58"),
        status === "down" ? 0.9 : status === "warning" ? 0.35 : 0,
      );
    lights.hemisphere.groundColor
      .copy(baseline.hemisphere.groundColor)
      .lerp(
        new THREE.Color("#111827"),
        status === "down" ? 0.86 : status === "warning" ? 0.28 : 0,
      );
    lights.hemisphere.intensity = baseline.hemisphere.intensity * scale;
    lights.sun.color
      .copy(baseline.sun.color)
      .lerp(
        new THREE.Color("#22304d"),
        status === "down" ? 0.92 : status === "warning" ? 0.3 : 0,
      );
    lights.sun.intensity =
      baseline.sun.intensity *
      (status === "down" ? 0.035 : status === "warning" ? 0.62 : 1);
    lights.ambient.color
      .copy(baseline.ambient.color)
      .lerp(
        new THREE.Color("#16243e"),
        status === "down" ? 0.9 : status === "warning" ? 0.32 : 0,
      );
    lights.ambient.intensity =
      baseline.ambient.intensity *
      (status === "down" ? 0.08 : status === "warning" ? 0.62 : 1);
    background
      .copy(baseline.background)
      .lerp(
        new THREE.Color("#061326"),
        status === "down" ? 0.93 : status === "warning" ? 0.35 : 0,
      );
    state.energy = {
      status,
      mode:
        status === "down"
          ? "blackout"
          : status === "warning"
            ? "dim"
            : "normal",
      night,
      intensityScale: scale,
    };
  }

  function setBatchStatus(
    id: (typeof IMPACT_IDS)[number],
    status: CityEffectStatus,
  ) {
    const batch = batches[id];
    const visible = status === "warning" || status === "down";
    const count = visible ? (status === "down" ? 5 : 3) : 0;
    batch.status = status;
    batch.count = count;
    batch.group.visible = visible;
    batch.meshes.forEach((mesh) => {
      mesh.count = count;
      mesh.visible = visible;
    });
    if (batch.accessory) {
      batch.accessory.count = count;
      batch.accessory.visible = visible;
    }
    state.incidents[id] = {
      status,
      visible,
      count,
      kind: batch.kind,
    };
    updateBatchTransforms(batch, currentTime);
  }

  const effects: CityEffects = {
    state,
    group,
    lights,
    updatePublic(departments) {
      if (disposed) return false;
      const publicStatus = new Map<string, DepartmentState["status"]>();
      departments.forEach((department) => {
        // Deliberately read only the public service identifier and coarse status.
        publicStatus.set(department.id, department.status);
      });
      const energyStatus: CityEffectStatus =
        publicStatus.get("energia") ?? "absent";
      const mobilityStatus: CityEffectStatus =
        publicStatus.get("movilidad") ?? "absent";
      let changed =
        state.energy.status !== energyStatus ||
        state.mobility.status !== mobilityStatus;
      applyEnergy(energyStatus);
      const trafficChanged = cars.setMode(mobilityStatus);
      const traffic = cars.describe();
      state.mobility = {
        status: mobilityStatus,
        mode: traffic.mode,
        speedScale: traffic.speedScale,
        carsStopped: traffic.stopped,
        visibleQueue: traffic.visibleCars,
      };
      mobilityGroup.visible =
        mobilityStatus === "warning" || mobilityStatus === "down";
      changed = changed || trafficChanged;
      IMPACT_IDS.forEach((id) => {
        const status: CityEffectStatus = publicStatus.get(id) ?? "absent";
        const previous = state.incidents[id].status;
        if (previous !== status) changed = true;
        setBatchStatus(id, status);
      });
      return changed;
    },
    update(departments) {
      return effects.updatePublic(departments);
    },
    animate(time) {
      if (disposed) return;
      currentTime = Number.isFinite(time) ? time : currentTime;
      updateBatchTransforms(normal, currentTime);
      allBatches
        .filter((batch) => batch !== normal && batch.group.visible)
        .forEach((batch) => updateBatchTransforms(batch, currentTime));
      cars.animate(currentTime);
      const traffic = cars.describe();
      state.mobility.mode = traffic.mode;
      state.mobility.speedScale = traffic.speedScale;
      state.mobility.carsStopped = traffic.stopped;
      state.mobility.visibleQueue = traffic.visibleCars;
    },
    describe() {
      return JSON.parse(JSON.stringify(state)) as CityEffectsState;
    },
    snapshot() {
      return JSON.parse(JSON.stringify(state)) as CityEffectsState;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      const disposedGeometries = new Set<THREE.BufferGeometry>();
      allMeshes.forEach((mesh) => {
        if (!disposedGeometries.has(mesh.geometry)) {
          mesh.geometry.dispose();
          disposedGeometries.add(mesh.geometry);
        }
      });
      Object.values(accessoryGeometries).forEach((geometry) => {
        if (!disposedGeometries.has(geometry)) geometry.dispose();
      });
      Object.values(geometries).forEach((geometry) => {
        if (!disposedGeometries.has(geometry)) geometry.dispose();
      });
      [...materials, ...accessoryMaterials].forEach((material) =>
        material.dispose(),
      );
    },
  };

  return effects;
}

export const createCityEffects = buildCityEffects;
