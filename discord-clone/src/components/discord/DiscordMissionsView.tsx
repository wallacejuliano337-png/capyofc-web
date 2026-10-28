import React, { useState } from 'react';
import { Bell, Check, Trophy, Target, Gift, Swords, ShieldCheck } from 'lucide-react';
import { getAssetUrl } from '../../utils/assets';

export const DiscordMissionsView: React.FC = () => {
  const [isNotified, setIsNotified] = useState(false);

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#1e1f22] select-none min-w-0 overflow-y-auto py-16 px-6">
      <div className="max-w-xl w-full flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Glowing Missions Target Emblem */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#23a55a]/30 via-[#34d399]/30 to-[#10b981]/30 rounded-3xl blur-2xl opacity-75 animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#23a55a] via-[#34d399] to-[#10b981] p-0.5 shadow-2xl">
            <div className="w-full h-full bg-[#18191c]/90 rounded-[14px] flex items-center justify-center backdrop-blur-md p-3">
              <img
                src={getAssetUrl('assets/missão.png')}
                alt="Missões & Recompensas"
                className="w-12 h-12 object-contain drop-shadow-[0_0_12px_rgba(35,165,90,0.8)] hover:scale-105 transition-transform"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (!target.dataset.tried) {
                    target.dataset.tried = 'true';
                    target.src = getAssetUrl('assets/missao.png');
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Em Breve Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#23a55a]/10 border border-[#23a55a]/30 text-[#23a55a] text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#23a55a] animate-ping" />
          <span>Em breve</span>
        </div>

        {/* Título Principal & Subtítulo */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Missões & Recompensas
          </h1>
          <p className="text-sm sm:text-base text-[#dbdee1] max-w-md mx-auto leading-relaxed font-medium">
            Estamos a preparar desafios incríveis e recompensas exclusivas para ti. Fica atento às novidades!
          </p>
        </div>

        {/* Sneak Peek Preview Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full pt-2 text-left">
          <div className="p-4 rounded-xl bg-[#2b2d31]/60 border border-[#35373c]/70 hover:border-[#23a55a]/40 transition-colors backdrop-blur-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#23a55a]/15 flex items-center justify-center text-[#23a55a]">
              <Target className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Desafios Comunitários</h3>
            <p className="text-xs text-[#949ba4] leading-relaxed">
              Complete metas jogando e interagindo nos canais com os teus amigos na Arena.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#2b2d31]/60 border border-[#35373c]/70 hover:border-[#23a55a]/40 transition-colors backdrop-blur-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#34d399]/15 flex items-center justify-center text-[#34d399]">
              <Trophy className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Conquistas & Badges</h3>
            <p className="text-xs text-[#949ba4] leading-relaxed">
              Suba de nível e desbloqueie insígnias lendárias para ostentar no seu perfil.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#2b2d31]/60 border border-[#35373c]/70 hover:border-[#23a55a]/40 transition-colors backdrop-blur-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/15 flex items-center justify-center text-[#f59e0b]">
              <Gift className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Recompensas Exclusivas</h3>
            <p className="text-xs text-[#949ba4] leading-relaxed">
              Resgate cosméticos especiais, meses de Ultra Pass e decorações de edição limitada.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#2b2d31]/60 border border-[#35373c]/70 hover:border-[#23a55a]/40 transition-colors backdrop-blur-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#5865f2]/15 flex items-center justify-center text-[#5865f2]">
              <Swords className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Torneios da Arena</h3>
            <p className="text-xs text-[#949ba4] leading-relaxed">
              Participe de competições sazonais organizadas pela comunidade com premiações.
            </p>
          </div>
        </div>

        {/* Botão de Notificação Interativo */}
        <div className="pt-2">
          <button
            onClick={() => setIsNotified(!isNotified)}
            className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:scale-[1.02] active:scale-[0.98] ${
              isNotified
                ? 'bg-[#23a55a] text-white hover:bg-[#1f934f] shadow-[#23a55a]/25'
                : 'bg-gradient-to-r from-[#23a55a] to-[#10b981] text-white hover:brightness-110 shadow-[#23a55a]/25'
            }`}
          >
            {isNotified ? (
              <>
                <Check className="w-4 h-4" />
                <span>Notificação Ativada!</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                <span>Avisar-me quando disponível</span>
              </>
            )}
          </button>
        </div>

        {/* Rodapé Informativo */}
        <div className="flex items-center gap-1.5 text-xs text-[#80848e] pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#23a55a]" />
          <span>Desafios e recompensas integrados à comunidade CapyChat Oficial</span>
        </div>
      </div>
    </div>
  );
};
