import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types/discord';
import { Volume2, VolumeX, User as UserIcon, AtSign, Headphones, ShieldAlert, Check } from 'lucide-react';

interface DiscordVoiceUserContextMenuProps {
  user: User;
  position: { x: number; y: number };
  onClose: () => void;
  onOpenProfile: (user: User) => void;
  onMentionUser?: (user: User) => void;
}

export const DiscordVoiceUserContextMenu: React.FC<DiscordVoiceUserContextMenuProps> = ({
  user,
  position,
  onClose,
  onOpenProfile,
  onMentionUser,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [userVolume, setUserVolume] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`lyc_voice_vol_${user.id}`);
      if (saved) return parseInt(saved, 10);
    }
    return 100;
  });
  const [isMutedForMe, setIsMutedForMe] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`lyc_voice_mute_${user.id}`) === 'true';
    }
    return false;
  });
  const [isDeafenedForMe, setIsDeafenedForMe] = useState(false);

  // Close on outside click or ESC
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleVolumeChange = (newVol: number) => {
    setUserVolume(newVol);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`lyc_voice_vol_${user.id}`, newVol.toString());
    }
  };

  const toggleMute = () => {
    const next = !isMutedForMe;
    setIsMutedForMe(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`lyc_voice_mute_${user.id}`, next ? 'true' : 'false');
    }
  };

  // Adjust position so it doesn't overflow viewport
  const left = Math.min(position.x, window.innerWidth - 230);
  const top = Math.min(position.y, window.innerHeight - 280);

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-56 bg-[#111214] border border-[#232428] rounded-md shadow-2xl p-1.5 text-xs text-[#dbdee1] select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header Info */}
      <div className="px-2 py-1.5 border-b border-[#232428] mb-1 flex items-center gap-2">
        <img
          src={user.avatar}
          alt={user.name}
          className="w-6 h-6 rounded-full object-cover"
        />
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-white truncate text-xs">
            {user.displayName || user.name}
          </span>
          <span className="text-[10px] text-[#949ba4]">@{user.name}</span>
        </div>
      </div>

      {/* Volume Slider 0% a 200% */}
      <div className="px-2 py-2 border-b border-[#232428] space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-[#949ba4] uppercase tracking-wider text-[10px] font-bold">
            Volume do Usuário
          </span>
          <span className="text-white font-mono">{userVolume}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-[#949ba4]" />
          <input
            type="range"
            min={0}
            max={200}
            step={5}
            value={userVolume}
            onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
            className="w-full accent-[#5865f2] h-1.5 bg-[#2b2d31] rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Quick Action Items */}
      <div className="py-1 space-y-0.5">
        <button
          onClick={toggleMute}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4" />
            <span>Mutar para mim</span>
          </div>
          {isMutedForMe && <Check className="w-3.5 h-3.5 text-[#23a55a]" />}
        </button>

        <button
          onClick={() => setIsDeafenedForMe(!isDeafenedForMe)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4" />
            <span>Ensurdecer localmente</span>
          </div>
          {isDeafenedForMe && <Check className="w-3.5 h-3.5 text-[#23a55a]" />}
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenProfile(user);
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
        >
          <UserIcon className="w-4 h-4" />
          <span>Ver Perfil</span>
        </button>

        {onMentionUser && (
          <button
            onClick={() => {
              onClose();
              onMentionUser(user);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
          >
            <AtSign className="w-4 h-4" />
            <span>Mencionar</span>
          </button>
        )}
      </div>
    </div>
  );
};
