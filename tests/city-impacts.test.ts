import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildCity } from "../client/three/cityScene";
import { DEPARTMENTS, type DepartmentState } from "../shared/types";

function departments(
  overrides: Record<string, DepartmentState["status"]> = {},
) {
  return DEPARTMENTS.map((department) => ({
    id: department.id,
    name: department.name,
    status: overrides[department.id] ?? "operational",
    occupied: false,
    connected: false,
  }));
}

test("los impactos usan personas instanciadas finitas y la ciudad completa sigue bajo 200 mallas", () => {
  const city = buildCity();
  try {
    city.updatePublic(
      departments({
        agua: "down",
        energia: "down",
        movilidad: "down",
        comunicaciones: "down",
        turismo: "down",
        municipal: "down",
      }),
    );
    let meshes = 0;
    let peopleBatches = 0;
    city.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      meshes++;
      if (
        node instanceof THREE.InstancedMesh &&
        /anonymous|heads|torsos|arms|legs/.test(node.name)
      )
        peopleBatches++;
      const positions = node.geometry.getAttribute("position");
      for (const value of positions.array) assert(Number.isFinite(value));
    });
    assert(meshes < 200);
    assert(peopleBatches >= 16);
    assert.equal(city.effects.state.normalCrowd.count, 8);
    assert.equal(city.effects.state.incidents.agua.count, 5);
  } finally {
    city.dispose();
  }
});

test("warning y down cambian visibilidad/severidad y energía restaura exactamente su línea base", () => {
  const city = buildCity();
  try {
    const { hemisphere, sun, ambient } = city.effects.lights;
    const baseline = {
      background: (city.scene.background as THREE.Color).clone(),
      hemisphere: [
        hemisphere.color.clone(),
        hemisphere.groundColor.clone(),
        hemisphere.intensity,
      ],
      sun: [sun.color.clone(), sun.intensity],
      ambient: [ambient.color.clone(), ambient.intensity],
    } as const;
    city.updatePublic(departments({ energia: "warning", agua: "warning" }));
    assert.equal(city.effects.state.energy.mode, "dim");
    assert.equal(city.effects.state.energy.night, false);
    assert.equal(city.effects.state.incidents.agua.count, 3);
    const warningBackground = (
      city.scene.background as THREE.Color
    ).getHexString();
    city.updatePublic(departments({ energia: "down", agua: "down" }));
    assert.equal(city.effects.state.energy.mode, "blackout");
    assert.equal(city.effects.state.energy.night, true);
    assert.notEqual(
      (city.scene.background as THREE.Color).getHexString(),
      warningBackground,
    );
    assert.equal(city.effects.state.incidents.agua.count, 5);
    city.updatePublic(departments());
    assert.equal(
      (city.scene.background as THREE.Color).getHexString(),
      baseline.background.getHexString(),
    );
    assert.equal(
      hemisphere.color.getHexString(),
      baseline.hemisphere[0].getHexString(),
    );
    assert.equal(
      hemisphere.groundColor.getHexString(),
      baseline.hemisphere[1].getHexString(),
    );
    assert.equal(hemisphere.intensity, baseline.hemisphere[2]);
    assert.equal(sun.color.getHexString(), baseline.sun[0].getHexString());
    assert.equal(sun.intensity, baseline.sun[1]);
    assert.equal(
      ambient.color.getHexString(),
      baseline.ambient[0].getHexString(),
    );
    assert.equal(ambient.intensity, baseline.ambient[1]);
  } finally {
    city.dispose();
  }
});

test("movilidad detenida forma atasco y al volver operativa recupera el flujo en animate", () => {
  const city = buildCity();
  try {
    city.updatePublic(departments({ movilidad: "down" }));
    city.animate(3);
    const stopped = city.cars.group.children
      .filter(
        (node): node is THREE.InstancedMesh =>
          node instanceof THREE.InstancedMesh,
      )
      .map((mesh) => Array.from(mesh.instanceMatrix.array));
    city.animate(4);
    const stillStopped = city.cars.group.children
      .filter(
        (node): node is THREE.InstancedMesh =>
          node instanceof THREE.InstancedMesh,
      )
      .map((mesh) => Array.from(mesh.instanceMatrix.array));
    assert.deepEqual(stillStopped, stopped);
    assert.equal(city.effects.state.mobility.carsStopped, true);
    assert.equal(city.effects.state.mobility.visibleQueue, 5);
    city.updatePublic(departments({ movilidad: "operational" }));
    city.animate(5);
    const moving = city.cars.group.children
      .filter(
        (node): node is THREE.InstancedMesh =>
          node instanceof THREE.InstancedMesh,
      )
      .map((mesh) => Array.from(mesh.instanceMatrix.array));
    assert.notDeepEqual(moving, stillStopped);
    assert.equal(city.effects.state.mobility.carsStopped, false);
    assert.equal(city.effects.state.mobility.visibleQueue, 3);
  } finally {
    city.dispose();
  }
});

test("ausencia pública oculta solo incidentes y snapshot es anónimo", () => {
  const city = buildCity();
  try {
    city.updatePublic([
      {
        id: "energia",
        name: "Energía",
        status: "down",
        occupied: false,
        connected: false,
      },
    ]);
    assert.equal(city.effects.state.incidents.agua.visible, false);
    assert.equal(city.effects.state.incidents.turismo.visible, false);
    assert.equal(city.effects.state.mobility.mode, "normal");
    const snapshot = JSON.stringify(city.effects.snapshot()).toLowerCase();
    for (const privateWord of [
      "player",
      "role",
      "token",
      "node",
      "impostor",
      "secret",
    ]) {
      assert.equal(snapshot.includes(privateWord), false, privateWord);
    }
    city.animate(1);
    city.effects.dispose();
    city.effects.dispose();
  } finally {
    city.dispose();
  }
});
