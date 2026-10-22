import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Geometría original: pequeñas piezas compartidas, agrupadas por material. */
export class ModelKit {
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private geometries = new Map<string, THREE.BufferGeometry>();

  material(color: string, emissive = false) {
    const key = `${color}:${emissive}`;
    if (!this.materials.has(key)) {
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.84,
          metalness: 0.04,
          ...(emissive ? { emissive: color, emissiveIntensity: 0.22 } : {}),
        }),
      );
    }
    return this.materials.get(key)!;
  }

  geometry(key: string, create: () => THREE.BufferGeometry) {
    if (!this.geometries.has(key)) this.geometries.set(key, create());
    return this.geometries.get(key)!;
  }

  mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) {
    const mesh = this.mesh(
      parent,
      this.geometry("box", () => new THREE.BoxGeometry()),
      color,
    );
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    return mesh;
  }

  cylinder(
    parent: THREE.Object3D,
    top: number,
    bottom: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color: string,
    sides = 10,
  ) {
    const key = `cylinder:${top}:${bottom}:${h}:${sides}`;
    const mesh = this.mesh(
      parent,
      this.geometry(
        key,
        () => new THREE.CylinderGeometry(top, bottom, h, sides),
      ),
      color,
    );
    mesh.position.set(x, y, z);
    return mesh;
  }

  sphere(
    parent: THREE.Object3D,
    r: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) {
    const mesh = this.mesh(
      parent,
      this.geometry(`sphere:${r}`, () => new THREE.IcosahedronGeometry(r, 1)),
      color,
    );
    mesh.position.set(x, y, z);
    return mesh;
  }

  beam(
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    color: string,
  ) {
    const mesh = this.cylinder(
      parent,
      radius,
      radius,
      a.distanceTo(b),
      0,
      0,
      0,
      color,
      5,
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    return mesh;
  }

  cable(
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    sag = 0.22,
    color = "#3d5264",
  ) {
    const points = Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return a
        .clone()
        .lerp(b, t)
        .add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0));
    });
    return this.mesh(
      parent,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        12,
        0.024,
        4,
        false,
      ),
      color,
    );
  }

  roof(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) {
    const mesh = this.cylinder(parent, 0, 1, h, x, y, z, color, 4);
    mesh.rotation.y = Math.PI / 4;
    mesh.scale.set(w / Math.SQRT2, 1, d / Math.SQRT2);
    return mesh;
  }

  polygon(
    parent: THREE.Object3D,
    points: [number, number][],
    color: string,
    y = 0,
    depth = 0.28,
  ) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) =>
      i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
    );
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    const mesh = this.mesh(parent, geometry, color);
    mesh.position.y = y - depth;
    return mesh;
  }

  palm(parent: THREE.Object3D, x: number, z: number, size = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(size);
    parent.add(g);
    this.cylinder(g, 0.075, 0.13, 1.75, 0, 0.87, 0, "#ae825c", 7);
    for (let i = 0; i < 7; i++) {
      const leaf = this.box(
        g,
        0.28,
        0.075,
        1.13,
        0,
        1.75,
        0,
        i % 2 ? "#3f9463" : "#66b56d",
      );
      const angle = (i * Math.PI * 2) / 7;
      leaf.position.set(Math.sin(angle) * 0.45, 1.77, Math.cos(angle) * 0.45);
      leaf.rotation.set(-0.24, angle, 0.08);
    }
    this.sphere(g, 0.12, 0.1, 1.69, 0.07, "#997149");
  }

  tree(parent: THREE.Object3D, x: number, z: number, size = 1) {
    this.cylinder(
      parent,
      0.08,
      0.1,
      0.9 * size,
      x,
      0.45 * size,
      z,
      "#9c755b",
      6,
    );
    const crown = this.sphere(parent, 0.65 * size, x, 1.1 * size, z, "#74b66f");
    crown.scale.y = 1.12;
  }

  windows(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    color = "#96cbd6",
    floors = 2,
    columns = 3,
  ) {
    for (let floor = 0; floor < floors; floor++)
      for (let col = 0; col < columns; col++) {
        this.box(
          parent,
          0.26,
          0.3,
          0.025,
          -w / 2 + ((col + 0.5) * w) / columns,
          0.45 + (floor * (h - 0.5)) / floors,
          d / 2 + 0.02,
          color,
        );
      }
    for (let floor = 0; floor < floors; floor++)
      for (let col = 0; col < 2; col++) {
        this.box(
          parent,
          0.025,
          0.3,
          0.3,
          w / 2 + 0.02,
          0.45 + (floor * (h - 0.5)) / floors,
          -d / 2 + ((col + 0.5) * d) / 2,
          color,
        );
      }
  }

  car(
    parent: THREE.Object3D,
    x: number,
    z: number,
    color: string,
    bus = false,
  ) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    const length = bus ? 1.8 : 0.85;
    this.box(g, 0.54, 0.36, length, 0, 0.29, 0, color);
    this.box(g, 0.44, 0.27, bus ? 1.58 : 0.45, 0, 0.59, -0.02, "#d1eff0");
    this.box(g, 0.47, 0.05, bus ? 1.68 : 0.48, 0, 0.75, -0.02, color);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const wheel = this.cylinder(
          g,
          0.12,
          0.12,
          0.08,
          sx * 0.28,
          0.17,
          sz * length * 0.3,
          "#3c4b51",
          8,
        );
        wheel.rotation.z = Math.PI / 2;
      }
    return g;
  }

  /** Combina mallas estáticas conservando las coordenadas locales del grupo. */
  merge(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map<
      THREE.Material,
      { meshes: THREE.Mesh[]; geometries: THREE.BufferGeometry[] }
    >();
    group.traverse((node) => {
      if (
        !(node instanceof THREE.Mesh) ||
        node.userData.dynamic ||
        Array.isArray(node.material)
      )
        return;
      if (!buckets.has(node.material))
        buckets.set(node.material, { meshes: [], geometries: [] });
      const bucket = buckets.get(node.material)!;
      let geometry = node.geometry
        .clone()
        .applyMatrix4(inverse.clone().multiply(node.matrixWorld));
      if (geometry.index) {
        const indexed = geometry;
        geometry = indexed.toNonIndexed();
        indexed.dispose();
      }
      bucket.meshes.push(node);
      bucket.geometries.push(geometry);
    });
    for (const [material, bucket] of buckets) {
      const merged = mergeGeometries(bucket.geometries, false);
      bucket.geometries.forEach((g) => g.dispose());
      if (!merged) continue;
      bucket.meshes.forEach((mesh) => mesh.removeFromParent());
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  dispose() {
    this.materials.forEach((m) => m.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.materials.clear();
    this.geometries.clear();
  }
}
