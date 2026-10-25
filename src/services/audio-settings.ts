import type { Room } from "livekit-client";
import { useSyncExternalStore } from "react";
type Snapshot = {
  input: string;
  output: string;
  video: string;
  volume: number;
  connected: boolean;
};
export class AudioSettings {
  private room: Room | null = null;
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = {
    input: "default",
    output: "default",
    video: "default",
    volume: 1,
    connected: false,
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private update(value: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...value };
    this.listeners.forEach((listener) => listener());
  }
  bind(room: Room) {
    this.room = room;
    const sync = () =>
      this.update({
        input: room.getActiveDevice("audioinput") || "default",
        output: room.getActiveDevice("audiooutput") || "default",
        video: room.getActiveDevice("videoinput") || "default",
        connected: room.state === "connected",
      });
    room.on("activeDeviceChanged", sync);
    room.on("connectionStateChanged", sync);
    sync();
    return () => {
      room.off("activeDeviceChanged", sync);
      room.off("connectionStateChanged", sync);
      if (this.room === room) {
        this.room = null;
        this.update({ connected: false });
      }
    };
  }
  async select(
    kind: "audioinput" | "audiooutput" | "videoinput",
    id: string,
  ) {
    if (!this.room) throw new Error("Aguarde a inicialização do áudio.");
    const room = this.room;
    if (!(await room.switchActiveDevice(kind, id)))
      throw new Error("Não foi possível selecionar este dispositivo.");
    if (this.room === room)
      this.update(
        kind === "audioinput"
          ? { input: id }
          : kind === "audiooutput"
            ? { output: id }
            : { video: id },
      );
  }
  setVolume(value: number) {
    if (Number.isFinite(value))
      this.update({ volume: Math.max(0, Math.min(1, value)) });
  }
}
export const audioSettings = new AudioSettings();
export const useAudioSettings = () =>
  useSyncExternalStore(
    audioSettings.subscribe,
    audioSettings.getSnapshot,
    audioSettings.getSnapshot,
  );
