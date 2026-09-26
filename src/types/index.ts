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
}
export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  reply_to: string | null;
  profiles?: Profile;
  message_reactions?: Reaction[];
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
declare global {
  interface Window {
    arena?: {
      window: (action: "minimize" | "maximize" | "close") => Promise<void>;
      sources: () => Promise<Source[]>;
      selectSource: (id: string, audio: boolean) => Promise<void>;
      notify: (title: string, body: string) => Promise<void>;
    };
  }
}
