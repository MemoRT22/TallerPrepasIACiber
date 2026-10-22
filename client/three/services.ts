import * as THREE from "three";
import type { DepartmentState } from "../../shared/types";
import { ModelKit } from "./primitives";
import { SERVICE_SITES, STATUS_COLORS } from "./sites";
export { SERVICE_SITES, STATUS_COLORS } from "./sites";
export interface ServiceModel {
  id: string;
  group: THREE.Group;
  anchor: THREE.Vector3;
  hitbox: THREE.Mesh;
  signal: THREE.MeshStandardMaterial;
  diamond: THREE.Mesh;
  ring: THREE.Mesh;
  buildingMaterials: {
    material: THREE.MeshStandardMaterial;
    color: THREE.Color;
  }[];
  status: DepartmentState["status"];
}

function facility(
  kit: ModelKit,
  g: THREE.Group,
  color: string,
  w = 2.8,
  h = 1.4,
  d = 1.7,
) {
  kit.box(g, w, h, d, 0, h / 2, 0, "#f4eddf");
  kit.box(g, w + 0.15, 0.16, d + 0.15, 0, h + 0.1, 0, color);
  kit.box(g, 0.45, 0.75, 0.04, 0, 0.38, d / 2 + 0.03, "#476e79");
  kit.windows(g, w, h, d, "#8ec9d6", h > 2 ? 4 : 1, 4);
}

function water(kit: ModelKit, g: THREE.Group) {
  const plant = new THREE.Group();
  plant.position.set(0.7, 0, 0.8);
  g.add(plant);
  facility(kit, plant, "#5eaed2", 2.4, 1.15, 1.5);
  // Depósitos de tratamiento abiertos, con agua visible.
  for (const x of [-1.15, 0.05]) {
    kit.cylinder(g, 0.52, 0.56, 0.65, x, 0.33, -1.2, "#d7e4df", 14);
    kit.cylinder(g, 0.46, 0.46, 0.06, x, 0.67, -1.2, "#5bc6d1", 14);
    kit.box(g, 0.8, 0.055, 0.12, x, 0.74, -1.2, "#96a7a1");
  }
  const tower = new THREE.Group();
  tower.position.set(-1.15, 0, 0.8);
  g.add(tower);
  for (const x of [-0.44, 0.44])
    for (const z of [-0.44, 0.44])
      kit.cylinder(tower, 0.065, 0.09, 2.5, x, 1.25, z, "#edf1e1", 7);
  kit.beam(
    tower,
    new THREE.Vector3(-0.44, 0.2, 0.44),
    new THREE.Vector3(0.44, 2.4, 0.44),
    0.04,
    "#b1c9bd",
  );
  kit.beam(
    tower,
    new THREE.Vector3(0.44, 0.2, 0.44),
    new THREE.Vector3(-0.44, 2.4, 0.44),
    0.04,
    "#b1c9bd",
  );
  kit.cylinder(tower, 0.76, 0.76, 0.86, 0, 2.7, 0, "#7ebed4", 14);
  kit.cylinder(tower, 0, 0.81, 0.35, 0, 3.32, 0, "#edf4e8", 14);
  kit.box(g, 0.14, 0.14, 3.8, 1.65, 0.17, -0.35, "#649cac");
  kit.tree(g, 1.65, 1.5, 0.65);
}

function pylon(kit: ModelKit, g: THREE.Group, x: number, z: number) {
  const height = 3.3;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      kit.beam(
        g,
        new THREE.Vector3(x + sx * 0.46, 0.12, z + sz * 0.36),
        new THREE.Vector3(x + sx * 0.13, height, z + sz * 0.12),
        0.048,
        "#a1aeb5",
      );
    }
  for (let level = 0; level < 3; level++) {
    const low = 0.2 + level * 0.9,
      high = low + 0.85,
      width = 0.42 - level * 0.1;
    for (const sz of [-1, 1]) {
      kit.beam(
        g,
        new THREE.Vector3(x - width, low, z + sz * 0.28),
        new THREE.Vector3(x + width - 0.09, high, z + sz * 0.18),
        0.035,
        "#8b9ba6",
      );
      kit.beam(
        g,
        new THREE.Vector3(x + width, low, z + sz * 0.28),
        new THREE.Vector3(x - width + 0.09, high, z + sz * 0.18),
        0.035,
        "#8b9ba6",
      );
    }
  }
  for (const y of [2.5, 3.1]) {
    kit.box(g, 1.5, 0.1, 0.16, x, y, z, "#929eab");
    for (const sx of [-1, 1]) {
      kit.cylinder(
        g,
        0.09,
        0.09,
        0.24,
        x + sx * 0.65,
        y - 0.14,
        z,
        "#526e8f",
        6,
      );
      for (let i = 0; i < 3; i++)
        kit.cylinder(
          g,
          0.115,
          0.115,
          0.035,
          x + sx * 0.65,
          y - 0.03 - i * 0.07,
          z,
          "#8da7bb",
          6,
        );
    }
  }
}

