import React, { useState } from 'react';
import { Bell, Check, Sparkles, Palette, ShieldCheck, Gem, Flame } from 'lucide-react';

export const DiscordShopView: React.FC = () => {
  const [isNotified, setIsNotified] = useState(false);

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#1e1f22] select-none min-w-0 overflow-y-auto py-16 px-6">
      <div className="max-w-xl w-full flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Glowing Shop Emblem */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#00a8fc]/30 via-[#38bdf8]/30 to-[#5865f2]/30 rounded-3xl blur-2xl opacity-75 animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#00a8fc] via-[#38bdf8] to-[#5865f2] p-0.5 shadow-2xl">
            <div className="w-full h-full bg-[#18191c]/90 rounded-[14px] flex items-center justify-center backdrop-blur-md">
              <img
                src="/loja.svg"
                alt="Loja CapyChat"
                className="w-11 h-11 object-contain drop-shadow-[0_0_12px_rgba(0,168,252,0.7)]"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.fallback) {
                    target.dataset.fallback = '1';
                    target.src = '/brand/03_UI_Icons_SVG/icon_loja.svg';
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Em Breve Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00a8fc]/10 border border-[#00a8fc]/30 text-[#00a8fc] text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#00a8fc] animate-ping" />
          <span>Em breve</span>
        </div>

        {/* Título Principal */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Loja CapyChat
          </h1>
          <p className="text-sm sm:text-base text-[#dbdee1] max-w-md mx-auto leading-relaxed font-medium">
            Estamos a preparar uma vitrine incrível com itens cosméticos e decorações exclusivas para ti. Fica atento!
          </p>
        </div>

        {/* Sneak Peek Preview Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full pt-2 text-left">
          <div className="p-4 rounded-xl bg-[#2b2d31]/60 border border-[#35373c]/70 hover:border-[#00a8fc]/40 transition-colors backdrop-blur-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#00a8fc]/15 flex items-center justify-center text-[#00a8fc]">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Decorações de Avatar</h3>
            <p className="text-xs text-[#949ba4] leading-relaxed">
              Molduras animadas, efeitos holográficos e temas colecionáveis para seu perfil.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#2b2d31]/60 border border-[#35373c]/70 hover:border-[#00a8fc]/40 transition-colors backdrop-blur-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#f47fff]/15 flex items-center justify-center text-[#f47fff]">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Efeitos de Perfil</h3>
            <p className="text-xs text-[#949ba4] leading-relaxed">
              Animações envolventes que reagem ao passar o cursor pelo seu card de membro.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#2b2d31]/60 border border-[#35373c]/70 hover:border-[#00a8fc]/40 transition-colors backdrop-blur-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#23a55a]/15 flex items-center justify-center text-[#23a55a]">
              <Palette className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Banners Exclusivos</h3>
            <p className="text-xs text-[#949ba4] leading-relaxed">
              Estilos artísticos de alta resolução produzidos especialmente para a comunidade LYC.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#2b2d31]/60 border border-[#35373c]/70 hover:border-[#00a8fc]/40 transition-colors backdrop-blur-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/15 flex items-center justify-center text-[#f59e0b]">
              <Gem className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Itens de Temporada</h3>
            <p className="text-xs text-[#949ba4] leading-relaxed">
              Edições limitadas desbloqueáveis em eventos comemorativos e torneios da arena.
            </p>
          </div>
        </div>

        {/* Botão de Notificação Interativo */}
        <div className="pt-2">
          <button
            onClick={() => setIsNotified(!isNotified)}
            className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
              isNotified
                ? 'bg-[#23a55a] text-white hover:bg-[#1f934f] shadow-[#23a55a]/25'
                : 'bg-gradient-to-r from-[#00a8fc] to-[#5865f2] text-white hover:brightness-110 shadow-[#00a8fc]/25 hover:scale-[1.02]'
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
                <span>Avisar-me na inauguração</span>
              </>
            )}
          </button>
        </div>

        {/* Rodapé Informativo */}
        <div className="flex items-center gap-1.5 text-xs text-[#80848e] pt-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Itens cosméticos exclusivos para membros da comunidade CapyChat Oficial</span>
        </div>
      </div>
    </div>
  );
};
