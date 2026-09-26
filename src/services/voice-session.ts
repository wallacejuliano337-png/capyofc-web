export interface VoiceConnection {
  connect(url: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
  localParticipant: {
    setMicrophoneEnabled(enabled: boolean): Promise<unknown>;
  };
}
export type VoiceToken = { url: string; token: string };

// Serialize room changes. A superseded request can never connect another room.
export class VoiceSession {
  private pending: Promise<unknown> = Promise.resolve();
  private request?: AbortController;
  constructor(
    private room: VoiceConnection,
    private token: (
      channel: string,
      signal: AbortSignal,
    ) => Promise<VoiceToken>,
  ) {}
  enter(channel: string): Promise<void> {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    const run = this.pending.then(async () => {
      if (request.signal.aborted) return;
      await this.room.disconnect();
      if (request.signal.aborted) return;
      try {
        const credentials = await this.token(channel, request.signal);
        if (request.signal.aborted) return;
        await this.room.connect(credentials.url, credentials.token);
        if (request.signal.aborted) {
          await this.room.disconnect();
          return;
        }
        // Every room starts with capture disabled, including room switches.
        await this.room.localParticipant.setMicrophoneEnabled(false);
      } catch (error) {
        await this.room.disconnect();
        if (!request.signal.aborted) throw error;
      }
    });
    this.pending = run.catch(() => {});
    return run;
  }
  leave(): Promise<void> {
    this.request?.abort();
    const run = this.pending.then(() => this.room.disconnect());
    this.pending = run.catch(() => {});
    return run;
  }
}
