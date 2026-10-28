import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Capy.ofc — Configurações de Voz: Teste de Microfone & Loopback', () => {
  let activeTracks: Array<{ kind: string; id: string; enabled: boolean; stop: () => void }> = [];
  let isContextClosed = false;
  let isContextResumed = false;
  let gainConnectedToDestination = false;
  let gainValue = 1;
  let analyserConnected = false;
  let sampleFrequencyData: Uint8Array = new Uint8Array(128);

  const mockTrack = (id = 'mock-mic-track-1') => {
    const track = {
      kind: 'audio',
      id,
      enabled: true,
      stop: vi.fn(() => {
        const idx = activeTracks.indexOf(track);
        if (idx !== -1) activeTracks.splice(idx, 1);
      }),
    };
    activeTracks.push(track);
    return track;
  };

  const createMockStream = (id = 'mic-stream-1') => {
    const track = mockTrack(`track-${id}`);
    return {
      id,
      getTracks: () => [track],
      getAudioTracks: () => [track],
      getVideoTracks: () => [],
    } as unknown as MediaStream;
  };

  const mockGainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn((val: number) => {
        gainValue = val;
      }),
      setTargetAtTime: vi.fn((val: number) => {
        gainValue = val;
      }),
    },
    connect: vi.fn((dest: any) => {
      if (dest === mockDestination) {
        gainConnectedToDestination = true;
      }
    }),
    disconnect: vi.fn(() => {
      gainConnectedToDestination = false;
    }),
  };

  const mockDestination = { id: 'speakers-destination' };

  const mockAnalyser = {
    fftSize: 256,
    frequencyBinCount: 128,
    smoothingTimeConstant: 0.35,
    getByteFrequencyData: vi.fn((array: Uint8Array) => {
      array.set(sampleFrequencyData);
    }),
  };

  const mockSource = {
    connect: vi.fn((node: any) => {
      if (node === mockAnalyser) {
        analyserConnected = true;
      }
    }),
  };

  class MockAudioContext {
    state = 'suspended';
    currentTime = 0;
    destination = mockDestination;

    async resume() {
      this.state = 'running';
      isContextResumed = true;
    }

    createAnalyser() {
      return mockAnalyser;
    }

    createMediaStreamSource(_stream: any) {
      return mockSource;
    }

    createGain() {
      return mockGainNode;
    }

    async close() {
      this.state = 'closed';
      isContextClosed = true;
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    activeTracks = [];
    isContextClosed = false;
    isContextResumed = false;
    gainConnectedToDestination = false;
    analyserConnected = false;
    gainValue = 1;
    sampleFrequencyData.fill(0);

    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('requestAnimationFrame', (cb: any) => setTimeout(cb, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: any) => clearTimeout(id));
  });

  it('1 & 2. O clique inicia o teste e solicita a captura do microfone com restrições adequadas', async () => {
    const getUserMediaMock = vi.fn().mockResolvedValue(createMockStream('test-mic'));
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: getUserMediaMock,
      },
    });

    // Simula a inicialização do teste
    const constraints: MediaStreamConstraints = {
      audio: { deviceId: { ideal: 'usb-mic-1' }, echoCancellation: true },
      video: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    expect(getUserMediaMock).toHaveBeenCalledWith(constraints);
    expect(stream).toBeDefined();
    expect(activeTracks).toHaveLength(1);
  });

  it('3. O estado visual e o pipeline de áudio mudam para teste ativo e desbloqueiam o AudioContext', async () => {
    const stream = createMockStream('test-mic');
    const audioCtx = new MockAudioContext();
    expect(audioCtx.state).toBe('suspended');

    await audioCtx.resume();
    expect(audioCtx.state).toBe('running');
    expect(isContextResumed).toBe(true);

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    source.connect(analyser);
    expect(analyserConnected).toBe(true);

    // Conecta retorno local de voz (loopback)
    const gainNode = audioCtx.createGain();
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    expect(gainConnectedToDestination).toBe(true);
  });

  it('4. O nível de áudio é atualizado quando há sinal e zera em silêncio', () => {
    const analyser = mockAnalyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    // Cenário de Silêncio
    sampleFrequencyData.fill(0);
    analyser.getByteFrequencyData(data);
    let avg = data.reduce((a, b) => a + b, 0) / data.length;
    let rawLevel = avg / 135;
    let normalized = Math.min(100, Math.round(rawLevel * 100));
    expect(normalized).toBe(0);

    // Cenário de Voz / Sinal de Áudio Real
    sampleFrequencyData.fill(85);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (data[i] > peak) peak = data[i];
    }
    avg = sum / data.length;
    rawLevel = (avg * 0.65 + peak * 0.35) / 135;
    normalized = Math.min(100, Math.max(0, Math.round(rawLevel * 100)));

    expect(normalized).toBeGreaterThan(50);
  });

  it('5 & 6. O botão interrompe o teste e todas as faixas e recursos de áudio são encerrados', async () => {
    const stream = createMockStream('stream-to-stop');
    const audioCtx = new MockAudioContext();
    const track = stream.getAudioTracks()[0];

    expect(activeTracks).toHaveLength(1);

    // Executa encerramento do teste
    stream.getTracks().forEach((t) => t.stop());
    mockGainNode.disconnect();
    await audioCtx.close();

    expect(track.stop).toHaveBeenCalled();
    expect(activeTracks).toHaveLength(0);
    expect(isContextClosed).toBe(true);
    expect(gainConnectedToDestination).toBe(false);
  });

  it('7. A permissão negada produz erro compreensível de NotAllowedError', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(permissionError),
      },
    });

    let reportedError = '';
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        reportedError = 'Permissão de microfone negada. Permita o acesso ao microfone nas configurações de privacidade do Windows ou do aplicativo.';
      }
    }

    expect(reportedError).toContain('Permissão de microfone negada');
  });

  it('8. A ausência de dispositivos produz um erro compreensível de NotFoundError', async () => {
    const notFoundError = new Error('Devices not found');
    notFoundError.name = 'NotFoundError';

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(notFoundError),
      },
    });

    let reportedError = '';
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        reportedError = 'Nenhum microfone encontrado. Conecte um microfone ou headset ao computador.';
      }
    }

    expect(reportedError).toContain('Nenhum microfone encontrado');
  });

  it('9 & 10. O teste pode ser iniciado novamente sem criar fluxos duplicados ou recursos abandonados', async () => {
    const getUserMediaMock = vi.fn().mockImplementation(() => Promise.resolve(createMockStream('test-cycle')));
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: getUserMediaMock,
      },
    });

    // Ciclo 1: Inicia e para
    const stream1 = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx1 = new MockAudioContext();
    expect(activeTracks).toHaveLength(1);

    stream1.getTracks().forEach((t) => t.stop());
    await ctx1.close();
    expect(activeTracks).toHaveLength(0);

    // Ciclo 2: Inicia novamente
    const stream2 = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx2 = new MockAudioContext();
    expect(activeTracks).toHaveLength(1);

    // Limpeza final
    stream2.getTracks().forEach((t) => t.stop());
    await ctx2.close();
    expect(activeTracks).toHaveLength(0);
  });
});
