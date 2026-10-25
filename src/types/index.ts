export type Role =
  "OWNER" | "ADMIN" | "MODERATOR" | "STAFF" | "CAPTAIN" | "PLAYER" | "MEMBER";
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  banner_url?: string | null;
  bio?: string;
  profile_primary_color?: string;
  profile_secondary_color?: string;
  profile_accent_color?: string;
  status: string;
  role: Role;
  created_at: string;
}
export interface Channel {
  community_id?: string;
  category_id?: string;
  position?: number;
  deleted_at?: string | null;
  id: string;
  name: string;
  category: string;
  kind: "text" | "voice";
  description: string;
  team_id: string | null;
  is_private?: boolean;
  sync_permissions?: boolean;
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  content_type: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at?: string | null;
  reply_to: string | null;
  attachments?: MessageAttachment[];
  profiles?: Profile;
  message_reactions?: Reaction[];
  webhook_id?: string | null;
  webhook_name?: string | null;
  webhook_avatar_url?: string | null;
}
export interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
}
export interface Team {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  captain_id: string;
  created_at: string;
}
export interface TeamMember {
  team_id: string;
  user_id: string;
  slot: string;
  profiles?: Profile;
}
export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  status: "ABERTO" | "EM_ATENDIMENTO" | "FECHADO";
  assigned_to: string | null;
  created_at: string;
}
export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}
export interface Source {
  id: string;
  name: string;
  thumbnail: string;
}
export interface NotificationPayload {
  type: "channel" | "dm" | "call" | "mention" | "channel_message";
  channelId?: string;
  communityId?: string;
  conversationId?: string;
  peerId?: string;
}

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateInfoPayload {
  state: UpdateState;
  currentVersion: string;
  availableVersion?: string;
  progressPercent?: number;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      getScreenSources: () => Promise<Source[]>;
    };
    arena?: {
      window: (action: "minimize" | "maximize" | "close") => Promise<void>;
      sources: () => Promise<Source[]>;
      selectSource: (id: string, audio: boolean) => Promise<void>;
      notify: (
        title: string,
        body: string,
        payload?: NotificationPayload,
      ) => Promise<void>;
      onNotificationClick?: (
        callback: (payload: NotificationPayload) => void,
      ) => () => void;
      setBadgeCount?: (count: number) => Promise<void>;
      getNotificationsMuted?: () => Promise<boolean>;
      setNotificationsMuted?: (muted: boolean) => Promise<void>;
      onTrayMuteToggle?: (callback: (muted: boolean) => void) => () => void;
      getVersion?: () => Promise<string>;
      getUpdateStatus?: () => Promise<UpdateInfoPayload>;
      checkForUpdates?: () => Promise<UpdateInfoPayload>;
      installUpdate?: () => Promise<boolean>;
      onUpdateStatus?: (
        callback: (status: UpdateInfoPayload) => void,
      ) => () => void;
      onVoiceToggleMute?: (callback: () => void) => () => void;
      onVoicePtt?: (callback: () => void) => () => void;
      onVoiceDisconnect?: (callback: () => void) => () => void;
      openUpdateModal?: () => Promise<boolean>;
      onShowUpdateModal?: (callback: () => void) => () => void;
    };
  }
}
