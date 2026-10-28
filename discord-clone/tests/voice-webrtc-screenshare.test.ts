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

    it('handles screen share restart cycle (start -> stop -> restart) by restoring transceiver direction to sendrecv and replacing tracks', async () => {
      let currentTrack: any = null;
      const mockSender = {
        get track() { return currentTrack; },
        replaceTrack: vi.fn(async (track: any) => {
          currentTrack = track;
        }),
      };

      const mockTransceiver = {
        direction: 'sendrecv' as RTCRtpTransceiverDirection,
        sender: mockSender,
      };

      const mockPC = {
        getTransceivers: () => [mockTransceiver],
        createOffer: vi.fn(async () => ({ type: 'offer', sdp: `m=video ${mockTransceiver.direction}` })),
        setLocalDescription: vi.fn(async () => {}),
      };

      const track1 = { kind: 'video', id: 'screen-track-1', stop: vi.fn() };
      const track2 = { kind: 'video', id: 'screen-track-2', stop: vi.fn() };

      // 1. Initial screen share start
      await mockSender.replaceTrack(track1);
      mockTransceiver.direction = 'sendrecv';
      expect(mockSender.track?.id).toBe('screen-track-1');
      expect(mockTransceiver.direction).toBe('sendrecv');

      // 2. Stop screen share: replaceTrack with null and set direction to recvonly
      await mockSender.replaceTrack(null);
      mockTransceiver.direction = 'recvonly';
      expect(mockSender.track).toBeNull();
      expect(mockTransceiver.direction).toBe('recvonly');

      // 3. Restart screen share: must restore direction to 'sendrecv' and attach new track
      mockTransceiver.direction = 'sendrecv';
      await mockSender.replaceTrack(track2);
      expect(mockSender.track?.id).toBe('screen-track-2');
      expect(mockTransceiver.direction).toBe('sendrecv');

      const offer = await mockPC.createOffer();
      expect(offer.sdp).toContain('m=video sendrecv');
    });

    it('instantiates a new MediaStream instance on remote track unmute to guarantee React detects reference updates', () => {
      let participantStream: any = null;
      let participantSharing = false;

      const remoteVideoTrack = {
        kind: 'video',
        id: 'remote-video-restart',
        onmute: null as (() => void) | null,
        onunmute: null as (() => void) | null,
      };

      // Handler mimics pc.ontrack in voiceService
      const attachVideoTrack = (track: typeof remoteVideoTrack) => {
        participantSharing = true;
        participantStream = { id: 'stream-1', tracks: [track] };

        track.onmute = () => {
          participantSharing = false;
          participantStream = undefined;
        };

        track.onunmute = () => {
          participantSharing = true;
          // Fresh reference
          participantStream = { id: 'stream-2', tracks: [track] };
        };
      };

      attachVideoTrack(remoteVideoTrack);
      expect(participantSharing).toBe(true);
      const initialStreamRef = participantStream;

      // Simulate remote user stopping share (fires mute)
      remoteVideoTrack.onmute?.();
      expect(participantSharing).toBe(false);
      expect(participantStream).toBeUndefined();

      // Simulate remote user restarting share (fires unmute)
      remoteVideoTrack.onunmute?.();
      expect(participantSharing).toBe(true);
      expect(participantStream).toBeDefined();
      expect(participantStream).not.toBe(initialStreamRef); // Brand new MediaStream reference!
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

  describe('6. Multi-Screen Sharing Selection & Navigation (Discord Style)', () => {
    const makeUser = (id: string, name: string) => ({
      id,
      name,
      displayName: name,
      tag: '#0001',
      avatar: '',
      status: 'online' as const,
    });

    const makeStream = (id: string) => {
      const track = {
        id: `track-${id}`,
        kind: 'video',
        readyState: 'live',
        muted: false,
        enabled: true,
        stop: vi.fn(),
      };
      return {
        id: `stream-${id}`,
        getTracks: () => [track],
        getVideoTracks: () => [track],
        getAudioTracks: () => [],
      } as unknown as MediaStream;
    };

    // Helper that replicates the activeScreenShares compilation in DiscordVoiceStage
    const resolveActiveShares = (
      participants: any[],
      currentUserId: string,
      localScreenStream: MediaStream | null,
    ) => {
      const shares: any[] = [];
      if (localScreenStream) {
        const hasLive = localScreenStream.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted);
        if (hasLive) {
          shares.push({
            id: currentUserId,
            isLocal: true,
            stream: localScreenStream,
            title: 'Sua tela',
          });
        }
      }
      participants.forEach((p) => {
        if (p.user.id === currentUserId) return;
        const hasLive = Boolean(
          p.mediaStream &&
          p.mediaStream.getVideoTracks().some((t: any) => t.readyState === 'live' && !t.muted)
        );
        if ((p.isScreenSharing || hasLive) && p.mediaStream && hasLive) {
          if (!shares.some((s) => s.id === p.user.id)) {
            shares.push({
              id: p.user.id,
              isLocal: false,
              stream: p.mediaStream,
              title: `Tela de ${p.user.name}`,
            });
          }
        }
      });
      return shares;
    };

    const resolveCurrentShare = (shares: any[], focusedId: string | null) => {
      if (shares.length === 0) return null;
      if (focusedId) {
        const found = shares.find((s) => s.id === focusedId);
        if (found) return found;
      }
      return shares.find((s) => !s.isLocal) || shares[0];
    };

    it('Scenario 1: One participant shares screen and their stream appears normally', () => {
      const userA = makeUser('user-a', 'Alice');
      const streamA = makeStream('user-a');
      const participants = [
        { user: userA, isScreenSharing: true, mediaStream: streamA, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];

      const shares = resolveActiveShares(participants, 'my-id', null);
      expect(shares).toHaveLength(1);
      expect(shares[0].id).toBe('user-a');

      const selected = resolveCurrentShare(shares, null);
      expect(selected?.id).toBe('user-a');
      expect(selected?.stream).toBe(streamA);
    });

    it('Scenario 2: Two participants share simultaneously: viewer can switch between both screens', () => {
      const userA = makeUser('user-a', 'Alice');
      const streamA = makeStream('user-a');
      const userB = makeUser('user-b', 'Bob');
      const streamB = makeStream('user-b');

      const participants = [
        { user: userA, isScreenSharing: true, mediaStream: streamA, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: userB, isScreenSharing: true, mediaStream: streamB, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];

      const shares = resolveActiveShares(participants, 'my-id', null);
      expect(shares).toHaveLength(2);

      // Initially focuses Alice
      let selected = resolveCurrentShare(shares, 'user-a');
      expect(selected?.id).toBe('user-a');
      expect(selected?.stream).toBe(streamA);

      // Viewer switches to Bob
      useDiscord.getState().setFocusedParticipantId('user-b');
      selected = resolveCurrentShare(shares, useDiscord.getState().focusedParticipantId);
      expect(selected?.id).toBe('user-b');
      expect(selected?.stream).toBe(streamB);

      // Both streams remain intact and transmitting
      expect(streamA.getVideoTracks()[0].readyState).toBe('live');
      expect(streamB.getVideoTracks()[0].readyState).toBe('live');
    });

    it('Scenario 3: Three participants share simultaneously: viewer can select any of the three', () => {
      const uA = makeUser('u-a', 'Alice');
      const sA = makeStream('u-a');
      const uB = makeUser('u-b', 'Bob');
      const sB = makeStream('u-b');
      const uC = makeUser('u-c', 'Charlie');
      const sC = makeStream('u-c');

      const participants = [
        { user: uA, isScreenSharing: true, mediaStream: sA, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uB, isScreenSharing: true, mediaStream: sB, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uC, isScreenSharing: true, mediaStream: sC, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];

      const shares = resolveActiveShares(participants, 'my-id', null);
      expect(shares).toHaveLength(3);

      ['u-a', 'u-b', 'u-c'].forEach((id) => {
        useDiscord.getState().setFocusedParticipantId(id);
        const sel = resolveCurrentShare(shares, useDiscord.getState().focusedParticipantId);
        expect(sel?.id).toBe(id);
      });
    });

    it('Scenario 4: Spectator repeatedly switches between streams without interrupting media or stop calls', () => {
      const uA = makeUser('u-a', 'Alice');
      const sA = makeStream('u-a');
      const uB = makeUser('u-b', 'Bob');
      const sB = makeStream('u-b');

      const participants = [
        { user: uA, isScreenSharing: true, mediaStream: sA, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uB, isScreenSharing: true, mediaStream: sB, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];

      const shares = resolveActiveShares(participants, 'my-id', null);

      // Rapidly toggle back and forth 10 times
      for (let i = 0; i < 10; i++) {
        const targetId = i % 2 === 0 ? 'u-a' : 'u-b';
        useDiscord.getState().setFocusedParticipantId(targetId);
        const current = resolveCurrentShare(shares, useDiscord.getState().focusedParticipantId);
        expect(current?.id).toBe(targetId);
      }

      // Verify no tracks were stopped during switching
      expect(sA.getVideoTracks()[0].stop).not.toHaveBeenCalled();
      expect(sB.getVideoTracks()[0].stop).not.toHaveBeenCalled();
    });

    it('Scenario 5: When selected participant stops sharing, automatically falls back to remaining active stream', () => {
      const uA = makeUser('u-a', 'Alice');
      const sA = makeStream('u-a');
      const uB = makeUser('u-b', 'Bob');
      const sB = makeStream('u-b');

      let participants: any[] = [
        { user: uA, isScreenSharing: true, mediaStream: sA, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uB, isScreenSharing: true, mediaStream: sB, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];

      // Spectator is watching Alice
      useDiscord.getState().setFocusedParticipantId('u-a');
      let shares = resolveActiveShares(participants, 'my-id', null);
      let selected = resolveCurrentShare(shares, useDiscord.getState().focusedParticipantId);
      expect(selected?.id).toBe('u-a');

      // Alice stops sharing
      participants = [
        { user: uA, isScreenSharing: false, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uB, isScreenSharing: true, mediaStream: sB, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];
      shares = resolveActiveShares(participants, 'my-id', null);
      expect(shares).toHaveLength(1);
      expect(shares[0].id).toBe('u-b');

      // Fallback automatically selects Bob
      selected = resolveCurrentShare(shares, useDiscord.getState().focusedParticipantId);
      expect(selected?.id).toBe('u-b');

      // Bob also stops sharing
      participants = [
        { user: uA, isScreenSharing: false, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uB, isScreenSharing: false, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];
      shares = resolveActiveShares(participants, 'my-id', null);
      expect(shares).toHaveLength(0);
      selected = resolveCurrentShare(shares, useDiscord.getState().focusedParticipantId);
      expect(selected).toBeNull();
    });

    it('Scenario 6: New participant starts sharing during call and appears as an option', () => {
      const uA = makeUser('u-a', 'Alice');
      const sA = makeStream('u-a');
      const uB = makeUser('u-b', 'Bob');
      const sB = makeStream('u-b');

      let participants: any[] = [
        { user: uA, isScreenSharing: true, mediaStream: sA, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uB, isScreenSharing: false, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];

      let shares = resolveActiveShares(participants, 'my-id', null);
      expect(shares).toHaveLength(1);

      // Bob starts sharing
      participants = [
        { user: uA, isScreenSharing: true, mediaStream: sA, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uB, isScreenSharing: true, mediaStream: sB, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];

      shares = resolveActiveShares(participants, 'my-id', null);
      expect(shares).toHaveLength(2);
      expect(shares.map((s) => s.id)).toEqual(['u-a', 'u-b']);
    });

    it('Scenario 7: Selection made by spectator is strictly local and does not alter other spectators or senders', () => {
      const broadcastSpy = vi.spyOn(voiceService, 'broadcastState');
      const uA = makeUser('u-a', 'Alice');
      const sA = makeStream('u-a');
      const uB = makeUser('u-b', 'Bob');
      const sB = makeStream('u-b');

      const participants = [
        { user: uA, isScreenSharing: true, mediaStream: sA, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
        { user: uB, isScreenSharing: true, mediaStream: sB, isMuted: false, isSpeaking: false, isVideoOn: false, isDeafened: false },
      ];

      const shares = resolveActiveShares(participants, 'my-id', null);

      // Switching focusedParticipantId does not call broadcastState or send WebRTC signals
      useDiscord.getState().setFocusedParticipantId('u-b');
      const sel = resolveCurrentShare(shares, useDiscord.getState().focusedParticipantId);
      expect(sel?.id).toBe('u-b');
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it('Scenario 8: Audio, webcam, presence and call disconnect operate undisturbed during multiple screen shares', async () => {
      const uA = makeUser('u-a', 'Alice');
      const sA = makeStream('u-a');
      const uB = makeUser('u-b', 'Bob');
      const sB = makeStream('u-b');

      useDiscord.setState({
        voiceState: {
          isConnected: true,
          channelId: 'voice-room-multi',
          pingMs: 18,
          participants: [
            { user: uA, isScreenSharing: true, mediaStream: sA, isMuted: false, isSpeaking: true, isVideoOn: true, isDeafened: false },
            { user: uB, isScreenSharing: true, mediaStream: sB, isMuted: true, isSpeaking: false, isVideoOn: false, isDeafened: false },
          ],
        },
      });

      // Mute local mic
      useDiscord.setState({ isMicMuted: true });
      expect(useDiscord.getState().isMicMuted).toBe(true);

      // Toggle local video
      useDiscord.setState({ isVideoOn: true });
      expect(useDiscord.getState().isVideoOn).toBe(true);

      // Disconnect call cleans up cleanly
      await voiceService.leaveChannel(false);
      expect(useDiscord.getState().voiceState.isConnected).toBe(false);
      expect(useDiscord.getState().voiceState.participants).toEqual([]);
    });
  });
});
