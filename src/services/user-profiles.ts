import type { Profile } from "../types";
import { db } from "../lib/supabase";
const complete = (p?: Profile): p is Profile =>
  !!p &&
  [
    "banner_url",
    "bio",
    "profile_primary_color",
    "profile_secondary_color",
    "profile_accent_color",
    "created_at",
    "username",
  ].every((key) => Object.hasOwn(p, key));
export class UserProfileCache {
  private entries = new Map<string, { profile: Profile; time: number }>();
  private pending = new Map<string, Promise<Profile>>();
  constructor(
    private fetchProfile = async (id: string): Promise<Profile> => {
      const { data, error } = await db()
        .from("profiles")
        .select(
          "id,username,display_name,avatar_url,banner_url,bio,profile_primary_color,profile_secondary_color,profile_accent_color,created_at",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  ) {}
  async get(id: string, seed?: Profile) {
    const cached = this.entries.get(id);
    if (cached && Date.now() - cached.time < 120000) return cached.profile;
    if (!cached && seed?.id === id && complete(seed)) {
      this.entries.set(id, { profile: seed, time: Date.now() });
      return seed;
    }
    const pending = this.pending.get(id);
    if (pending) return pending;
    const request = this.fetchProfile(id)
      .then((profile) => {
        if (profile.id !== id) throw new Error("Perfil indisponível.");
        this.entries.set(id, { profile, time: Date.now() });
        return profile;
      })
      .finally(() => this.pending.delete(id));
    this.pending.set(id, request);
    return request;
  }
}
export function profilePopoverPosition(
  anchor: { left: number; right: number; top: number },
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const gap = 10,
    edge = 12;
  const right = anchor.right + gap;
  const left =
    right + width <= viewportWidth - edge ? right : anchor.left - width - gap;
  return {
    left: Math.max(edge, Math.min(left, viewportWidth - width - edge)),
    top: Math.max(edge, Math.min(anchor.top, viewportHeight - height - edge)),
  };
}
