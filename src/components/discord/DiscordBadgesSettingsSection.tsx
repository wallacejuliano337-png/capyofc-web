import React, { useState } from 'react';
import { useDiscord } from '../../store/discordStore';
import {
  CAPY_BADGES,
  CapyBadge,
  getUserUnlockedBadgeIds,
  getDisplayedBadgeIds,
} from '../../types/badges';
import { CapyBadgeIcon } from './CapyBadgeIcon';
import { DiscordBadgesGroup } from './DiscordBadgesGroup';
import { Award, RotateCcw, Check, Lock, Sparkles, ShieldCheck } from 'lucide-react';
import { getAvatarUrl, handleAvatarError } from '../../utils/avatar';

export const DiscordBadgesSettingsSection: React.FC = () => {
  const { currentUser, updateDisplayedBadges } = useDiscord();

  // Badges actually unlocked by this user (strictly determined by backend data/role)
  const unlockedIds = getUserUnlockedBadgeIds(currentUser);

  // Badges the user chose to display
  const currentPreferences = currentUser.displayedBadges || unlockedIds;
  const [selectedIds, setSelectedIds] = useState<string[]>(
    getDisplayedBadgeIds(unlockedIds, currentPreferences)
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isUnlocked = (badgeId: string) => unlockedIds.includes(badgeId);
  const isDisplayed = (badgeId: string) => selectedIds.includes(badgeId);

  const toggleBadge = (badgeId: string) => {
    // Security check: cannot toggle a badge that is not unlocked
    if (!isUnlocked(badgeId)) return;

    let updated: string[];
    if (selectedIds.includes(badgeId)) {
      updated = selectedIds.filter((id) => id !== badgeId);
    } else {
      updated = [...selectedIds, badgeId];
    }
    setSelectedIds(updated);
    updateDisplayedBadges(updated);
    showSavedFeedback();
  };

  const handleResetToDefault = () => {
    setSelectedIds(unlockedIds);
    updateDisplayedBadges(unlockedIds);
    showSavedFeedback();
  };

  const showSavedFeedback = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const displayedList = getDisplayedBadgeIds(unlockedIds, selectedIds);

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-8 text-[#dbdee1]">
      {/* Title & Description */}
      <div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#5865f2]/20 text-[#5865f2] flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">
                Insígnias de Perfil
              </h3>
              <p className="text-xs text-[#949ba4] mt-0.5">
                Escolha quais conquistas e distintivos oficiais do CapyChat exibir publicamente em seu perfil.
              </p>
            </div>
          </div>

          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer border border-[#3f4147]"
            title="Restaurar todas as insígnias desbloqueadas para exibição"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#949ba4]" />
            <span>Restaurar Padrão</span>
          </button>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="bg-[#111214] rounded-xl p-4 border border-[#2b2d31] shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#f1c40f]" /> Prévia do Seu Perfil Público
          </span>
          {saveSuccess && (
            <span className="text-xs text-[#23a55a] font-semibold flex items-center gap-1 animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Preferências salvas
            </span>
          )}
        </div>

        <div className="bg-[#1e1f22] rounded-lg p-3.5 border border-[#2b2d31]/80 flex items-center gap-3.5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img
              src={getAvatarUrl(currentUser.avatar)}
              alt={currentUser.displayName || currentUser.name}
              onError={handleAvatarError}
              className="w-12 h-12 rounded-full object-cover bg-[#2b2d31] ring-2 ring-[#5865f2]/40"
            />
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#1e1f22] bg-[#23a55a]" />
          </div>

          {/* User info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm truncate">
                {currentUser.displayName || currentUser.name}
              </span>
              <span className="text-xs text-[#949ba4]">@{currentUser.name}</span>
            </div>
            <p className="text-[11px] text-[#949ba4] truncate mt-0.5">
              {currentUser.customStatus || 'Online no CapyChat Oficial'}
            </p>
          </div>

          {/* Badges Container Preview */}
          <div className="flex-shrink-0">
            {displayedList.length > 0 ? (
              <DiscordBadgesGroup badgeIds={displayedList} size={16} />
            ) : (
              <span className="text-[10px] text-[#80848e] italic px-2">
                Nenhuma insígnia exibida
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Badges List Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#949ba4] px-1">
          Distintivos Disponíveis
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CAPY_BADGES.map((badge: CapyBadge) => {
            const unlocked = isUnlocked(badge.id);
            const displayed = isDisplayed(badge.id);

            return (
              <div
                key={badge.id}
                className={`p-3.5 rounded-lg border transition-all flex items-start gap-3.5 ${
                  unlocked
                    ? 'bg-[#2b2d31] border-[#383a40] hover:border-[#4e5058]'
                    : 'bg-[#18191c]/60 border-[#232428] opacity-60'
                }`}
              >
                {/* Badge Icon Display */}
                <div className="mt-0.5 p-2 rounded-lg bg-[#111214] border border-[#2b2d31] flex-shrink-0">
                  <CapyBadgeIcon
                    badgeId={badge.id}
                    size={24}
                    isLocked={!unlocked}
                    showTooltip={false}
                  />
                </div>

                {/* Badge Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm text-white leading-tight">
                      {badge.name}
                    </span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        backgroundColor: `${badge.color}20`,
                        color: badge.color,
                        border: `1px solid ${badge.color}40`,
                      }}
                    >
                      {badge.categoryLabel}
                    </span>
                  </div>

                  <p className="text-xs text-[#949ba4] leading-relaxed mb-2.5">
                    {badge.description}
                  </p>

                  {/* Unlock Requirement / Info */}
                  <div className="mb-2.5 px-2.5 py-1.5 rounded bg-[#111214]/70 border border-[#232428] text-[11px] text-[#80848e] leading-snug">
                    <span className="font-semibold text-[#b5bac1]">Como desbloquear: </span>
                    {badge.unlockRequirement}
                  </div>

                  {/* Status & Control */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#35373c]/50">
                    {unlocked ? (
                      <>
                        <span className="text-[11px] font-medium text-[#23a55a] flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Desbloqueada
                        </span>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <span className="text-[11px] text-[#dbdee1] font-medium">
                            {displayed ? 'Exibindo' : 'Oculta'}
                          </span>
                          <input
                            type="checkbox"
                            checked={displayed}
                            onChange={() => toggleBadge(badge.id)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-[#4e5058] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#23a55a] relative cursor-pointer" />
                        </label>
                      </>
                    ) : (
                      <span className="text-[11px] text-[#80848e] flex items-center gap-1 font-medium">
                        <Lock className="w-3 h-3 text-[#80848e]" /> Bloqueada para esta conta
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