function energy(kit: ModelKit, g: THREE.Group) {
  // Tres torres pequeñas de celosía y cuatro conductores con catenaria.
  const positions = [-1.6, 0, 1.6];
  positions.forEach((x) => pylon(kit, g, x, -0.8));
  for (let i = 0; i < positions.length - 1; i++)
    for (const y of [2.5, 3.1])
      for (const sx of [-1, 1]) {
        kit.cable(
          g,
          new THREE.Vector3(positions[i] + sx * 0.65, y - 0.24, -0.8),
          new THREE.Vector3(positions[i + 1] + sx * 0.65, y - 0.24, -0.8),
          0.19,
        );
      }
  for (const x of [-1.1, 0, 1.1]) {
    kit.box(g, 0.62, 0.66, 0.62, x, 0.38, 0.6, "#aebdcc");
    for (const dx of [-0.18, 0.18])
      kit.cylinder(g, 0.06, 0.06, 0.27, x + dx, 0.85, 0.6, "#496678", 5);
    for (let i = 0; i < 4; i++)
      kit.box(g, 0.035, 0.5, 0.68, x - 0.24 + i * 0.16, 0.37, 0.6, "#7d929f");
  }
  for (const x of [-1.3, -0.3, 0.7]) {
    const panel = kit.box(g, 0.8, 0.07, 0.75, x, 0.37, 1.5, "#547ca0");
    panel.rotation.x = -0.25;
    for (const dx of [-0.2, 0.2])
      kit.box(g, 0.025, 0.02, 0.72, x + dx, 0.44, 1.5, "#a3c6d7");
    kit.box(g, 0.045, 0.3, 0.5, x, 0.15, 1.5, "#a2b1bc");
  }
}

function mobility(kit: ModelKit, g: THREE.Group) {
  const building = new THREE.Group();
  building.position.set(0, 0, -1);
  g.add(building);
  facility(kit, building, "#e9ba68", 3.6, 1.1, 1.3);
  kit.box(g, 3.9, 0.12, 1.1, 0, 1.28, 0.55, "#f1ce80");
  for (const x of [-1.7, 1.7])
    kit.box(g, 0.08, 1.23, 0.08, x, 0.62, 0.85, "#e8e4cf");
  for (const x of [-1.1, 0, 1.1]) {
    kit.box(g, 0.045, 0.025, 2, x, 0.05, 0.8, "#f6e9c9");
  }
  kit.car(g, -1.15, 0.65, "#dc9c64", true);
  kit.car(g, 0, 0.65, "#76b7a2", true);
  kit.box(g, 0.08, 1, 0.08, 1.65, 0.5, 1.5, "#708b91");
  kit.box(g, 0.4, 0.45, 0.08, 1.65, 1.05, 1.5, "#608dab");
}

function communication(kit: ModelKit, g: THREE.Group) {
  const building = new THREE.Group();
  building.position.set(-0.4, 0, 0.5);
  g.add(building);
  facility(kit, building, "#aca2d8", 2.8, 1.45, 1.9);
  kit.box(g, 0.4, 0.9, 0.65, 1.3, 0.45, 0.65, "#71869e");
  for (let i = 0; i < 4; i++)
    kit.box(g, 0.025, 0.04, 0.48, 1.515, 0.25 + i * 0.14, 0.65, "#71d6bb");
  const x = 0.8,
    z = -1;
  for (const sx of [-1, 1])
    kit.beam(
      g,
      new THREE.Vector3(x + sx * 0.36, 0.05, z),
      new THREE.Vector3(x, 4.2, z),
      0.055,
      "#ddd8db",
    );
  kit.cylinder(g, 0.04, 0.07, 4.6, x, 2.3, z, "#8a96a6", 6);
  for (const y of [2.6, 3.7]) {
    kit.box(g, 0.8, 0.05, 0.08, x, y, z, "#bec7ca");
    for (const sx of [-1, 1])
      kit.box(g, 0.16, 0.53, 0.13, x + sx * 0.38, y + 0.12, z, "#efeddf");
  }
  for (const dx of [-0.85, 0.3]) {
    kit.cylinder(g, 0.04, 0.04, 0.35, dx, 1.85, 0.6, "#7b8d99", 6);
    const dish = kit.cylinder(
      g,
      0.42,
      0.32,
      0.12,
      dx,
      2.1,
      0.65,
      "#e6ece4",
      14,
    );
    dish.rotation.x = 0.9;
    kit.beam(
      g,
      new THREE.Vector3(dx, 2.05, 0.65),
      new THREE.Vector3(dx, 2.45, 0.9),
      0.025,
      "#899ba9",
    );
  }
}

function tourism(kit: ModelKit, g: THREE.Group) {
  const hotel = new THREE.Group();
  hotel.position.set(-0.3, 0, -0.5);
  g.add(hotel);
  facility(kit, hotel, "#e8a58e", 2.4, 3.1, 1.6);
  for (const y of [0.65, 1.35, 2.05, 2.75])
    kit.box(hotel, 2.65, 0.08, 0.25, 0, y, 0.92, "#f5e6cd");
  kit.box(g, 1.85, 0.15, 1.45, 0.55, 0.1, 1.15, "#faf0d9");
  kit.box(g, 1.53, 0.055, 1.14, 0.55, 0.2, 1.15, "#6acbd2");
  for (const x of [-1.7, 1.75]) {
    kit.cylinder(g, 0.035, 0.035, 0.8, x, 0.4, 0.6, "#cbb889", 6);
    kit.cylinder(g, 0, 0.42, 0.22, x, 0.85, 0.6, "#f0c86b", 8);
    kit.box(g, 0.22, 0.1, 0.65, x, 0.08, 1.2, "#f8e8c8");
  }
  kit.palm(g, -1.75, -1.35, 1.05);
  kit.palm(g, 1.8, -1.3, 0.9);
}

