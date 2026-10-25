import React from 'react';
import { useDiscord } from '../../store/discordStore';
import { resolveServerTagBadge, resolveServerTagColor, resolveServerTagBadgeIcon } from '../../types/discord';
import { getAvatarUrl } from '../../utils/avatar';
import { getUserUnlockedBadgeIds, getDisplayedBadgeIds } from '../../types/badges';
import { CapyBadgeIcon } from './CapyBadgeIcon';
import {
  Gamepad2,
  Tv,
  Headphones,
  Calendar,
  Sparkles,
  Shield,
  Award,
} from 'lucide-react';

export const DiscordMemberProfilePopout: React.FC = () => {
  const { selectedMemberForPopout, popoutPosition, closeMemberPopout, setActiveChannel, activeServerId, servers } =
    useDiscord();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMemberPopout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMemberPopout]);

  if (!selectedMemberForPopout) return null;

  const user = selectedMemberForPopout;

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0];
  const isDm = activeServerId === '@me';
  const tagColor = !isDm && currentServer?.serverTag ? resolveServerTagColor(currentServer.serverTagColor) : null;
  const tagBadgeIcon = !isDm && currentServer?.serverTag ? resolveServerTagBadgeIcon(currentServer.serverTagBadge, currentServer.serverTagBadgeImage) : null;
  const tagBadgeChar = !isDm && currentServer?.serverTag ? resolveServerTagBadge(currentServer.serverTagBadge) : '💎';

  const topPos = Math.min(popoutPosition?.top || 100, window.innerHeight - 440);
  const rightPos = popoutPosition?.right || 260;

  return (
    <>
      {/* Invisible Backdrop to close on click outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={closeMemberPopout}
      />

      {/* Popout Card Container */}
      <div
        style={{ top: `${topPos}px`, right: `${rightPos}px` }}
        className="fixed w-80 bg-[#111214] rounded-2xl shadow-2xl overflow-hidden border border-[#232428] z-50 animate-in fade-in zoom-in-95 duration-150 select-none text-left"
      >
        {/* Banner Top */}
        <div
          className="h-20 w-full relative"
          style={{ backgroundColor: user.bannerColor || '#5865f2' }}
        >
          {user.bannerImage && (
            <img
              src={user.bannerImage}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Profile Info Body */}
        <div className="px-4 pb-4 bg-[#232428] relative">
          {/* Avatar with status overlap */}
          <div className="relative -top-10 mb-[-32px] flex justify-between items-end">
            <div className="relative">
              <img
                src={getAvatarUrl(user.avatar)}
                alt={user.name}
                className="w-20 h-20 rounded-full border-[6px] border-[#232428] object-cover bg-[#111214]"
              />
              {user.status === 'idle' ? (
                <img
                  src="/brand/04_Recortes_PNG_Alta_Resolucao/Mascotes_Expressoes/06_Dormindo.png"
                  alt="Ausente"
                  title="Ausente (Dormindo)"
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-[2px] border-[#232428] bg-[#1F1F26] object-cover shadow"
                />
              ) : (
                <span
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] border-[#232428] ${
                    user.status === 'online'
                      ? 'bg-[#23a55a]'
                      : user.status === 'dnd'
                      ? 'bg-[#f23f43]'
                      : 'bg-[#80848e]'
                  }`}
                />
              )}
            </div>

            {/* Badges Container */}
            {(() => {
              const displayedBadgeIds = getDisplayedBadgeIds(
                getUserUnlockedBadgeIds(user),
                user.displayedBadges
              );
              if (displayedBadgeIds.length === 0 && !user.isBot) return null;
              return (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#111214]/85 rounded-full border border-[#35373c]/40 mb-2 shadow-xs">
                  {displayedBadgeIds.map((id) => (
                    <CapyBadgeIcon key={id} badgeId={id} size={15} showTooltip />
                  ))}
                  {user.isBot && (
                    <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 rounded">
                      BOT
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Name & Tag */}
          <div className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg text-white leading-tight">
                {user.displayName || user.name}
              </h3>
              {!isDm && currentServer?.serverTag && tagColor && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-black px-2 py-0.5 rounded shadow-sm select-none leading-none"
                  title={`Tag do servidor: ${currentServer.serverTag}`}
                  style={{
                    backgroundColor: `${tagColor.hex}25`,
                    color: tagColor.hex,
                    border: `1px solid ${tagColor.hex}50`,
                  }}
                >
                  {tagBadgeIcon && (
                    <img
                      src={tagBadgeIcon}
                      alt="Tag"
                      className="w-4 h-4 object-contain rounded-sm flex-shrink-0"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  )}
                  <span className="leading-none">{currentServer.serverTag}</span>
                </span>
              )}
            </div>
            <span className="text-xs text-[#949ba4]">@{user.name}</span>
          </div>

          {/* Custom Status */}
          {user.customStatus && (
            <div className="mt-2 text-xs text-[#dbdee1] border-b border-[#35363c] pb-2">
              {user.customStatus}
            </div>
          )}

          {/* About Me Section */}
          {user.aboutMe && (
            <div className="mt-3">
              <h4 className="text-[11px] font-bold uppercase text-[#949ba4] tracking-wider mb-1">
                Sobre Mim
              </h4>
              <p className="text-xs text-[#dbdee1] leading-relaxed">
                {user.aboutMe}
              </p>
            </div>
          )}

          {/* Activity Section */}
          {user.activity && (
            <div className="mt-3 p-2.5 bg-[#111214] rounded-lg border border-[#35363c]/40">
              <h4 className="text-[10px] font-bold uppercase text-[#949ba4] tracking-wider mb-1.5 flex items-center gap-1">
                {user.activity.type === 'PLAYING' && <Gamepad2 className="w-3.5 h-3.5" />}
                {user.activity.type === 'STREAMING' && (
                  <Tv className="w-3.5 h-3.5 text-[#5865f2]" />
                )}
                {user.activity.type === 'LISTENING' && (
                  <Headphones className="w-3.5 h-3.5 text-[#23a55a]" />
                )}
                <span>
                  {user.activity.type === 'PLAYING'
                    ? 'Jogando um jogo'
                    : user.activity.type === 'STREAMING'
                    ? 'Transmitindo'
                    : 'Ouvindo'}
                </span>
              </h4>

              <div className="flex flex-col text-xs">
                <span className="font-semibold text-white">
                  {user.activity.name}
                </span>
                {user.activity.details && (
                  <span className="text-[#949ba4] text-[11px]">
                    {user.activity.details}
                  </span>
                )}
                {user.activity.state && (
                  <span className="text-[#949ba4] text-[11px]">
                    {user.activity.state}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Member Since Date */}
          <div className="mt-3 pt-2 border-t border-[#35363c] flex items-center gap-1.5 text-xs text-[#949ba4]">
            <Calendar className="w-3.5 h-3.5" />
            <span>Membro desde {user.joinedDate || '12 de Março de 2024'}</span>
          </div>

          {/* Quick Send Message Button */}
          <button
            onClick={() => {
              setActiveChannel(`dm-${user.id}`);
              closeMemberPopout();
            }}
            className="w-full mt-3 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Enviar Mensagem
          </button>
        </div>
      </div>
    </>
  );
};
