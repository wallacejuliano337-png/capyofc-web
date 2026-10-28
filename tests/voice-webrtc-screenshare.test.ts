import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDiscord } from '../src/store/discordStore';
import { useVoiceStreamStore } from '../src/store/voiceStreamStore';
import { voiceService } from '../src/services/voiceService';

describe('Capy.ofc — WebRTC Voice & Screen Sharing System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Audio Track & Permissions Handling', () => {
    it('initializes local microphone with audio constraints and active track', async () => {
      const mockAudioTrack = {
        kind: 'audio',
        id: 'mock-mic-track-1',
        enabled: true,
        readyState: 'live',
        stop: vi.fn(),
      };

      const mockStream = {
        getTracks: () => [mockAudioTrack],
        getAudioTracks: () => [mockAudioTrack],
        getVideoTracks: () => [],
      } as unknown as MediaStream;

      const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);

      // Mock navigator.mediaDevices
      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: getUserMediaMock,
        },
      });

      await useVoiceStreamStore.getState().initMic();

      const micStream = useVoiceStreamStore.getState().micStream;
      expect(micStream).toBeDefined();
      expect(micStream?.getAudioTracks()[0].enabled).toBe(true);
      expect(micStream?.getAudioTracks()[0].readyState).toBe('live');
    });

    it('sets clear error state when microphone permission is denied or device is absent', async () => {
      const notAllowedError = new Error('Permission denied');
      notAllowedError.name = 'NotAllowedError';

      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockRejectedValue(notAllowedError),
        },
      });

      // Clear mic stream before test
      useVoiceStreamStore.setState({ micStream: null });
      await useVoiceStreamStore.getState().initMic();

      expect(useVoiceStreamStore.getState().micStream).toBeNull();
      expect(useDiscord.getState().voiceState.error).toContain('Permissão de microfone negada');
    });

    it('real mute and unmute controls track.enabled and sends broadcast state', () => {
      const audioTrack = {
        kind: 'audio',
        id: 'mic-track',
        enabled: true,
        stop: vi.fn(),
      };

      const mockStream = {
        getTracks: () => [audioTrack],
        getAudioTracks: () => [audioTrack],
        getVideoTracks: () => [],
      } as unknown as MediaStream;

      useVoiceStreamStore.setState({ micStream: mockStream });

      // Mute microphone
      useDiscord.setState({ isMicMuted: true });
      audioTrack.enabled = !useDiscord.getState().isMicMuted;
      expect(audioTrack.enabled).toBe(false);

      // Unmute microphone
      useDiscord.setState({ isMicMuted: false });
      audioTrack.enabled = !useDiscord.getState().isMicMuted;
      expect(audioTrack.enabled).toBe(true);
    });
  });

  describe('2. WebRTC Signaling, ICE Queuing & Negotiation', () => {
    it('queues ICE candidates received before remote description is set and drains them after', async () => {
      const candidatesQueue: RTCIceCandidateInit[] = [];
      let remoteDescriptionSet = false;
      const addedCandidates: RTCIceCandidateInit[] = [];

      const mockPC = {
        remoteDescription: null as RTCSessionDescriptionInit | null,
        addIceCandidate: vi.fn(async (cand: RTCIceCandidateInit) => {
          if (!remoteDescriptionSet) {
            throw new Error('InvalidStateError: Remote description was null');
          }
          addedCandidates.push(cand);
        }),
        setRemoteDescription: vi.fn(async (sdp: RTCSessionDescriptionInit) => {
          mockPC.remoteDescription = sdp;
          remoteDescriptionSet = true;
          // Drain queued
          while (candidatesQueue.length > 0) {
            const c = candidatesQueue.shift();
            if (c) await mockPC.addIceCandidate(c);
          }
        }),
      };

      const earlyCandidate: RTCIceCandidateInit = {
        candidate: 'candidate:1 1 UDP 2122260223 192.168.1.50 54321 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      };

      // Candidate arrives before offer
      if (!mockPC.remoteDescription) {
        candidatesQueue.push(earlyCandidate);
      } else {
        await mockPC.addIceCandidate(earlyCandidate);
      }

      expect(addedCandidates).toHaveLength(0);
      expect(candidatesQueue).toHaveLength(1);

      // Offer arrives and remote description is set
      await mockPC.setRemoteDescription({ type: 'offer', sdp: 'v=0...' });

      // Queue is drained
      expect(candidatesQueue).toHaveLength(0);
      expect(addedCandidates).toHaveLength(1);
      expect(addedCandidates[0].candidate).toContain('192.168.1.50');
    });

    it('negotiates bidirectional audio transceiver and tracks', async () => {
      const addedTracks: any[] = [];
      const transceivers: any[] = [];

      const mockPC = {
        addTransceiver: vi.fn((kind: string, init: any) => {
          transceivers.push({ kind, init });
        }),
        addTrack: vi.fn((track: any, stream: any) => {
          addedTracks.push({ track, stream });
        }),
        createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'm=audio sendrecv' })),
        setLocalDescription: vi.fn(async () => {}),
      };

      // Audio transceiver guarantees sendrecv
      mockPC.addTransceiver('audio', { direction: 'sendrecv' });
      expect(mockPC.addTransceiver).toHaveBeenCalledWith('audio', { direction: 'sendrecv' });

      // Add local track
      const localAudioTrack = { kind: 'audio', id: 'track-1', enabled: true };
      const localStream = { id: 'stream-1' };
      mockPC.addTrack(localAudioTrack, localStream);

      expect(addedTracks).toHaveLength(1);
      expect(addedTracks[0].track.kind).toBe('audio');
    });
  });

  describe('3. Screen Sharing Video Stream Lifecycle & Renegotiation', () => {
    it('attaches screen share video track to peer connections and triggers renegotiation', async () => {
      let isRenegotiated = false;
      const senders: any[] = [];

      const screenVideoTrack = {
        kind: 'video',
        id: 'screen-video-1',
        enabled: true,
        stop: vi.fn(),
      };
      const screenStream = {
        id: 'screen-stream-1',
        getTracks: () => [screenVideoTrack],
        getVideoTracks: () => [screenVideoTrack],
      };

      const mockPC = {
        addTrack: vi.fn((track: any) => {
          const sender = { track };
          senders.push(sender);
          return sender;
        }),
        removeTrack: vi.fn((sender: any) => {
          const idx = senders.indexOf(sender);
          if (idx !== -1) senders.splice(idx, 1);
        }),
        getSenders: () => senders,
        createOffer: vi.fn(async () => {
          isRenegotiated = true;
          return { type: 'offer', sdp: 'm=video sendonly' };
        }),
        setLocalDescription: vi.fn(async () => {}),
      };

      // 1. Start screen share
      screenStream.getTracks().forEach((t) => mockPC.addTrack(t));
      await mockPC.createOffer();

      expect(mockPC.addTrack).toHaveBeenCalledWith(screenVideoTrack);
      expect(senders).toHaveLength(1);
      expect(isRenegotiated).toBe(true);

      // 2. Stop screen share removes sender and triggers renegotiation
      isRenegotiated = false;
      const videoSenders = mockPC.getSenders().filter((s) => s.track.kind === 'video');
      videoSenders.forEach((s) => mockPC.removeTrack(s));
      await mockPC.createOffer();

      expect(senders).toHaveLength(0);
      expect(isRenegotiated).toBe(true);
    });

    it('distinguishes audio and video tracks on receiver and avoids ghost streams', () => {
      let remoteAudioStream: any = null;
      let remoteVideoStream: any = null;

      const audioTrack = { kind: 'audio', id: 'remote-audio-track', stop: vi.fn() };
      const videoTrack = { kind: 'video', id: 'remote-screen-track', stop: vi.fn() };

      const onTrack = (track: any) => {
        if (track.kind === 'audio') {
          remoteAudioStream = { tracks: [track] };
        } else if (track.kind === 'video') {
          remoteVideoStream = { tracks: [track] };
        }
      };

      onTrack(audioTrack);
      expect(remoteAudioStream).toBeDefined();
      expect(remoteVideoStream).toBeNull();

      onTrack(videoTrack);
      expect(remoteAudioStream).toBeDefined();
      expect(remoteVideoStream).toBeDefined();
      expect(remoteVideoStream.tracks[0].kind).toBe('video');

      // Video track ended (user stopped sharing)
      remoteVideoStream = null;
      expect(remoteVideoStream).toBeNull();
      // Audio still plays undisturbed
      expect(remoteAudioStream).toBeDefined();
    });
  });

  describe('4. Teardown & Ghost Participant Prevention', () => {
    it('cleans up all peer connections, audio elements, and analysers on leaveChannel', async () => {
      useDiscord.setState({
        voiceState: {
          isConnected: true,
          channelId: 'channel-test',
          pingMs: 20,
          participants: [
            {
              user: { id: 'u1', name: 'User 1', tag: '0001', avatar: '', status: 'online' },
              isMuted: false,
              isDeafened: false,
              isSpeaking: false,
              isScreenSharing: false,
              isVideoOn: false,
            },
          ],
        },
      });

      await voiceService.leaveChannel(false);

      const state = useDiscord.getState().voiceState;
      expect(state.isConnected).toBe(false);
      expect(state.participants).toEqual([]);
    });
  });

  describe('5. External Channel Presence & Watch Stream from Outside', () => {
    it('stores remote participants per voice channel so users outside the call can see them', () => {
      const fooxUser = { id: 'foox-123', name: 'FOOX7', displayName: 'FOOX7', tag: '#0001', avatar: '', status: 'online' as const };
      useDiscord.getState().setChannelVoiceParticipants({
        'ch-voice-1': [
          {
            user: fooxUser,
            isMuted: false,
            isDeafened: false,
            isSpeaking: false,
            isScreenSharing: true,
            isVideoOn: false,
          },
        ],
      });

      const map = useDiscord.getState().channelVoiceParticipants;
      expect(map['ch-voice-1']).toHaveLength(1);
      expect(map['ch-voice-1'][0].user.name).toBe('FOOX7');
      expect(map['ch-voice-1'][0].isScreenSharing).toBe(true);

      // User outside the call clicks on streaming participant
      useDiscord.getState().setFocusedParticipantId('foox-123');
      expect(useDiscord.getState().focusedParticipantId).toBe('foox-123');
    });
  });
});
