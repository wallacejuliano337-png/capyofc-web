import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getVoiceAudioConstraints, useVoiceStreamStore } from '../src/store/voiceStreamStore';
import { tuneOpusSdp } from '../src/services/voiceService';

describe('Capy.ofc — Qualidade de Áudio & Pipeline WebRTC Estilo Discord', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    vi.stubGlobal('localStorage', storageMock);
    vi.stubGlobal('window', { localStorage: storageMock });
  });

  describe('1. Restrições de Áudio (getVoiceAudioConstraints)', () => {
    it('gera restrições ideais para o perfil padrão (voice-isolation) a 48kHz mono', () => {
      localStorage.setItem('lyc_audio_profile', 'voice-isolation');
      localStorage.setItem('lyc_selected_input_device', 'test-mic-uuid');

      const constraints = getVoiceAudioConstraints() as any;

      expect(constraints.sampleRate).toEqual({ ideal: 48000 });
      expect(constraints.channelCount).toEqual({ ideal: 1 });
      expect(constraints.echoCancellation).toBe(true);
      expect(constraints.noiseSuppression).toBe(true);
      expect(constraints.autoGainControl).toBe(true);
      expect(constraints.googHighpassFilter).toBe(true);
      expect(constraints.googTypingNoiseDetection).toBe(true);
      expect(constraints.googAudioMirroring).toBe(false);
      expect(constraints.deviceId).toEqual({ ideal: 'test-mic-uuid' });
    });

    it('no perfil "studio" desativa supressão agressiva para microfone puro e aberto', () => {
      localStorage.setItem('lyc_audio_profile', 'studio');

      const constraints = getVoiceAudioConstraints() as any;

      expect(constraints.sampleRate).toEqual({ ideal: 48000 });
      expect(constraints.channelCount).toEqual({ ideal: 1 });
      expect(constraints.echoCancellation).toBe(false);
      expect(constraints.noiseSuppression).toBe(false);
      expect(constraints.autoGainControl).toBe(false);
      expect(constraints.googHighpassFilter).toBe(true);
    });

    it('no perfil "custom" respeita flags individuais salvas no localStorage', () => {
      localStorage.setItem('lyc_audio_profile', 'custom');
      localStorage.setItem('lyc_echo_cancellation', 'false');
      localStorage.setItem('lyc_auto_gain', 'true');
      localStorage.setItem('lyc_noise_suppression', 'none');

      const constraints = getVoiceAudioConstraints() as any;

      expect(constraints.echoCancellation).toBe(false);
      expect(constraints.noiseSuppression).toBe(false);
      expect(constraints.autoGainControl).toBe(true);
    });

    it('overrideDeviceId tem precedência sobre o dispositivo salvo no localStorage', () => {
      localStorage.setItem('lyc_selected_input_device', 'saved-device');

      const constraints = getVoiceAudioConstraints('override-device') as any;
      expect(constraints.deviceId).toEqual({ ideal: 'override-device' });
    });
  });

  describe('2. Calibração SDP Opus (tuneOpusSdp)', () => {
    const sampleSdpWithFmtp = [
      'v=0',
      'o=- 123456 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'a=rtpmap:111 opus/48000/2',
      'a=fmtp:111 minptime=10;useinbandfec=1',
      'a=mid:0',
    ].join('\r\n');

    const sampleSdpWithoutFmtp = [
      'v=0',
      'o=- 123456 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'a=rtpmap:111 opus/48000/2',
      'a=mid:0',
    ].join('\r\n');

    it('injeta 64 kbps, FEC, DTX e mono dedicado em SDP que já possui fmtp', () => {
      const tuned = tuneOpusSdp(sampleSdpWithFmtp, 64000);

      expect(tuned).toContain('maxaveragebitrate=64000');
      expect(tuned).toContain('useinbandfec=1');
      expect(tuned).toContain('usedtx=1');
      expect(tuned).toContain('stereo=0');
      expect(tuned).toContain('sprop-stereo=0');
      expect(tuned).toContain('cbr=0');
      expect(tuned).toContain('minptime=10');

      // Sem parâmetros duplicados
      const fmtpLine = tuned.split('\r\n').find((l) => l.startsWith('a=fmtp:111'));
      expect(fmtpLine).toBeDefined();
      const occurrences = (fmtpLine?.match(/maxaveragebitrate/g) || []).length;
      expect(occurrences).toBe(1);
    });

    it('insere a=fmtp após a=rtpmap quando o SDP original não contém fmtp', () => {
      const tuned = tuneOpusSdp(sampleSdpWithoutFmtp, 64000);

      expect(tuned).toContain('a=fmtp:111');
      expect(tuned).toContain('maxaveragebitrate=64000');
      expect(tuned).toContain('useinbandfec=1');
      expect(tuned).toContain('usedtx=1');
    });

    it('retorna o SDP original inalterado se não houver payload Opus', () => {
      const noOpusSdp = 'm=audio 9 UDP/TLS/RTP/SAVPF 0\r\na=rtpmap:0 PCMU/8000\r\n';
      const tuned = tuneOpusSdp(noOpusSdp);
      expect(tuned).toBe(noOpusSdp);
    });

    it('preserva quebras de linha LF ao calibrar SDP com formato Unix/LF', () => {
      const sdpLf = [
        'v=0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'a=rtpmap:111 opus/48000/2',
        'a=mid:0',
      ].join('\n');

      const tuned = tuneOpusSdp(sdpLf, 64000);
      expect(tuned).toContain('a=fmtp:111 maxaveragebitrate=64000');
      // Garante que não foram injetados \r\n misturados em arquivo LF
      expect(tuned.includes('\r')).toBe(false);
    });
  });

  describe('3. Live Application of Audio Constraints & Device Hot-Swap', () => {
    it('comuta dispositivo físico via getUserMedia preservando o estado de mudo', async () => {
      const oldStopMock = vi.fn();
      const oldTrack = {
        kind: 'audio',
        stop: oldStopMock,
        enabled: true,
        getSettings: () => ({ deviceId: 'old-mic-id' }),
      };
      const oldStream = {
        getAudioTracks: () => [oldTrack],
        getTracks: () => [oldTrack],
      } as unknown as MediaStream;

      const newTrack = {
        kind: 'audio',
        stop: vi.fn(),
        enabled: true,
        getSettings: () => ({ deviceId: 'new-mic-id' }),
      };
      const newStream = {
        getAudioTracks: () => [newTrack],
        getTracks: () => [newTrack],
      } as unknown as MediaStream;

      const getUserMediaMock = vi.fn().mockResolvedValue(newStream);
      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: getUserMediaMock,
        },
      });

      useVoiceStreamStore.setState({ micStream: oldStream });

      await useVoiceStreamStore.getState().applyAudioConstraints('new-mic-id');

      expect(getUserMediaMock).toHaveBeenCalled();
      expect(oldStopMock).toHaveBeenCalled();
      expect(useVoiceStreamStore.getState().micStream).toBe(newStream);
    });

    it('aplica filtros no mesmo dispositivo usando applyConstraints sem reiniciar o stream', async () => {
      const applyConstraintsMock = vi.fn().mockResolvedValue(undefined);
      const mockAudioTrack = {
        kind: 'audio',
        applyConstraints: applyConstraintsMock,
        enabled: true,
        getSettings: () => ({ deviceId: 'same-mic-id' }),
      };

      const mockStream = {
        getAudioTracks: () => [mockAudioTrack],
      } as unknown as MediaStream;

      localStorage.setItem('lyc_selected_input_device', 'same-mic-id');
      useVoiceStreamStore.setState({ micStream: mockStream });

      await useVoiceStreamStore.getState().applyAudioConstraints();

      expect(applyConstraintsMock).toHaveBeenCalled();
      const calledConstraints = applyConstraintsMock.mock.calls[0][0];
      // deviceId é omitido no applyConstraints in-place para prevenir OverconstrainedError
      expect(calledConstraints.deviceId).toBeUndefined();
      expect(calledConstraints.sampleRate).toEqual({ ideal: 48000 });
    });
  });
});
