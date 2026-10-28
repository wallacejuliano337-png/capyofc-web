import React, { useState, useRef } from 'react';
import { getAssetUrl } from '../../utils/assets';
import {
  Crown,
  Gift,
  Upload,
  Smile,
  Sparkles,
  ShieldCheck,
  Video,
  Users,
  User,
  Gem,
} from 'lucide-react';

interface Props {
  isSettingsTab?: boolean;
}

export const DiscordUltraPassView: React.FC<Props> = ({ isSettingsTab = false }) => {
  // Billing cycle state for cards (visual toggle)
  const [basicPlan, setBasicPlan] = useState<'anual' | 'mensal'>('anual');
  const [proPlan, setProPlan] = useState<'anual' | 'mensal'>('anual');

  const plansRef = useRef<HTMLDivElement>(null);

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      className={`w-full flex-1 flex flex-col min-w-0 bg-[#070810] text-white select-none relative ${
        isSettingsTab ? 'min-h-full' : 'h-full overflow-y-auto scrollbar-thin'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.28) 0%, transparent 50%),
                          radial-gradient(circle at 20% 60%, rgba(79, 70, 229, 0.2) 0%, transparent 50%),
                          radial-gradient(circle at 75% 85%, rgba(236, 72, 153, 0.22) 0%, transparent 50%),
                          url('${getAssetUrl('assets/ultrapass/fundo.png')}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'local',
      }}
    >
      {/* 1. BLOCO SUPERIOR (HERO SECTION FULLSCREEN DE PONTA A PONTA) */}
      <section
        className={`relative w-full overflow-visible flex items-center justify-center ${
          isSettingsTab
            ? 'pt-8 pb-10 px-6 sm:px-8 pr-16 min-h-[380px]'
            : 'pt-8 pb-12 px-6 sm:px-12 lg:px-16 xl:px-20 min-h-[520px] lg:min-h-[580px]'
        }`}
      >
        {/* Subtle Ambient Cosmic Lighting */}
        <div className="absolute top-1/3 right-1/4 w-[480px] h-[480px] bg-[#8b5cf6]/20 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-1/2 right-12 w-[360px] h-[360px] bg-[#ec4899]/15 rounded-full blur-[110px] pointer-events-none" />

        <div
          className={`relative z-10 w-full items-center ${
            isSettingsTab
              ? 'flex flex-col sm:flex-row justify-between gap-6 sm:gap-8'
              : 'grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16'
          }`}
        >
          {/* LADO ESQUERDO: Título de Impacto & Ações */}
          <div
            className={`${
              isSettingsTab ? 'flex-1 min-w-0 max-w-[440px]' : 'lg:col-span-7'
            } flex flex-col items-start text-left ${
              isSettingsTab ? 'space-y-4' : 'space-y-6'
            }`}
          >
            {/* Selo ULTRA PASS com Coroa */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(250,204,21,0.25)]">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-[#facc15] fill-[#facc15] drop-shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
              <span className="text-xs sm:text-sm font-black tracking-widest uppercase bg-gradient-to-r from-[#fbbf24] via-[#f472b6] to-[#c084fc] bg-clip-text text-transparent">
                ULTRA PASS
              </span>
              <Sparkles className="w-3.5 h-3.5 text-[#f472b6]" />
            </div>

            {/* Título de Impacto */}
            <h1
              className={`${
                isSettingsTab
                  ? 'text-2xl sm:text-3xl lg:text-[34px] leading-[1.08]'
                  : 'text-4xl sm:text-5xl lg:text-[58px] leading-[1.04]'
              } font-black italic tracking-tight uppercase text-white drop-shadow-md`}
            >
              SUPERPODERES<br />
              PARA O SEU<br />
              <span className="bg-gradient-to-r from-[#f472b6] via-[#ec4899] to-[#d946ef] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(236,72,153,0.55)]">
                CAPYCHAT
              </span>
            </h1>

            {/* Subtítulo Descritivo */}
            <p
              className={`${
                isSettingsTab ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
              } text-[#dbdee1] font-normal leading-relaxed`}
            >
              Personalize seu perfil, compartilhe em alta qualidade e vá além com sua comunidade.
            </p>

            {/* Botões de Ação */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {/* Botão: Conhecer os planos */}
              <button
                onClick={scrollToPlans}
                className={`group flex items-center gap-2.5 ${
                  isSettingsTab ? 'px-5 py-2.5 text-sm' : 'px-7 py-3.5 text-base'
                } rounded-xl bg-gradient-to-r from-[#6366f1] via-[#7c3aed] to-[#9333ea] hover:brightness-110 active:scale-95 text-white font-bold shadow-[0_0_24px_rgba(124,58,237,0.5)] transition-all cursor-pointer`}
              >
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white transition-transform group-hover:scale-110" />
                <span>Conhecer os planos</span>
              </button>

              {/* Botão: Presentear Ultra Pass */}
              <button
                onClick={() => {}}
                className={`flex items-center gap-2 ${
                  isSettingsTab ? 'px-4 py-2.5 text-xs sm:text-sm' : 'px-6 py-3.5 text-base'
                } rounded-xl bg-[#141524]/80 hover:bg-[#1f2136] border border-white/15 hover:border-white/30 active:scale-95 text-white font-semibold backdrop-blur-md transition-all cursor-pointer shadow-lg`}
              >
                <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
                <span>Presentear Ultra Pass</span>
              </button>
            </div>
          </div>

          {/* LADO DIREITO: Arte da Capivara Super-heroína com Cristais e Raios */}
          <div
            className={`${
              isSettingsTab
                ? 'w-48 sm:w-56 md:w-64 flex-shrink-0'
                : 'lg:col-span-5'
            } relative flex items-center justify-center`}
          >
            {/* Halo de luz de fundo */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#7c3aed]/35 via-[#ec4899]/30 to-transparent rounded-full blur-3xl scale-95 pointer-events-none" />

            <div className="relative w-full flex items-center justify-center">
              <img
                src={getAssetUrl('assets/ultrapass/capy.png')}
                alt="Capivara Super-heroína Ultra Pass"
                className={`w-full h-auto ${
                  isSettingsTab ? 'max-h-[260px]' : ''
                } object-contain drop-shadow-[0_15px_45px_rgba(139,92,246,0.45)] select-none pointer-events-none transform transition-transform duration-700 hover:scale-[1.03]`}
              />

              {/* Cristal flutuante no topo esquerdo */}
              <div className="absolute -top-3 -left-3 w-10 h-10 sm:w-14 sm:h-14 pointer-events-none animate-bounce duration-[3000ms] hidden sm:block">
                <img
                  src={getAssetUrl('assets/ultrapass/cristal.png')}
                  alt=""
                  className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]"
                />
              </div>

              {/* Raios dourados na base direita */}
              <div className="absolute -bottom-2 right-2 w-10 h-10 sm:w-12 sm:h-12 pointer-events-none hidden sm:block">
                <img
                  src={getAssetUrl('assets/ultrapass/raios.png')}
                  alt=""
                  className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BLOCO INFERIOR (ESCOLHA SEU PLANO - LARGURA TOTAL COM CARDS ALINHADOS) */}
      <section
        ref={plansRef}
        id="planos-section"
        className={`relative w-full ${
          isSettingsTab
            ? 'pt-6 pb-16 px-4 sm:px-6'
            : 'pt-10 pb-24 px-6 sm:px-12 lg:px-16 xl:px-20'
        } flex flex-col items-center`}
      >
        {/* Cabeçalho da Seção de Planos */}
        <div
          className={`flex flex-col items-center text-center ${
            isSettingsTab ? 'mb-8' : 'mb-16'
          } relative z-10`}
        >
          <Crown className="w-8 h-8 sm:w-9 sm:h-9 text-[#facc15] fill-[#facc15] mb-2 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)]" />
          <h2
            className={`${
              isSettingsTab ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl lg:text-5xl'
            } font-black italic tracking-tight uppercase text-white drop-shadow-md`}
          >
            ESCOLHA SEU{' '}
            <span className="bg-gradient-to-r from-[#c084fc] via-[#d946ef] to-[#ec4899] bg-clip-text text-transparent">
              PLANO
            </span>
          </h2>
          <p
            className={`${
              isSettingsTab ? 'text-sm' : 'text-base sm:text-lg'
            } text-[#dbdee1] font-medium mt-1.5`}
          >
            Mais superpoderes para o seu CapyChat.
          </p>
        </div>

        {/* Grid dos Dois Cards de Planos (Largura Total sem restrições) */}
        <div
          className={`relative w-full grid grid-cols-1 ${
            isSettingsTab ? 'sm:grid-cols-2 gap-4 sm:gap-5' : 'md:grid-cols-2 gap-8 lg:gap-12'
          } items-stretch z-10`}
        >
          {/* ========================================================= */}
          {/* CARD 1: ULTRA PASS BÁSICO */}
          {/* ========================================================= */}
          <div
            className={`relative rounded-3xl bg-[#0c0e1e]/90 border border-[#232742] ${
              isSettingsTab ? 'p-5 sm:p-6' : 'p-7 sm:p-8'
            } flex flex-col justify-between h-full backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-[#383d63]`}
          >
            {/* Topo do Card 1 */}
            <div className="flex-1 flex flex-col">
              {/* Emblema & Título */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#f59e0b] via-[#fbbf24] to-[#f472b6] p-0.5 shadow-md flex items-center justify-center flex-shrink-0">
                  <div className="w-full h-full bg-[#111322] rounded-[10px] flex items-center justify-center">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-[#facc15] fill-[#facc15]" />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-black tracking-widest text-[#949ba4] uppercase block">
                    ULTRA PASS
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black italic tracking-wide text-white uppercase">
                    BÁSICO
                  </h3>
                </div>
              </div>

              {/* Lista de Vantagens Detalhadas */}
              <ul
                className={`space-y-3.5 ${
                  isSettingsTab ? 'text-xs sm:text-sm mb-6' : 'text-sm mb-8'
                } text-[#dbdee1] font-medium`}
              >
                <li className="flex items-center gap-3">
                  <Upload className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>50 MB de uploads</span>
                </li>
                <li className="flex items-center gap-3">
                  <Smile className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>Emojis personalizados em qualquer lugar</span>
                </li>
                <li className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>Super-reações ilimitadas</span>
                </li>
                <li className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>Insígnia especial no seu perfil</span>
                </li>
              </ul>
            </div>

            {/* Parte Inferior: Seletores Anual / Mensal com 'Em breve' e Botão Alinhado */}
            <div className="mt-auto pt-4 flex flex-col justify-end w-full">
              <div className="h-[1px] bg-[#1f2238] w-full mb-4 sm:mb-5" />

              {/* Opções de Cobrança com 'Em breve' (Altura idêntica para alinhamento dos botões) */}
              <div className="space-y-2.5 mb-5 w-full">
                {/* Opção Anual */}
                <div
                  onClick={() => setBasicPlan('anual')}
                  className={`min-h-[54px] flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    basicPlan === 'anual'
                      ? 'bg-white/5 border-white/20'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        basicPlan === 'anual'
                          ? 'border-[#8b5cf6] bg-[#8b5cf6]'
                          : 'border-white/40'
                      }`}
                    >
                      {basicPlan === 'anual' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs sm:text-sm text-white block leading-tight">Anual</span>
                      <span className="text-[11px] text-[#949ba4] leading-tight block">Cobrança anual</span>
                    </div>
                  </div>
                  <span className="whitespace-nowrap flex-shrink-0 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#c084fc] bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 px-2.5 py-1 rounded-md">
                    Em breve
                  </span>
                </div>

                {/* Opção Mensal */}
                <div
                  onClick={() => setBasicPlan('mensal')}
                  className={`min-h-[54px] flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    basicPlan === 'mensal'
                      ? 'bg-white/5 border-white/20'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        basicPlan === 'mensal'
                          ? 'border-[#8b5cf6] bg-[#8b5cf6]'
                          : 'border-white/40'
                      }`}
                    >
                      {basicPlan === 'mensal' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs sm:text-sm text-white block leading-tight">Mensal</span>
                      <span className="text-[11px] text-[#949ba4] leading-tight block">Cobrança mensal</span>
                    </div>
                  </div>
                  <span className="whitespace-nowrap flex-shrink-0 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#c084fc] bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 px-2.5 py-1 rounded-md">
                    Em breve
                  </span>
                </div>
              </div>

              {/* Botão de Ação: Assinar Básico */}
              <button
                disabled
                className="w-full h-[48px] sm:h-[52px] flex items-center justify-center px-4 rounded-xl bg-[#222538] hover:bg-[#2b2f47] text-white/90 font-bold text-sm tracking-wide transition-all shadow-md cursor-pointer active:scale-98"
              >
                Assinar Básico
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 2: ULTRA PASS (PRO COM A CAPIVARA SOBREPOSTA) */}
          {/* ========================================================= */}
          <div
            className={`relative rounded-3xl bg-[#100f28]/95 border-2 border-[#8b5cf6] ${
              isSettingsTab ? 'p-5 sm:p-6' : 'p-7 sm:p-8'
            } flex flex-col justify-between h-full backdrop-blur-xl shadow-[0_0_40px_rgba(139,92,246,0.35)] transition-all duration-300 hover:shadow-[0_0_55px_rgba(139,92,246,0.5)]`}
          >
            {/* ILUSTRAÇÃO DA CAPIVARA SUPER-HEROÍNA SOBREPOSTA NO CANTO SUPERIOR DIREITO */}
            <div
              className={`absolute pointer-events-none z-30 select-none ${
                isSettingsTab
                  ? '-top-12 sm:-top-14 -right-2 sm:-right-4 w-28 sm:w-36'
                  : '-top-24 sm:-top-28 -right-8 sm:-right-14 w-60 sm:w-72'
              }`}
            >
              <img
                src={getAssetUrl('assets/ultrapass/parte2/capy.png')}
                alt="Capivara Ultra Pass"
                className="w-full h-auto object-contain drop-shadow-[0_12px_30px_rgba(139,92,246,0.65)]"
              />
            </div>

            {/* Topo do Card 2 */}
            <div className="relative z-10 flex-1 flex flex-col">
              {/* Emblema & Título */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#f59e0b] via-[#fbbf24] to-[#f472b6] p-0.5 shadow-md flex items-center justify-center flex-shrink-0">
                  <div className="w-full h-full bg-[#111322] rounded-[10px] flex items-center justify-center">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-[#facc15] fill-[#facc15]" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase">
                  <span className="text-[#fbbf24]">ULTRA</span>{' '}
                  <span className="bg-gradient-to-r from-[#c084fc] to-[#e879f9] bg-clip-text text-transparent">
                    PASS
                  </span>
                </h3>
              </div>

              {/* Subtítulo: Tudo do Básico, mais */}
              <p className="text-xs sm:text-sm font-semibold text-[#dbdee1] mb-5">
                Tudo do Básico, mais:
              </p>

              {/* Lista de Vantagens Detalhadas Pro */}
              <ul
                className={`space-y-3.5 ${
                  isSettingsTab ? 'text-xs sm:text-sm mb-6' : 'text-sm mb-8'
                } text-[#dbdee1] font-medium`}
              >
                <li className="flex items-center gap-3">
                  <Upload className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>1 GB de uploads</span>
                </li>
                <li className="flex items-center gap-3">
                  <Smile className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>Emojis personalizados em qualquer lugar</span>
                </li>
                <li className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>Super-reações ilimitadas</span>
                </li>
                <li className="flex items-center gap-3">
                  <Video className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>Transmissão de vídeo em HD</span>
                </li>
                <li className="flex items-center gap-3">
                  <Gem className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>2 impulsos de comunidade</span>
                </li>
                <li className="flex items-center gap-3">
                  <User className="w-4 h-4 text-white/90 flex-shrink-0" />
                  <span>Perfis personalizados e muito mais!</span>
                </li>
              </ul>
            </div>

            {/* Parte Inferior: Seletores Anual / Mensal Pro com 'Em breve' e Botão Alinhado */}
            <div className="relative z-10 mt-auto pt-4 flex flex-col justify-end w-full">
              <div className="h-[1px] bg-[#34295e] w-full mb-4 sm:mb-5" />

              {/* Opções de Cobrança com 'Em breve' (Altura idêntica para alinhamento dos botões) */}
              <div className="space-y-2.5 mb-5 w-full">
                {/* Opção Anual (Destaque Pro) */}
                <div
                  onClick={() => setProPlan('anual')}
                  className={`min-h-[54px] flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    proPlan === 'anual'
                      ? 'bg-[#2a1754]/80 border-[#8b5cf6]/70 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        proPlan === 'anual'
                          ? 'border-[#a855f7] bg-[#a855f7]'
                          : 'border-white/40'
                      }`}
                    >
                      {proPlan === 'anual' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs sm:text-sm text-white block leading-tight">Anual</span>
                      <span className="text-[11px] text-[#949ba4] leading-tight block">Cobrança anual</span>
                    </div>
                  </div>
                  <span className="whitespace-nowrap flex-shrink-0 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#f472b6] bg-[#ec4899]/20 border border-[#ec4899]/40 px-2.5 py-1 rounded-md shadow-[0_0_10px_rgba(236,72,153,0.3)]">
                    Em breve
                  </span>
                </div>

                {/* Opção Mensal */}
                <div
                  onClick={() => setProPlan('mensal')}
                  className={`min-h-[54px] flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    proPlan === 'mensal'
                      ? 'bg-[#2a1754]/80 border-[#8b5cf6]/70 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        proPlan === 'mensal'
                          ? 'border-[#a855f7] bg-[#a855f7]'
                          : 'border-white/40'
                      }`}
                    >
                      {proPlan === 'mensal' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs sm:text-sm text-white block leading-tight">Mensal</span>
                      <span className="text-[11px] text-[#949ba4] leading-tight block">Cobrança mensal</span>
                    </div>
                  </div>
                  <span className="whitespace-nowrap flex-shrink-0 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#f472b6] bg-[#ec4899]/20 border border-[#ec4899]/40 px-2.5 py-1 rounded-md">
                    Em breve
                  </span>
                </div>
              </div>

              {/* Botão de Ação: Assinar Ultra Pass */}
              <button
                disabled
                className="w-full h-[48px] sm:h-[52px] flex items-center justify-center px-4 rounded-xl bg-gradient-to-r from-[#7c3aed] via-[#8b5cf6] to-[#9333ea] hover:brightness-110 active:scale-98 text-white font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(139,92,246,0.55)] transition-all cursor-pointer"
              >
                Assinar Ultra Pass
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export const DiscordNitroView = DiscordUltraPassView;