function municipal(kit: ModelKit, g: THREE.Group) {
  kit.box(g, 3.6, 1.45, 1.8, 0, 0.75, -0.6, "#f2e8d4");
  kit.box(g, 3.8, 0.18, 2, 0, 1.54, -0.6, "#e4d8bf");
  kit.roof(g, 3.8, 0.6, 2, 0, 1.96, -0.6, "#c99584");
  for (const x of [-1.3, -0.43, 0.43, 1.3])
    kit.cylinder(g, 0.095, 0.11, 1.3, x, 0.72, 0.58, "#f9f0da", 8);
  kit.box(g, 3.9, 0.2, 0.8, 0, 0.15, 0.95, "#d2cbb7");
  kit.box(g, 3.2, 0.12, 0.7, 0, 0.32, 0.85, "#ebe0c4");
  kit.box(g, 0.5, 0.8, 0.04, 0, 0.8, 0.32, "#6c939b");
  kit.cylinder(g, 0.58, 0.66, 0.2, 0, 0.18, 1.9, "#e4dfcc", 14);
  kit.cylinder(g, 0.48, 0.48, 0.035, 0, 0.3, 1.9, "#67c1d0", 14);
  kit.cylinder(g, 0.09, 0.12, 0.5, 0, 0.53, 1.9, "#e5ece3", 8);
  kit.cylinder(g, 0.22, 0.32, 0.09, 0, 0.8, 1.9, "#d2e9e0", 12);
  kit.box(g, 0.025, 2.5, 0.025, 1.65, 1.25, -0.55, "#999f95");
  kit.box(g, 0.65, 0.36, 0.035, 1.33, 2.25, -0.55, "#77ae98");
  kit.tree(g, -1.85, 1.75, 0.7);
  kit.tree(g, 1.85, 1.75, 0.7);
}

export function buildServices(kit: ModelKit) {
  const builders = [water, energy, mobility, communication, tourism, municipal];
  return SERVICE_SITES.map((site, index): ServiceModel => {
    const group = new THREE.Group();
    group.name = `servicio-${site.id}`;
    group.position.set(site.x, 0.13, site.z);
    kit.box(
      group,
      4.7,
      0.16,
      4.5,
      0,
      -0.02,
      0,
      index === 4 ? "#f1e5c4" : "#dce2cd",
    );
    builders[index](kit, group);
    kit.merge(group);
    const buildingMaterials: ServiceModel["buildingMaterials"] = [];
    group.traverse((node) => {
      if (
        node instanceof THREE.Mesh &&
        node.material instanceof THREE.MeshStandardMaterial
      ) {
        const material = node.material.clone();
        node.material = material;
        buildingMaterials.push({ material, color: material.color.clone() });
      }
    });
    const signal = new THREE.MeshStandardMaterial({
      color: STATUS_COLORS.operational,
      emissive: STATUS_COLORS.operational,
      emissiveIntensity: 0.18,
      roughness: 0.6,
    });
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), signal);
    diamond.position.set(0, site.height, 0);
    diamond.scale.y = 1.6;
    diamond.userData.dynamic = true;
    group.add(diamond);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.45, 0.055, 4, 48),
      signal,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    ring.userData.dynamic = true;
    group.add(ring);
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(4.7, site.height, 4.5),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.y = site.height / 2;
    hitbox.userData.service = site.id;
    group.add(hitbox);
    return {
      id: site.id,
      group,
      anchor: new THREE.Vector3(site.x, site.height + 0.8, site.z),
      hitbox,
      signal,
      diamond,
      ring,
      buildingMaterials,
      status: "operational",
    };
  });
}

/** La maqueta solo consume la proyección pública: no conoce roles ni sesiones. */
export function applyServiceStates(
  models: ServiceModel[],
  departments: DepartmentState[],
) {
  let changed = false;
  for (const service of models) {
    const state = departments.find((d) => d.id === service.id);
    if (service.group.visible !== !!state) changed = true;
    service.group.visible = !!state;
    if (state && state.status !== service.status) {
      changed = true;
      service.status = state.status;
      service.signal.color.set(STATUS_COLORS[state.status]);
      service.signal.emissive.set(STATUS_COLORS[state.status]);
      for (const { material, color } of service.buildingMaterials) {
        material.color.copy(color);
        if (state.status === "down")
          material.color
            .lerp(new THREE.Color("#757b85"), 0.8)
            .multiplyScalar(0.8);
        else if (state.status === "warning")
          material.color.lerp(new THREE.Color("#ecb36a"), 0.18);
      }
    }
  }
  return changed;
}
