import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import JoinQR, { showJoinQR } from "../client/components/JoinQR";

const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', {
  url: "https://example.test/pantalla/8378",
});
for (const [name, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  IS_REACT_ACT_ENVIRONMENT: true,
}))
  Object.defineProperty(globalThis, name, { configurable: true, value });
const container = document.getElementById("root")!;
test("QR codifica solo ruta pública correcta y conserva imagen al actualizar conectados", async () => {
  const calls: string[] = [];
  const original = QRCode.toDataURL;
  QRCode.toDataURL = (async (text: string) => {
    calls.push(text);
    return "data:image/png;base64,ok";
  }) as typeof QRCode.toDataURL;
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(JoinQR, {
          code: "8378",
          capacity: 3,
          connected: 1,
          automatic: true,
        }),
      ),
    );
    assert.deepEqual(calls, ["https://example.test/jugar?code=8378"]);
    assert.equal(
      container.querySelector("img")?.getAttribute("src"),
      "data:image/png;base64,ok",
    );
    assert(container.textContent?.includes("1 / 3"));
    await act(async () =>
      root.render(
        createElement(JoinQR, {
          code: "8378",
          capacity: 3,
          connected: 2,
          automatic: true,
        }),
      ),
    );
    assert.equal(calls.length, 1);
    assert(container.textContent?.includes("2 / 3"));
    assert(!container.textContent?.includes("token"));
    assert(!container.textContent?.includes("impostor"));
    assert(!container.querySelector("button"));
  } finally {
    await act(async () => root.unmount());
    QRCode.toDataURL = original;
  }
});
test("fallo del generador conserva acceso alterno con código, sin espera infinita", async () => {
  const original = QRCode.toDataURL;
  QRCode.toDataURL = (async () => {
    throw new Error("fallo");
  }) as typeof QRCode.toDataURL;
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(JoinQR, { code: "1234", capacity: 6, connected: 0 }),
      ),
    );
    assert(container.textContent?.includes("Usa el código de acceso"));
    assert(container.textContent?.includes("1234"));
    assert.equal(
      container.querySelector("a")?.getAttribute("href"),
      "/jugar?code=1234",
    );
    assert(!container.textContent?.includes("Preparando QR"));
  } finally {
    await act(async () => root.unmount());
    QRCode.toDataURL = original;
  }
});
test("el selector del QR ignora demo, sesiones ya asignadas y fases posteriores", () => {
  const lobby = {
    code: "8378",
    phase: "lobby",
    assigned: false,
    autoStart: true,
  };
  assert(showJoinQR(lobby));
  assert(!showJoinQR(lobby, true));
  assert(!showJoinQR({ ...lobby, code: "----" }));
  assert(!showJoinQR({ ...lobby, assigned: true }));
  assert(!showJoinQR({ ...lobby, phase: "mail" }));
  assert(!showJoinQR({ ...lobby, autoStart: false }));
  assert(!showJoinQR({ ...lobby, autoStart: undefined }));
});
