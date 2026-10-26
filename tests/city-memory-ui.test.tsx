import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import * as THREE from "three";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCity } from "../client/three/cityScene";
import { cityNarrative } from "../shared/cityNarrative";
import { memoryLabel } from "../client/three/impactLabels";
import CityMap from "../client/components/CityMap";
import Dashboard, { DEMO_STATE } from "../client/pages/Dashboard";
import type { CityNarrative, DepartmentState } from "../shared/types";

const departments: DepartmentState[] = DEMO_STATE.departments.map((d) => ({
  ...d,
}));
function narrative(memory: "scarred" | "recovered"): CityNarrative {
  return cityNarrative({
    departments,
    chapters: [
      {
        phase: "mail",
        outcome: "affected",
        services: departments.map((d) => ({ id: d.id, status: "down" })),
      },
      ...(memory === "recovered"
        ? [
            {
              phase: "recovery" as const,
              outcome: "restored" as const,
              services: [],
              recoveryProgress: 1,
            },
          ]
        : []),
    ],
    phase: "voting",
    stage: "finished",
    recovery: { completed: 0, total: 5 },
  });
}

test("P6: huellas tenues reutilizan luces/tránsito/personas, recuperado restaura sin parecer caído", () => {
  const city = buildCity();
  try {
    const scar = narrative("scarred");
    city.updatePublic(departments, scar);
    assert.equal(city.effects.state.energy.status, "scarred");
    assert.equal(city.effects.state.energy.night, false);
    assert.equal(city.effects.state.energy.intensityScale, 0.9);
    assert.equal(city.effects.state.mobility.speedScale, 0.8);
    assert.equal(city.effects.state.mobility.carsStopped, false);
    for (const id of ["agua", "comunicaciones", "turismo", "municipal"])
      assert.equal(city.effects.state.incidents[id].count, 1);
    assert(
      city.services.every(
        (s) => s.status === "operational" && s.memory === "scarred",
      ),
    );
    const recovered = narrative("recovered");
    city.updatePublic(departments, recovered);
    assert.equal(city.effects.state.energy.mode, "normal");
    assert.equal(city.effects.state.energy.intensityScale, 1);
    assert.equal(city.effects.state.mobility.mode, "normal");
    assert(city.services.every((s) => s.memory === "recovered"));
    for (const incident of Object.values(city.effects.state.incidents))
      assert.equal(incident.visible, false);
    for (const d of departments)
      assert(memoryLabel(d.id, recovered).includes("restaurad"));
    // Current operational damage overrides historical restoration, without changing it.
    city.updatePublic(
      departments.map((d) => ({ ...d, status: "down" })),
      recovered,
    );
    assert.equal(city.effects.state.energy.mode, "blackout");
    assert.equal(city.effects.state.mobility.carsStopped, true);
    assert.equal(city.effects.state.incidents.agua.count, 5);
    city.updatePublic(departments, recovered);
    assert.equal(city.effects.state.energy.mode, "normal");
  } finally {
    city.dispose();
  }
});

test("P6: superficies de agua, LEDs de antena y ventanas turísticas reaccionan sin geometrías nuevas", () => {
  const city = buildCity();
  try {
    const resources = () => {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      city.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          geometries.add(node.geometry);
          for (const material of Array.isArray(node.material)
            ? node.material
            : [node.material])
            materials.add(material);
        }
      });
      return { geometries, materials };
    };
    const before = resources();
    city.updatePublic(departments);
    const antenna = city.services
      .find((s) => s.id === "comunicaciones")!
      .buildingMaterials.find(
        (m) => m.color.getHexString() === "71d6bb",
      )!.material;
    const window = city.services
      .find((s) => s.id === "turismo")!
      .buildingMaterials.find(
        (m) => m.color.getHexString() === "8ec9d6",
      )!.material;
    assert.equal(antenna.emissiveIntensity, 0.22);
    assert.equal(window.emissiveIntensity, 0.22);
    city.updatePublic(departments.map((d) => ({ ...d, status: "down" })));
    assert.equal(antenna.emissiveIntensity, 0);
    assert.equal(window.emissiveIntensity, 0);
    for (let i = 0; i < 20; i++)
      city.updatePublic(
        departments,
        narrative(i % 2 ? "scarred" : "recovered"),
      );
    const after = resources();
    assert.deepEqual(after, before);
    assert(city.services.every((s) => s.group.visible));
    city.updatePublic(departments.slice(0, 3), narrative("recovered"));
    assert(city.services.slice(3).every((s) => !s.group.visible));
    let released = 0;
    for (const resource of [...before.geometries, ...before.materials])
      resource.addEventListener("dispose", () => released++);
    city.dispose();
    assert(released >= before.geometries.size + before.materials.size);
    const once = released;
    city.dispose();
    assert.equal(released, once);
  } finally {
    city.dispose();
  }
});

test("P6: HUD y servicios son accesibles, sin identidad privada ni superposición con alertas/QR", () => {
  const dom = new JSDOM("<div></div>");
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true }),
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: dom.window,
  });
  try {
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        state: {
          ...DEMO_STATE,
          city: narrative("scarred"),
          phase: "ddos",
          stage: "playing",
          ddos: { waveAlert: true },
        },
      }),
    );
    const page = new JSDOM(html).window.document;
    assert(page.querySelector('meter[aria-label="Estabilidad de la ciudad"]'));
    assert(
      page
        .querySelector(".city-hud")!
        .textContent!.includes("indicador narrativo, no puntuación"),
    );
    assert(!page.querySelector(".monitor-city .city-hud"));
    assert(page.querySelector(".ddos-public-alert"));
    assert.equal(page.querySelectorAll(".service-tile").length, 6);
    assert(
      page
        .querySelector(".city-canvas")!
        .getAttribute("aria-label")!
        .includes("no es bloqueo actual"),
    );
    for (const secret of ["Origen A", "ANÁLISIS PRIVADO", "impostor", "token"])
      assert(!html.includes(secret));
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
    dom.window.close();
  }
});

test("P6: fallback WebGL comunica huellas y recuperados, movimiento reducido y desmontaje seguro", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
  let removed = 0;
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => removed++,
    }),
  });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "getContext", {
    value: () => null,
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  const warn = console.warn,
    error = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    await act(async () => {
      root.render(
        createElement(CityMap, {
          departments,
          narrative: narrative("scarred"),
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    const host = dom.window.document.getElementById("root")!;
    assert(host.querySelector(".has-fallback"));
    assert.equal(host.querySelectorAll(".city-fallback-service").length, 6);
    assert(host.textContent!.includes("Huella previa"));
    await act(async () =>
      root.render(
        createElement(CityMap, {
          departments,
          narrative: narrative("recovered"),
          paused: true,
        }),
      ),
    );
    assert(host.textContent!.includes("Suministro restaurado"));
    assert(
      ![...host.querySelectorAll(".city-fallback-service")].some((button) =>
        button.textContent!.includes("Fuera de línea"),
      ),
    );
    await act(async () => root.unmount());
    assert(removed > 0);
    assert.equal(host.querySelectorAll("canvas").length, 0);
  } finally {
    console.warn = warn;
    console.error = error;
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
