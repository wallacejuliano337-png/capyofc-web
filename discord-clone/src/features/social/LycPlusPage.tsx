import { useState, useEffect } from "react";
import {
  Crown,
  Gift,
  Heart,
  Sparkles,
  Check,
  Minus,
  Tv,
  Smile,
  Lock,
  Hash,
  Volume2,
  Gamepad2,
  User as UserIcon,
} from "lucide-react";

// Official approved runtime assets from assets/lyc-plus/
import cardFanImg from "../../../assets/lyc-plus/cartas-leque.png";
import emojiCardsImg from "../../../assets/lyc-plus/emoji-cartas.png";
import emojiCelebrationImg from "../../../assets/lyc-plus/emoji-comemorando.png";
import emojiChipImg from "../../../assets/lyc-plus/emoji-ficha.png";
import emojiStackImg from "../../../assets/lyc-plus/emoji-pilha.png";
import chipDiamondImg from "../../../assets/lyc-plus/ficha-diamante.png";
import chipLycPlusImg from "../../../assets/lyc-plus/ficha-lyc-plus.png";
import chipLycImg from "../../../assets/lyc-plus/ficha-lyc.png";
import chipMascotImg from "../../../assets/lyc-plus/ficha-mascote.png";
import heroBgImg from "../../../assets/lyc-plus/hero-fundo-completo.png";
import mascotPlayingImg from "../../../assets/lyc-plus/mascote-jogando.png";
import mascotStackImg from "../../../assets/lyc-plus/mascote-pilha.png";
import profileCardImg from "../../../assets/lyc-plus/perfil.png";
import streamMonitorImg from "../../../assets/lyc-plus/transmissao.png";

// General mascot for subnav and avatars
import mascotLogoImg from "../../../assets/mascote-cabeca.png";

import "./lyc-plus.css";

