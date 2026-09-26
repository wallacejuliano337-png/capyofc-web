/** An isolated level meter: never publishes or plays the captured audio. */
export class MicrophoneMeter {
  private generation = 0;
  private stream?: MediaStream;
  private context?: AudioContext;
  private frame = 0;
  stop() {
    this.generation++;
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
  async start(deviceId: string, onLevel: (level: number) => void) {
    this.stop();
    const generation = this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId === "default" ? true : { deviceId: { exact: deviceId } },
      video: false,
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.stream = stream;
    try {
      const context = new AudioContext();
      this.context = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      await context.resume();
      if (generation !== this.generation) return false;
      const samples = new Float32Array(analyser.fftSize);
      const tick = () => {
        if (generation !== this.generation) return;
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, n) => sum + n * n, 0) / samples.length,
        );
        onLevel(Math.min(100, rms * 400));
        this.frame = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
  }
}
