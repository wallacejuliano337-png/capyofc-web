// LYC Arena — Notification Sounds Service (Web Audio Synthesizer)
// Provides low-latency, zero-asset notification chimes and call ringtones

class NotificationSoundService {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: ReturnType<typeof setInterval> | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a pleasant dual-tone message chime
   */
  public playMessageChime(volume = 0.35): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Audio playback error or autoplay policy
    }
  }

  /**
   * Plays an elevated alert chime for mentions (@username / @everyone)
   */
  public playMentionChime(volume = 0.45): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Primary tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(783.99, now); // G5
      osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.14); // D6

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(volume, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Harmony tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(987.77, now + 0.06); // B5
      gain2.gain.setValueAtTime(0, now + 0.06);
      gain2.gain.linearRampToValueAtTime(volume * 0.7, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.38);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.4);
    } catch {
      // Audio playback error
    }
  }

  /**
   * Starts a repeating incoming call ringtone pulse
   */
  public startIncomingCallRingtone(volume = 0.5): void {
    if (this.ringtoneInterval) return;

    const playRingtonePulse = () => {
      const ctx = this.getContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const freqs = [659.25, 830.61, 987.77]; // E5, G#5, B5 chord
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);

          gain.gain.setValueAtTime(0, now + idx * 0.07);
          gain.gain.linearRampToValueAtTime(volume * 0.6, now + idx * 0.07 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.5);
        });
      } catch {
        // Audio error
      }
    };

    playRingtonePulse();
    this.ringtoneInterval = setInterval(playRingtonePulse, 2400);
  }

  /**
   * Stops the incoming call ringtone pulse
   */
  public stopIncomingCallRingtone(): void {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  /**
   * Plays Discord-authentic mute toggle sound
   */
  public playMuteChime(muted: boolean, volume = 0.3): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";

      if (muted) {
        // Descending mute tone (440 -> 330 Hz)
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(330, now + 0.08);
      } else {
        // Ascending unmute tone (330 -> 440 Hz)
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(440, now + 0.08);
      }

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Audio error ignored
    }
  }

  /**
   * Plays Discord-authentic deafen toggle sound
   */
  public playDeafenChime(deafened: boolean, volume = 0.35): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";

      if (deafened) {
        // Descending deafen tone (523 -> 392 Hz)
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(392, now + 0.09);
      } else {
        // Ascending undeafen tone (392 -> 523 Hz)
        osc.frequency.setValueAtTime(392, now);
        osc.frequency.setValueAtTime(523.25, now + 0.09);
      }

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Audio error ignored
    }
  }
}

export const notificationSounds = new NotificationSoundService();

export function playNotificationSound(
  type: "message" | "mention" | "call" | "mute" | "unmute" | "deafen" | "undeafen",
): void {
  if (type === "message") {
    notificationSounds.playMessageChime();
  } else if (type === "mention") {
    notificationSounds.playMentionChime();
  } else if (type === "call") {
    notificationSounds.startIncomingCallRingtone();
    setTimeout(() => notificationSounds.stopIncomingCallRingtone(), 2500);
  } else if (type === "mute") {
    notificationSounds.playMuteChime(true);
  } else if (type === "unmute") {
    notificationSounds.playMuteChime(false);
  } else if (type === "deafen") {
    notificationSounds.playDeafenChime(true);
  } else if (type === "undeafen") {
    notificationSounds.playDeafenChime(false);
  }
}