export function LycPlusPage() {
  const [activeTab, setActiveTab] = useState<"inicio" | "novidades" | "melhor" | "planos" | "comparar">("inicio");
  const [isLiked, setIsLiked] = useState(false);
  const [noticeToast, setNoticeToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNoticeToast(msg);
    setTimeout(() => setNoticeToast(null), 3500);
  };

  const scrollTo = (id: string, tab: "inicio" | "novidades" | "melhor" | "planos" | "comparar") => {
    setActiveTab(tab);
    if (tab === "inicio") {
      const page = document.querySelector(".lyc-plus-page");
      if (page) {
        page.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Scrollspy to automatically update active tab as user scrolls
  useEffect(() => {
    const pageEl = document.querySelector(".lyc-plus-page");
    if (!pageEl) return;

    const handleScroll = () => {
      const sections: Array<{ id: string; tab: "inicio" | "novidades" | "melhor" | "planos" | "comparar" }> = [
        { id: "lyc-hero", tab: "inicio" },
        { id: "lyc-novidades", tab: "novidades" },
        { id: "lyc-melhor", tab: "melhor" },
        { id: "lyc-planos", tab: "planos" },
        { id: "lyc-comparar", tab: "comparar" },
      ];

      const scrollPos = pageEl.scrollTop + 140;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveTab(sections[i].tab);
          break;
        }
      }
    };

    pageEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => pageEl.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="lyc-plus-page" id="lyc-inicio">
      {/* ====================================================================
          01. SUB-NAVEGAÇÃO INTERNA SUPERIOR (LYC+)
          ==================================================================== */}
      <nav className="lyc-subnav" aria-label="Navegação interna LYC+">
        <div className="lyc-subnav-left">
          <a
            href="#lyc-inicio"
            className="lyc-subnav-logo-group"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("lyc-inicio", "inicio");
            }}
            title="LYC Arena — LYC+"
          >
            <img src={mascotLogoImg} alt="LYC+" className="lyc-subnav-logo-mascot" />
            <span className="lyc-subnav-logo-brand">LYC+</span>
          </a>

          <div className="lyc-subnav-menu" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "inicio"}
              className={`lyc-subnav-tab ${activeTab === "inicio" ? "active" : ""}`}
              onClick={() => scrollTo("lyc-inicio", "inicio")}
            >
              Início
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "novidades"}
              className={`lyc-subnav-tab ${activeTab === "novidades" ? "active" : ""}`}
              onClick={() => scrollTo("lyc-novidades", "novidades")}
            >
              Novidades
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "melhor"}
              className={`lyc-subnav-tab ${activeTab === "melhor" ? "active" : ""}`}
              onClick={() => scrollTo("lyc-melhor", "melhor")}
            >
              Melhor do LYC+
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "planos"}
              className={`lyc-subnav-tab ${activeTab === "planos" ? "active" : ""}`}
              onClick={() => scrollTo("lyc-planos", "planos")}
            >
              Planos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "comparar"}
              className={`lyc-subnav-tab ${activeTab === "comparar" ? "active" : ""}`}
              onClick={() => scrollTo("lyc-comparar", "comparar")}
            >
              Comparar
            </button>
          </div>
        </div>

        <div className="lyc-subnav-right">
          <button
            type="button"
            className={`lyc-subnav-heart-btn ${isLiked ? "liked" : ""}`}
            onClick={() => {
              setIsLiked(!isLiked);
              showToast(!isLiked ? "Adicionado aos seus favoritos!" : "Removido dos favoritos.");
            }}
            title="Favoritar LYC+"
            aria-label="Favoritar LYC+"
          >
            <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
          </button>

          <button
            type="button"
            className="lyc-subnav-gift-btn"
            onClick={() => showToast("O envio de presentes do LYC+ estará disponível em breve!")}
            title="Presentear assinatura LYC+"
          >
            <Gift size={15} />
            <span>Presentear LYC+</span>
          </button>
        </div>
      </nav>

      {/* Toast flutuante de notificação */}
      {noticeToast && (
        <div className="lyc-toast-notice" role="status">
          <Sparkles size={16} color="#21d4ff" />
          <span>{noticeToast}</span>
        </div>
      )}

      {/* ====================================================================
          02. HERO PRINCIPAL — DESBLOQUEIE UM NOVO NÍVEL COM LYC+
          ==================================================================== */}
      <section className="lyc-hero-wrap" id="lyc-hero">
        {/* Camada artística de fundo oficial */}
        <div className="lyc-hero-bg-layer" aria-hidden="true">
          <img src={heroBgImg} alt="" className="lyc-hero-bg-img" />
          <div className="lyc-hero-bg-overlay" />
        </div>

        <div className="lyc-hero-container">
          <div className="lyc-hero-content">
            <h1 className="lyc-hero-heading">
              DESBLOQUEIE<br />
              UM <span className="lyc-title-glow">NOVO NÍVEL</span><br />
              COM <span className="lyc-title-cyan">LYC+</span>
            </h1>

            <p className="lyc-hero-subheading">
              Personalize seu perfil, tenha mais recursos, melhor qualidade e
              aproveite uma experiência completa na LYC ARENA.
            </p>

            <div className="lyc-hero-cta-group">
              <button
                type="button"
                className="lyc-btn-pill-primary"
                onClick={() => scrollTo("lyc-planos", "planos")}
              >
                <Crown size={17} className="btn-crown-icon" />
                <span>Conhecer planos</span>
              </button>

              <button
                type="button"
                className="lyc-btn-pill-secondary"
                onClick={() => showToast("O envio de presentes do LYC+ estará disponível em breve!")}
              >
                <Gift size={16} />
                <span>Presentear LYC+</span>
              </button>
            </div>
          </div>

          {/* Lado direito do Hero com composição 3D dinâmica */}
          <div className="lyc-hero-visual-stage" aria-hidden="true">
            {/* Cristal diamante flutuante */}
            <div className="hero-floating-diamond">
              <span className="diamond-glow-sparkle">✦</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          03. SEÇÃO NOVIDADES
          ==================================================================== */}
      <section className="lyc-section-wrap" id="lyc-novidades">
        <div className="lyc-section-header-center">
          <h2 className="lyc-heading-italic">NOVIDADES</h2>
        </div>

        {/* Card Destaque: PERSONALIZE SUA EXPERIÊNCIA */}
        <div className="lyc-highlight-card">
          <div className="lyc-highlight-info">
            <span className="lyc-pill-tag">NOVO</span>
            <h3 className="lyc-highlight-title">
              PERSONALIZE<br />
              SUA EXPERIÊNCIA
            </h3>
            <p className="lyc-highlight-desc">
              Perfil, emojis e muito mais com a identidade LYC.
            </p>
            <button
              type="button"
              className="lyc-btn-action"
              onClick={() => scrollTo("lyc-melhor", "melhor")}
            >
              Confira
            </button>
          </div>

          {/* Composição das 3 Fichas 3D Oficiais (Coroa, Mascote e Diamante) */}
          <div className="lyc-highlight-chips-showcase" aria-hidden="true">
            <div className="chip-showcase-item chip-crown">
              <img src={chipLycImg} alt="" />
            </div>
            <div className="chip-showcase-item chip-center-mascot">
              <img src={chipMascotImg} alt="" />
            </div>
            <div className="chip-showcase-item chip-diamond">
              <img src={chipDiamondImg} alt="" />
            </div>
            <div className="chip-sparkle-shard sp-1">✦</div>
            <div className="chip-sparkle-shard sp-2">★</div>
          </div>
        </div>

        {/* Dois Cards: Mesmo nome, novo visual & Sua Arena. Seu estilo */}
        <div className="lyc-duo-cards-grid">
          {/* Card A: Mesmo nome, novo visual */}
          <article className="lyc-feature-card">
            <div className="feature-card-body">
              {/* Visual: Lista de Membros Mockup */}
              <div className="feature-card-visual members-visual" aria-hidden="true">
                <div className="mini-members-list">
                  <div className="mini-member-item">
                    <div className="mini-avatar av-1" />
                    <span className="mini-member-name">Lunex</span>
                  </div>
                  <div className="mini-member-item">
                    <div className="mini-avatar av-2" />
                    <span className="mini-member-name">Ryzenn</span>
                  </div>
                  {/* Destaque LYC PLAYER */}
                  <div className="mini-member-item featured-member">
                    <div className="mini-avatar av-vip" />
                    <Crown size={15} className="mini-crown-cyan" />
                    <span className="mini-member-vip-name">LYC PLAYER</span>
                  </div>
                  <div className="mini-member-item">
                    <div className="mini-avatar av-3" />
                    <span className="mini-member-name">Kairo</span>
                  </div>
                  <div className="mini-member-item">
                    <div className="mini-avatar av-4" />
                    <span className="mini-member-name">Zenn</span>
                  </div>
                </div>

                <div className="member-visual-chip">
                  <img src={chipLycPlusImg} alt="" />
                </div>
              </div>

              <div className="feature-card-texts">
                <h3 className="feature-title">Mesmo nome, novo visual.</h3>
                <p className="feature-desc">
                  Dê mais personalidade ao seu perfil. Misture e combine itens exclusivos
                  para criar um nome que se destaca.
                </p>
                <button
                  type="button"
                  className="lyc-btn-action"
                  onClick={() => scrollTo("lyc-melhor", "melhor")}
                >
                  Confira &gt;
                </button>
              </div>
            </div>
          </article>

          {/* Card B: Sua Arena. Seu estilo */}
          <article className="lyc-feature-card">
            <div className="feature-card-body">
              {/* Visual: Mockup de interface da Arena com mascote gamer */}
              <div className="feature-card-visual arena-visual" aria-hidden="true">
                <div className="mini-arena-chat-mockup">
                  <div className="mini-arena-topbar">
                    <Gamepad2 size={13} className="mini-top-icon" />
                    <span>LYC ARENA</span>
                  </div>
                  <div className="mini-arena-split">
                    <div className="mini-arena-channels">
                      <span className="mini-cat-label">CANAIS</span>
                      <div className="mini-chan-row active"># geral</div>
                      <div className="mini-chan-row"># gaming</div>
                      <div className="mini-chan-row"># música</div>
                      <div className="mini-chan-row"># torneios</div>
                    </div>
                    <div className="mini-arena-messages">
                      <div className="mini-msg-row">
                        <span className="msg-author author-cyan">Kairo</span>
                        <span className="msg-text">bora jogar hoje?</span>
                      </div>
                      <div className="mini-msg-row">
                        <span className="msg-author author-vip">LYC PLAYER</span>
                        <span className="msg-text">partiu! 👾</span>
                      </div>
                      <div className="mini-msg-row">
                        <span className="msg-author">Lunex</span>
                        <span className="msg-text">essa play foi insana</span>
                      </div>
                      <div className="mini-msg-row">
                        <span className="msg-author author-blue">Ryzenn</span>
                        <span className="msg-text">time tá on 👆</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="arena-visual-chip">
                  <img src={chipLycPlusImg} alt="" />
                </div>
              </div>

              <div className="feature-card-texts">
                <h3 className="feature-title">Sua Arena. Seu estilo.</h3>
                <p className="feature-desc">
                  Uma identidade feita para você. Temas personalizados, ícones exclusivos e
                  muito mais para deixar a sua Arena do seu jeito.
                </p>
                <button
                  type="button"
                  className="lyc-btn-action"
                  onClick={() => scrollTo("lyc-planos", "planos")}
                >
                  Confira &gt;
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ====================================================================
          04. SEÇÃO O MELHOR DO LYC+
          ==================================================================== */}
      <section className="lyc-section-wrap" id="lyc-melhor">
        <div className="lyc-section-header-center">
          <h2 className="lyc-heading-italic">
            O MELHOR DO <span className="lyc-title-cyan">LYC+</span>
          </h2>
        </div>

        {/* Bloco 1: EXIBA O SEU ESTILO (Card Panorâmico) */}
        <div className="lyc-style-showcase-card">
          <div className="style-showcase-info">
            <h3 className="style-showcase-title">Exiba o seu estilo.</h3>
            <p className="style-showcase-desc">
              Personalize seu perfil com temas exclusivos, banners animados, badges e
              muito mais para mostrar quem você é.
            </p>
            <button
              type="button"
              className="lyc-btn-action"
              onClick={() => scrollTo("lyc-planos", "planos")}
            >
              Confira &gt;
            </button>
          </div>

          <div className="style-showcase-art" aria-hidden="true">
            <img src={profileCardImg} alt="" className="style-profile-3d-img" />
          </div>
        </div>

        {/* Bloco 2: TORNE A ARENA O SEU ESPAÇO (Duas colunas chat + espaço) */}
        <div className="lyc-arena-space-grid">
          {/* Mockup da Interface LYC+ Completa */}
          <div className="arena-interface-panel" aria-hidden="true">
            <div className="arena-panel-sidebar">
              <div className="arena-panel-guild-header">
                <span>ARENA LYC+</span>
              </div>
              <div className="arena-panel-chan-group">
                <span className="group-title">CANAIS DE TEXTO</span>
                <div className="chan-item selected"><Hash size={13} /> geral</div>
                <div className="chan-item"><Hash size={13} /> estratégia</div>
                <div className="chan-item"><Hash size={13} /> clipes</div>
                <div className="chan-item"><Hash size={13} /> torneios</div>
                <div className="chan-item"><Hash size={13} /> comunidade</div>
              </div>
              <div className="arena-panel-chan-group">
                <span className="group-title">CANAIS DE VOZ</span>
                <div className="chan-item"><Volume2 size={13} /> Lobby</div>
                <div className="chan-item"><Volume2 size={13} /> Duo</div>
                <div className="chan-item"><Volume2 size={13} /> Squad</div>
              </div>
              <div className="arena-panel-user-bar">
                <div className="user-bar-avatar" />
                <div className="user-bar-details">
                  <span className="user-name">lycdev</span>
                  <span className="user-status">Online</span>
                </div>
              </div>
            </div>

            <div className="arena-panel-chat-area">
              <div className="chat-area-header">
                <Hash size={15} />
                <span>geral</span>
              </div>
              <div className="chat-area-feed">
                <div className="chat-feed-msg">
                  <div className="feed-avatar fa-1" />
                  <div className="feed-msg-content">
                    <div className="feed-author-line">
                      <b>naori</b>
                      <small>Hoje às 19:24</small>
                    </div>
                    <p>quem vai pro torneio hoje?</p>
                  </div>
                </div>
                <div className="chat-feed-msg">
                  <div className="feed-avatar fa-2" />
                  <div className="feed-msg-content">
                    <div className="feed-author-line">
                      <b>catgirl</b>
                      <small>Hoje às 19:25</small>
                    </div>
                    <p>eu vou! bora com o squad?</p>
                  </div>
                </div>
                <div className="chat-feed-msg">
                  <div className="feed-avatar fa-3" />
                  <div className="feed-msg-content">
                    <div className="feed-author-line">
                      <b>vumpus</b>
                      <small>Hoje às 19:26</small>
                    </div>
                    <p>tô dentro 💙</p>
                  </div>
                </div>
                <div className="chat-feed-msg">
                  <div className="feed-avatar fa-4" />
                  <div className="feed-msg-content">
                    <div className="feed-author-line">
                      <b>loky</b>
                      <small>Hoje às 19:26</small>
                    </div>
                    <p>essa atualização tá insana!</p>
                  </div>
                </div>
                <div className="chat-feed-msg">
                  <div className="feed-avatar fa-5" />
                  <div className="feed-msg-content">
                    <div className="feed-author-line">
                      <b>nelly</b>
                      <small>Hoje às 19:27</small>
                    </div>
                    <p>slk, os novos emotes estão muito bons</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Informações: TORNE A ARENA O SEU ESPAÇO */}
          <div className="arena-space-info-card">
            <div className="space-info-texts">
              <h3 className="space-info-title">
                TORNE A ARENA<br />
                O SEU <span className="lyc-title-cyan">ESPAÇO</span>
              </h3>
              <p className="space-info-desc">
                Escolha entre mais de 20 temas de cores e ícones de aplicativo personalizados.
              </p>
              <button
                type="button"
                className="lyc-btn-action"
                onClick={() => scrollTo("lyc-planos", "planos")}
              >
                Confira &gt;
              </button>
            </div>

            <div className="space-info-art" aria-hidden="true">
              <img src={mascotPlayingImg} alt="" className="space-mascot-img" />
              <img src={chipLycPlusImg} alt="" className="space-chip-floating" />
            </div>
          </div>
        </div>

        {/* Bloco 3: Emojis/Stickers & Transmissão Ao Vivo */}
        <div className="lyc-promo-duo-grid">
          {/* Card Emojis e Stickers */}
          <article className="lyc-promo-card promo-emojis">
            <div className="promo-card-visual" aria-hidden="true">
              <div className="emojis-floating-composition">
                <img src={emojiCardsImg} alt="" className="emoji-art-item e-cards" />
                <img src={emojiCelebrationImg} alt="" className="emoji-art-item e-cheer" />
                <img src={emojiStackImg} alt="" className="emoji-art-item e-stack" />
                <div className="emoji-bubble-gg">GG!</div>
                <span className="emoji-heart-neon eh1">♥</span>
                <span className="emoji-heart-neon eh2">♥</span>
              </div>
            </div>
            <div className="promo-card-footer">
              <h4>Emojis e reações animadas</h4>
              <p>Coleção exclusiva de emojis do mascote LYC para usar em qualquer comunidade.</p>
            </div>
          </article>

          {/* Card Transmissão Ao Vivo */}
          <article className="lyc-promo-card promo-stream">
            <div className="promo-card-visual" aria-hidden="true">
              <div className="stream-art-wrap">
                <img src={streamMonitorImg} alt="" className="stream-3d-monitor-img" />
                <div className="stream-badge-live">
                  <span className="pulse-dot-red" />
                  <span>AO VIVO</span>
                </div>
              </div>
            </div>
            <div className="promo-card-footer">
              <h4>Transmissões em Full HD</h4>
              <p>Transmita suas gameplays em 1080p a 60 FPS com áudio nítido e baixa latência.</p>
            </div>
          </article>
        </div>
      </section>

      {/* ====================================================================
          05. SEÇÃO PLANOS — ESCOLHA SEU LYC+
          ==================================================================== */}
      <section className="lyc-section-wrap" id="lyc-planos">
        <div className="lyc-section-header-center">
          <h2 className="lyc-heading-italic">
            ESCOLHA SEU <span className="lyc-title-cyan">LYC+</span>
          </h2>
          <p className="lyc-section-subtitle">
            Mais formas de aproveitar o LYC e levar sua experiência a outro nível.
            Escolha o plano que mais combina com você.
          </p>
        </div>

        <div className="lyc-plans-cards-grid">
          {/* Card 1: LYC+ MENSAL */}
          <div className="lyc-tier-card tier-monthly">
            <div className="tier-card-header">
              <div className="tier-header-texts">
                <h3 className="tier-title">
                  LYC+ <span className="tier-title-cyan">MENSAL</span>
                </h3>
                <p className="tier-desc">Tudo que você precisa para curtir o LYC+.</p>
              </div>
              <div className="tier-art-wrap" aria-hidden="true">
                <img src={emojiChipImg} alt="" className="tier-mascot-img" />
              </div>
            </div>

            <ul className="tier-features-list">
              <li>
                <Crown size={16} className="tier-icon-crown" />
                <span>Todos os benefícios do LYC+</span>
              </li>
              <li>
                <Tv size={16} className="tier-icon-tv" />
                <span>Transmissões em 1080p 60 FPS</span>
              </li>
              <li>
                <Smile size={16} className="tier-icon-smile" />
                <span>Avatares, banners e reações animadas</span>
              </li>
            </ul>

            <div className="tier-price-row">
              <span className="tier-price-val">R$ --,--</span>
              <span className="tier-price-period">/mês</span>
            </div>

            <button
              type="button"
              className="lyc-btn-tier-lock"
              disabled
              title="Planos e pagamentos estarão disponíveis em breve"
            >
              <Lock size={15} />
              <span>EM BREVE</span>
            </button>
          </div>

          {/* Card 2: LYC+ ANUAL */}
          <div className="lyc-tier-card tier-annual highlighted">
            <div className="tier-badge-top">
              <Crown size={14} />
              <span>MELHOR VALOR</span>
            </div>

            <div className="tier-card-header">
              <div className="tier-header-texts">
                <h3 className="tier-title">
                  LYC+ <span className="tier-title-cyan">ANUAL</span>
                </h3>
                <p className="tier-desc">Mais vantagens, mais economia, mais LYC+.</p>
              </div>
              <div className="tier-art-wrap" aria-hidden="true">
                <img src={mascotPlayingImg} alt="" className="tier-mascot-img" />
              </div>
            </div>

            <ul className="tier-features-list">
              <li>
                <Crown size={16} className="tier-icon-crown" />
                <span>Todos os benefícios mensais</span>
              </li>
              <li>
                <Gift size={16} className="tier-icon-gift" />
                <span>Insígnia e badge de apoiador</span>
              </li>
              <li>
                <Sparkles size={16} className="tier-icon-sparkle" />
                <span>Maior economia no plano anual</span>
              </li>
            </ul>

            <div className="tier-price-row">
              <span className="tier-price-val">R$ --,--</span>
              <span className="tier-price-period">/ano</span>
            </div>

            <button
              type="button"
              className="lyc-btn-tier-lock"
              disabled
              title="Planos e pagamentos estarão disponíveis em breve"
            >
              <Lock size={15} />
              <span>EM BREVE</span>
            </button>
          </div>
        </div>
      </section>

      {/* ====================================================================
          06. SEÇÃO COMPARAR BENEFÍCIOS
          ==================================================================== */}
      <section className="lyc-section-wrap" id="lyc-comparar">
        <div className="lyc-compare-header-row">
          <div className="compare-header-texts">
            <h2 className="lyc-heading-italic">COMPARE OS BENEFÍCIOS</h2>
            <p className="lyc-section-subtitle text-left">
              Veja o que você ganha com o LYC+ e escolha o plano ideal para levar sua
              experiência ainda mais longe.
            </p>
          </div>
          <div className="compare-header-art" aria-hidden="true">
            <img src={cardFanImg} alt="" className="compare-cards-art" />
            <img src={chipLycPlusImg} alt="" className="compare-chip-art" />
          </div>
        </div>

        {/* Tabela de Comparação com coluna LYC+ destacada */}
        <div className="lyc-table-container">
          <table className="lyc-compare-table">
            <thead>
              <tr>
                <th className="th-feature">RECURSO</th>
                <th className="th-tier">
                  <div className="th-tier-header">
                    <UserIcon size={16} />
                    <span>GRATUITO</span>
                  </div>
                </th>
                <th className="th-tier th-lyc-plus">
                  <div className="th-plus-pill">
                    <span className="plus-gem">✦</span>
                    <span>LYC+</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="td-feature">Avatar estático</td>
                <td className="td-val neutral"><Check size={18} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
              <tr>
                <td className="td-feature">Avatar GIF</td>
                <td className="td-val neutral"><Minus size={16} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
              <tr>
                <td className="td-feature">Banner GIF</td>
                <td className="td-val neutral"><Minus size={16} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
              <tr>
                <td className="td-feature">Transmissão padrão (720p 30 FPS)</td>
                <td className="td-val neutral"><Check size={18} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
              <tr>
                <td className="td-feature">Transmissão Full HD (1080p 60 FPS)</td>
                <td className="td-val neutral"><Minus size={16} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
              <tr>
                <td className="td-feature">Temas e cores personalizados</td>
                <td className="td-val neutral"><Minus size={16} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
              <tr>
                <td className="td-feature">Insígnia de apoiador LYC+</td>
                <td className="td-val neutral"><Minus size={16} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
              <tr>
                <td className="td-feature">Reações exclusivas</td>
                <td className="td-val neutral"><Minus size={16} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
              <tr>
                <td className="td-feature">Emojis animados</td>
                <td className="td-val neutral"><Minus size={16} /></td>
                <td className="td-val plus"><Check size={18} className="check-cyan" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Caixa de aviso oficial */}
        <div className="lyc-soon-notice-box">
          <div className="notice-icon-diamond">✦</div>
          <div className="notice-texts">
            <h4 className="notice-heading">Em breve na LYC Arena</h4>
            <p className="notice-desc">
              Planos e assinaturas disponíveis em futuras atualizações.
            </p>
          </div>
        </div>

        {/* Ilustração inferior do comparativo: Mascote espiando pelas pilhas de fichas */}
        <div className="lyc-compare-footer-illustration" aria-hidden="true">
          <img src={mascotStackImg} alt="" className="compare-stack-img" />
        </div>
      </section>

      {/* ====================================================================
          07. CHAMADA FINAL (CTA) — O QUE VOCÊ ESTÁ ESPERANDO?
          ==================================================================== */}
      <section className="lyc-final-cta-wrap" id="lyc-cta">
        <div className="cta-background-rays" aria-hidden="true" />

        <div className="cta-container">
          {/* Elementos 3D flutuantes ao redor do CTA */}
          <div className="cta-floating-art" aria-hidden="true">
            <img src={chipLycPlusImg} alt="" className="cta-chip cta-chip-1" />
            <img src={chipDiamondImg} alt="" className="cta-chip cta-chip-2" />
            <img src={emojiCelebrationImg} alt="" className="cta-mascot-center" />
          </div>

          <h2 className="lyc-cta-heading">
            O QUE VOCÊ ESTÁ<br />
            ESPERANDO?
          </h2>

          <p className="lyc-cta-subtext">
            Eleve sua experiência com LYC+.
          </p>

          <div className="lyc-hero-cta-group cta-center">
            <button
              type="button"
              className="lyc-btn-pill-primary"
              onClick={() => scrollTo("lyc-planos", "planos")}
            >
              <Crown size={17} className="btn-crown-icon" />
              <span>Conhecer planos</span>
            </button>

            <button
              type="button"
              className="lyc-btn-pill-secondary"
              onClick={() => showToast("O envio de presentes do LYC+ estará disponível em breve!")}
            >
              <Gift size={16} />
              <span>Presentear LYC+</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
