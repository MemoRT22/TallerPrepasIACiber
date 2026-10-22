import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildCity } from "../client/three/cityScene";
import { makeCamera } from "../client/three/CityViewport";
import { applyServiceStates, STATUS_COLORS } from "../client/three/services";
import { DEPARTMENTS, type DepartmentState } from "../shared/types";

function publicDepartments(): DepartmentState[] {
  return DEPARTMENTS.map((d) => ({
    id: d.id,
    name: d.name,
    status: "operational",
    occupied: false,
    connected: false,
  }));
}

test("la maqueta construye seis infraestructuras 3D finitas y agrupadas", () => {
  const city = buildCity();
  try {
    assert.deepEqual(
      city.services.map((s) => s.id),
      [
        "agua",
        "energia",
        "movilidad",
        "comunicaciones",
        "turismo",
        "municipal",
      ],
    );
    let meshes = 0,
      vertices = 0;
    city.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      meshes++;
      const positions = node.geometry.getAttribute("position");
      vertices += positions.count;
      for (let i = 0; i < positions.array.length; i++)
        assert(Number.isFinite(positions.array[i]), "Coordenada no finita");
    });
    assert(meshes < 200, `Demasiadas llamadas de dibujo: ${meshes}`);
    assert(vertices > 1000);
    for (const service of city.services) {
      const bounds = new THREE.Box3().setFromObject(service.group);
      assert(!bounds.isEmpty());
      assert(
        bounds.max.y - bounds.min.y > 2,
        "Cada servicio debe ser tridimensional",
      );
      assert.equal(service.hitbox.userData.service, service.id);
    }
  } finally {
    city.dispose();
  }
});

test("la cámara inicial encuadra todos los servicios en escritorio y móvil", () => {
  const city = buildCity();
  try {
    for (const [width, height] of [
      [1000, 500],
      [650, 480],
      [375, 344],
    ]) {
      const camera = makeCamera(width, height);
      camera.updateMatrixWorld();
      for (const service of city.services) {
        const point = service.anchor.clone().project(camera);
        assert(
          Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.91,
          `Etiqueta fuera de cuadro: ${service.id}, ${width}px (${point.x}, ${point.y})`,
        );
        assert(point.z > -1 && point.z < 1);
      }
    }
  } finally {
    city.dispose();
  }
});

test("los colores 3D usan exclusivamente el estado público y municipal se oculta en salas de cinco", () => {
  const city = buildCity();
  try {
    const state = publicDepartments();
    state[0].status = "down";
    state[1].status = "warning";
    applyServiceStates(city.services, state.slice(0, 5));
    assert.equal(
      city.services[0].signal.color.getHexString(),
      new THREE.Color(STATUS_COLORS.down).getHexString(),
    );
    assert.equal(
      city.services[1].signal.color.getHexString(),
      new THREE.Color(STATUS_COLORS.warning).getHexString(),
    );
    assert.equal(city.services[5].group.visible, false);
    state[0].status = "operational";
    applyServiceStates(city.services, state);
    assert.equal(city.services[5].group.visible, true);
    assert.equal(city.services[0].status, "operational");
    const metadata = JSON.stringify(city.services.map((s) => s.group.userData));
    assert(
      !metadata.includes("role") &&
        !metadata.includes("token") &&
        !metadata.includes("impostor"),
    );
  } finally {
    city.dispose();
  }
});

test("la selección por rayo detecta cada instalación sin confundir edificios decorativos", () => {
  const city = buildCity();
  try {
    city.scene.updateMatrixWorld(true);
    for (const service of city.services) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(
          service.group.position.x,
          25,
          service.group.position.z,
        ),
        new THREE.Vector3(0, -1, 0),
      );
      const hits = ray.intersectObjects(
        city.services.map((s) => s.hitbox),
        false,
      );
      assert.equal(hits[0]?.object.userData.service, service.id);
    }
  } finally {
    city.dispose();
  }
});

test("un fallo desatura la infraestructura afectada sin alterar materiales de otro servicio", () => {
  const city = buildCity();
  try {
    const departments = publicDepartments();
    const [water, energy] = city.services;
    const waterOriginal = water.buildingMaterials.map(({ material }) =>
      material.color.getHexString(),
    );
    const energyOriginal = energy.buildingMaterials.map(({ material }) =>
      material.color.getHexString(),
    );
    departments[0].status = "down";
    applyServiceStates(city.services, departments);
    assert(
      water.buildingMaterials.some(
        ({ material }, i) => material.color.getHexString() !== waterOriginal[i],
      ),
    );
    assert.deepEqual(
      energy.buildingMaterials.map(({ material }) =>
        material.color.getHexString(),
      ),
      energyOriginal,
    );
    departments[0].status = "operational";
    applyServiceStates(city.services, departments);
    assert.deepEqual(
      water.buildingMaterials.map(({ material }) =>
        material.color.getHexString(),
      ),
      waterOriginal,
    );
  } finally {
    city.dispose();
  }
});
