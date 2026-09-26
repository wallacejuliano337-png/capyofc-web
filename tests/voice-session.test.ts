import { describe, it, expect, vi } from "vitest";
import { VoiceSession, type VoiceToken } from "../src/services/voice-session";
function fixture() {
  let current = "";
  const events: string[] = [];
  const room = {
    connect: vi.fn(async (_url: string, token: string) => {
      expect(current).toBe("");
      current = token;
      events.push("connect:" + token);
    }),
    disconnect: vi.fn(async () => {
      events.push("disconnect:" + current);
      current = "";
    }),
    localParticipant: {
      setMicrophoneEnabled: vi.fn(async (enabled: boolean) => {
        events.push("mic:" + enabled);
      }),
    },
  };
  const token = vi.fn(
    async (channel: string, _signal: AbortSignal): Promise<VoiceToken> => ({
      url: "wss://test.livekit.cloud",
      token: channel,
    }),
  );
  return {
    room,
    token,
    events,
    current: () => current,
    session: new VoiceSession(room, token),
  };
}
describe("exclusive voice session", () => {
  it("disconnects lobby before connecting treino, with microphone off", async () => {
    const f = fixture();
    await f.session.enter("lobby");
    await f.session.enter("treino");
    expect(f.events).toEqual([
      "disconnect:",
      "connect:lobby",
      "mic:false",
      "disconnect:lobby",
      "connect:treino",
      "mic:false",
    ]);
    await f.session.leave();
    expect(f.current()).toBe("");
  });
  it("ignores stale tokens when channels change rapidly", async () => {
    const f = fixture();
    let resolve!: (v: VoiceToken) => void;
    f.token.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const first = f.session.enter("lobby");
    await vi.waitFor(() => expect(f.token).toHaveBeenCalledOnce());
    const next = f.session.enter("treino");
    resolve({ url: "wss://test", token: "lobby" });
    await Promise.all([first, next]);
    expect(f.room.connect).toHaveBeenCalledExactlyOnceWith(
      "wss://test.livekit.cloud",
      "treino",
    );
  });
  it("leaving during token fetch cannot connect later", async () => {
    const f = fixture();
    let resolve!: (v: VoiceToken) => void;
    f.token.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const entry = f.session.enter("lobby");
    await vi.waitFor(() => expect(f.token).toHaveBeenCalledOnce());
    const leave = f.session.leave();
    resolve({ url: "wss://test", token: "lobby" });
    await Promise.all([entry, leave]);
    expect(f.room.connect).not.toHaveBeenCalled();
    expect(f.current()).toBe("");
  });
  it("disconnects an in-flight connection before switching rooms", async () => {
    const f = fixture();
    let resolve!: () => void;
    f.room.connect.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const first = f.session.enter("lobby");
    await vi.waitFor(() => expect(f.room.connect).toHaveBeenCalledOnce());
    const next = f.session.enter("treino");
    expect(f.room.connect).toHaveBeenCalledTimes(1);
    resolve();
    await Promise.all([first, next]);
    expect(f.current()).toBe("treino");
    expect(f.room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(
      1,
    );
  });
  it("cleans up a failed connection and allows retry", async () => {
    const f = fixture();
    f.room.connect.mockRejectedValueOnce(new Error("offline"));
    await expect(f.session.enter("lobby")).rejects.toThrow("offline");
    expect(f.current()).toBe("");
    await f.session.enter("lobby");
    expect(f.current()).toBe("lobby");
  });
});
