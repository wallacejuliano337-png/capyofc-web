import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Profile } from "../../types";
import { ProfileCard } from "./ProfileCard";
import { profileAppearance } from "../../services/profile";
import {
  UserProfileCache,
  profilePopoverPosition,
} from "../../services/user-profiles";
import "./user-profile-popover.css";
export type OpenUserProfile = (
  id: string,
  anchor: HTMLElement,
  profile?: Profile,
) => void;
export interface UserProfileSelection {
  id: string;
  anchor: HTMLElement;
  profile?: Profile;
}
export function UserProfilePopover({
  selection,
  viewer,
  presence,
  cache,
  onClose,
  onEdit,
}: {
  selection: UserProfileSelection;
  viewer: Profile;
  presence: string;
  cache: UserProfileCache;
  onClose: () => void;
  onEdit: () => void;
}) {
  const own = selection.id === viewer.id;
  const [profile, setProfile] = useState<Profile | undefined>(
    own
      ? viewer
      : selection.profile?.id === selection.id
        ? selection.profile
        : undefined,
  );
  const [error, setError] = useState("");
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    if (own) {
      setProfile(viewer);
      return;
    }
    void cache
      .get(selection.id, selection.profile)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {
        if (active)
          setError("Não foi possível carregar este perfil. Tente novamente.");
      });
    return () => {
      active = false;
    };
  }, [selection.id, selection.profile, cache, own, viewer]);
  useLayoutEffect(() => {
    const update = () => {
      const node = element.current;
      if (!node) return;
      if (!selection.anchor.isConnected) {
        onClose();
        return;
      }
      const position = profilePopoverPosition(
        selection.anchor.getBoundingClientRect(),
        node.offsetWidth,
        node.offsetHeight,
        innerWidth,
        innerHeight,
      );
      node.style.left = position.left + "px";
      node.style.top = position.top + "px";
    };
    update();
    const observer = new ResizeObserver(update);
    if (element.current) observer.observe(element.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selection.anchor, onClose]);
  useEffect(() => {
    element.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (
        !element.current?.contains(target) &&
        !target.closest("[data-profile-trigger]")
      )
        onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        selection.anchor.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [selection.anchor, onClose]);
  return createPortal(
    <div
      ref={element}
      className="user-profile-popover"
      role="dialog"
      aria-label="Perfil do usuário"
      tabIndex={-1}
    >
      {profile ? (
        <ProfileCard
          profile={profile}
          appearance={profileAppearance(profile)}
          presence={presence === "invisible" ? "offline" : presence}
        />
      ) : (
        <p className="user-profile-feedback">Carregando perfil…</p>
      )}
      {error && (
        <p role="alert" className="user-profile-feedback">
          {error}
        </p>
      )}
      {own && (
        <button
          className="user-profile-edit"
          onClick={() => {
            onClose();
            onEdit();
          }}
        >
          Editar perfil
        </button>
      )}
    </div>,
    document.body,
  );
}
