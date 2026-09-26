import { beforeEach, expect, it, vi } from "vitest";
import type { Room } from "livekit-client";
import { AudioSettings } from "../src/services/audio-settings";
import { MicrophoneMeter } from "../src/services/microphone-meter";
it("uses the existing room for device selection and does not disconnect on unbind", async () => {
  const room = {
    state: "connected",
    getActiveDevice: vi.fn(() => "default"),
    on: vi.fn(),
    off: vi.fn(),
    switchActiveDevice: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
  };
  const settings = new AudioSettings();
  const unbind = settings.bind(room as unknown as Room);
  expect(settings.getSnapshot().connected).toBe(true);
  await settings.select("audioinput", "mic");
  await settings.select("audiooutput", "speaker");
  expect(room.switchActiveDevice.mock.calls).toEqual([
    ["audioinput", "mic"],
    ["audiooutput", "speaker"],
  ]);
  expect(settings.getSnapshot()).toMatchObject({
    input: "mic",
    output: "speaker",
  });
  unbind();
  expect(room.disconnect).not.toHaveBeenCalled();
  expect(settings.getSnapshot().connected).toBe(false);
  await expect(settings.select("audioinput", "other")).rejects.toThrow();
});
it("does not display a failed selection as successful and clamps output volume", async () => {
  const settings = new AudioSettings();
  settings.bind({
    state: "disconnected",
    getActiveDevice: () => undefined,
    on: vi.fn(),
    off: vi.fn(),
    switchActiveDevice: vi.fn().mockResolvedValue(false),
  } as unknown as Room);
  await expect(settings.select("audioinput", "missing")).rejects.toThrow();
  expect(settings.getSnapshot().input).toBe("default");
  settings.setVolume(2);
  expect(settings.getSnapshot().volume).toBe(1);
  settings.setVolume(-1);
  expect(settings.getSnapshot().volume).toBe(0);
  settings.setVolume(0.4);
  expect(settings.getSnapshot().volume).toBe(0.4);
});
beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
});
it("stops capture granted after the microphone test has already closed", async () => {
  let resolve!: (stream: MediaStream) => void;
  const stop = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(
        () =>
          new Promise<MediaStream>((r) => {
            resolve = r;
          }),
      ),
    },
  });
  const meter = new MicrophoneMeter();
  const pending = meter.start("default", vi.fn());
  meter.stop();
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  expect(await pending).toBe(false);
  expect(stop).toHaveBeenCalledOnce();
});
it("meter captures only selected microphone, never connects to output, and cleans up", async () => {
  const stop = vi.fn(),
    close = vi.fn().mockResolvedValue(undefined),
    connect = vi.fn();
  const analyser = {
    fftSize: 0,
    getFloatTimeDomainData: (values: Float32Array) => values.fill(0.1),
  };
  const capture = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: capture } });
  vi.stubGlobal(
    "AudioContext",
    class {
      createAnalyser() {
        return analyser;
      }
      createMediaStreamSource() {
        return { connect };
      }
      resume() {
        return Promise.resolve();
      }
      close = close;
    },
  );
  const level = vi.fn(),
    meter = new MicrophoneMeter();
  expect(await meter.start("mic", level)).toBe(true);
  expect(capture).toHaveBeenCalledWith({
    audio: { deviceId: { exact: "mic" } },
    video: false,
  });
  expect(connect).toHaveBeenCalledExactlyOnceWith(analyser);
  expect(level).toHaveBeenCalled();
  meter.stop();
  expect(stop).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});
