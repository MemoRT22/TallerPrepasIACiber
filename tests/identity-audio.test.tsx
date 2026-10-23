import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import SyntheticVoice from "../client/components/SyntheticVoice";

test("audio opcional exige pulsación, permite silenciar y se detiene al salir", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let played = 0;
  let paused = 0;
  class LocalAudio {
    currentTime = 0;
    preload = "";
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public src: string) {
      assert.equal(src, "/audio/local.mp3");
    }
    async play() {
      played += 1;
    }
    pause() {
      paused += 1;
    }
  }
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    Audio: LocalAudio,
    fetch: async (src: string, options: RequestInit) => {
      assert.equal(src, "/audio/local.mp3");
      assert.equal(options.method, "HEAD");
      return {
        ok: true,
        headers: new Headers({ "content-type": "audio/mpeg" }),
      };
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const host = dom.window.document.getElementById("root")!;
  const root = createRoot(host);
  const click = async () => {
    await act(async () => {
      host.querySelector("button")!.click();
    });
  };
  try {
    await act(async () => {
      root.render(createElement(SyntheticVoice, { src: "/audio/local.mp3" }));
    });
    assert.equal(played, 0);
    assert(host.textContent!.includes("Activar audio"));
    await click();
    assert.equal(played, 1);
    assert(host.textContent!.includes("Silenciar"));
    await click();
    assert.equal(paused, 1);
    assert(host.textContent!.includes("Activar audio"));
    await click();
    assert.equal(played, 2);
    await act(async () => {
      root.unmount();
    });
    assert.equal(paused, 2);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
