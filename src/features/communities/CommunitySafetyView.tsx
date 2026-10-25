import { useState } from "react";
import {
  ShieldCheck,
  Filter,
  Flame,
  Check,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { communityAction, type Community } from "../../services/communities";
import { recordAuditLogEntry } from "../../services/community-audit";

export type VerificationLevel = "none" | "low" | "medium" | "high" | "highest";
export type ContentFilterLevel = "disabled" | "norole" | "all";

export function CommunitySafetyView({
  community,
  isOwner,
  canAdmin,
  actor,
}: {
  community: Community;
  isOwner: boolean;
  canAdmin: boolean;
  actor?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  };
}) {
  const editable = isOwner || canAdmin;

  // Stored preferences with sensible defaults
  const [verificationLevel, setVerificationLevel] =
    useState<VerificationLevel>(() => {
      if (community.verification_level) {
        return community.verification_level as VerificationLevel;
      }
      try {
        const saved = localStorage.getItem(
          `lyc_community_verification_level_${community.id}`,
        );
        if (saved) return saved as VerificationLevel;
      } catch {
        // fallback
      }
      return "low";
    });

  const [contentFilter, setContentFilter] = useState<ContentFilterLevel>(() => {
    if (community.content_filter) {
      return community.content_filter as ContentFilterLevel;
    }
    try {
      const saved = localStorage.getItem(
        `lyc_community_content_filter_${community.id}`,
      );
      if (saved) return saved as ContentFilterLevel;
    } catch {
      // fallback
    }
    return "norole";
  });

  const [savedFeedback, setSavedFeedback] = useState(false);

  const verificationLabels: Record<VerificationLevel, string> = {
    none: "Nenhum",
    low: "Baixo",
    medium: "Médio",
    high: "Alto",
    highest: "Máximo",
  };

  const contentFilterLabels: Record<ContentFilterLevel, string> = {
    disabled: "Não verificar",
    norole: "Membros sem cargo",
    all: "Todos os membros",
  };

  const handleSelectVerification = async (level: VerificationLevel) => {
    if (!editable || level === verificationLevel) return;
    const oldLevel = verificationLevel;
    setVerificationLevel(level);
    try {
      localStorage.setItem(
        `lyc_community_verification_level_${community.id}`,
        level,
      );
      community.verification_level = level;
      await communityAction("edit_community", {
        community_id: community.id,
        verification_level: level,
      });
    } catch (err) {
      console.error("[CommunitySafetyView] Failed to save verification level:", err);
    }

    if (actor) {
      await recordAuditLogEntry(community.id, actor, {
        action_type: "safety_update",
        target_type: "safety",
        metadata: {
          field: "Nível de verificação",
          changes: [
            {
              field: "Nível de verificação",
              before: verificationLabels[oldLevel],
              after: verificationLabels[level],
            },
          ],
        },
      });
    }

    triggerFeedback();
  };

  const handleSelectContentFilter = async (filter: ContentFilterLevel) => {
    if (!editable || filter === contentFilter) return;
    const oldFilter = contentFilter;
    setContentFilter(filter);
    try {
      localStorage.setItem(
        `lyc_community_content_filter_${community.id}`,
        filter,
      );
      community.content_filter = filter;
      await communityAction("edit_community", {
        community_id: community.id,
        content_filter: filter,
      });
    } catch (err) {
      console.error("[CommunitySafetyView] Failed to save content filter:", err);
    }

    if (actor) {
      await recordAuditLogEntry(community.id, actor, {
        action_type: "safety_update",
        target_type: "safety",
        metadata: {
          field: "Filtro de conteúdo explícito",
          changes: [
            {
              field: "Filtro de conteúdo",
              before: contentFilterLabels[oldFilter],
              after: contentFilterLabels[filter],
            },
          ],
        },
      });
    }

    triggerFeedback();
  };

  const triggerFeedback = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <section className="community-safety-section" aria-labelledby="safety-view-title">
      {/* Header */}
      <div className="safety-main-header">
        <div>
          <h2 id="safety-view-title" className="server-settings-title">
            Configurações de Segurança
          </h2>
          <p className="server-settings-description">
            Configure o nível de verificação de novos membros e as políticas de proteção da comunidade.
          </p>
        </div>

        {savedFeedback && (
          <div className="safety-save-toast">
            <Check size={14} />
            <span>Preferência atualizada</span>
          </div>
        )}
      </div>

      <div className="safety-blocks-container">
        {/* SEÇÃO 1: NÍVEL DE VERIFICAÇÃO */}
        <div className="safety-block-card">
          <div className="safety-block-header">
            <div className="safety-block-title-row">
              <ShieldCheck size={20} className="safety-icon-primary" />
              <div>
                <h3 className="safety-block-title">Nível de verificação</h3>
                <p className="safety-block-subtitle">
                  Defina os requisitos necessários para participar da comunidade.
                </p>
              </div>
            </div>
            <span className="safety-status-badge active">
              Diretriz Ativa
            </span>
          </div>

          <div className="safety-options-list">
            {/* Opção: Nenhum */}
            <div
              className={`safety-option-item ${
                verificationLevel === "none" ? "selected" : ""
              } ${!editable ? "disabled" : ""}`}
              onClick={() => handleSelectVerification("none")}
            >
              <div className="safety-option-radio">
                <div
                  className={`safety-radio-dot ${
                    verificationLevel === "none" ? "checked" : ""
                  }`}
                />
              </div>
              <div className="safety-option-content">
                <div className="safety-option-name-row">
                  <strong className="safety-option-name">Nenhum</strong>
                </div>
                <span className="safety-option-desc">
                  Sem restrições de entrada. Qualquer usuário com convite pode interagir imediatamente.
                </span>
              </div>
            </div>

            {/* Opção: Baixo */}
            <div
              className={`safety-option-item ${
                verificationLevel === "low" ? "selected" : ""
              } ${!editable ? "disabled" : ""}`}
              onClick={() => handleSelectVerification("low")}
            >
              <div className="safety-option-radio">
                <div
                  className={`safety-radio-dot ${
                    verificationLevel === "low" ? "checked" : ""
                  }`}
                />
              </div>
              <div className="safety-option-content">
                <div className="safety-option-name-row">
                  <strong className="safety-option-name">Baixo</strong>
                  <span className="safety-tag-pill recommended">Padrão</span>
                </div>
                <span className="safety-option-desc">
                  Deve ter um endereço de e-mail verificado em sua conta LYC Arena.
                </span>
              </div>
            </div>

            {/* Opção: Médio */}
            <div
              className={`safety-option-item ${
                verificationLevel === "medium" ? "selected" : ""
              } ${!editable ? "disabled" : ""}`}
              onClick={() => handleSelectVerification("medium")}
            >
              <div className="safety-option-radio">
                <div
                  className={`safety-radio-dot ${
                    verificationLevel === "medium" ? "checked" : ""
                  }`}
                />
              </div>
              <div className="safety-option-content">
                <div className="safety-option-name-row">
                  <strong className="safety-option-name">Médio</strong>
                </div>
                <span className="safety-option-desc">
                  Também deve estar registrado na plataforma LYC Arena há mais de 5 minutos.
                </span>
              </div>
            </div>

            {/* Opção: Alto */}
            <div
              className={`safety-option-item ${
                verificationLevel === "high" ? "selected" : ""
              } ${!editable ? "disabled" : ""}`}
              onClick={() => handleSelectVerification("high")}
            >
              <div className="safety-option-radio">
                <div
                  className={`safety-radio-dot ${
                    verificationLevel === "high" ? "checked" : ""
                  }`}
                />
              </div>
              <div className="safety-option-content">
                <div className="safety-option-name-row">
                  <strong className="safety-option-name">Alto</strong>
                </div>
                <span className="safety-option-desc">
                  Também deve ser membro desta comunidade há pelo menos 10 minutos para enviar mensagens.
                </span>
              </div>
            </div>

            {/* Opção: Máximo */}
            <div
              className={`safety-option-item ${
                verificationLevel === "highest" ? "selected" : ""
              } ${!editable ? "disabled" : ""}`}
              onClick={() => handleSelectVerification("highest")}
            >
              <div className="safety-option-radio">
                <div
                  className={`safety-radio-dot ${
                    verificationLevel === "highest" ? "checked" : ""
                  }`}
                />
              </div>
              <div className="safety-option-content">
                <div className="safety-option-name-row">
                  <strong className="safety-option-name">Máximo</strong>
                  <span className="safety-tag-pill high-sec">Segurança Reforçada</span>
                </div>
                <span className="safety-option-desc">
                  Deve ter um número de telefone verificado vinculado à sua conta da LYC Arena.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: FILTRO DE CONTEÚDO */}
        <div className="safety-block-card">
          <div className="safety-block-header">
            <div className="safety-block-title-row">
              <Filter size={20} className="safety-icon-primary" />
              <div>
                <h3 className="safety-block-title">Filtro de conteúdo</h3>
                <p className="safety-block-subtitle">
                  Analise e filtre automaticamente mensagens enviadas com conteúdo impróprio ou suspeito.
                </p>
              </div>
            </div>
            <span className="safety-status-badge upcoming">
              Triagem de Mídia
            </span>
          </div>

          <div className="safety-options-list">
            <div
              className={`safety-option-item ${
                contentFilter === "disabled" ? "selected" : ""
              } ${!editable ? "disabled" : ""}`}
              onClick={() => handleSelectContentFilter("disabled")}
            >
              <div className="safety-option-radio">
                <div
                  className={`safety-radio-dot ${
                    contentFilter === "disabled" ? "checked" : ""
                  }`}
                />
              </div>
              <div className="safety-option-content">
                <strong className="safety-option-name">Não verificar</strong>
                <span className="safety-option-desc">
                  Não analisar mensagens ou mídias enviadas na comunidade.
                </span>
              </div>
            </div>

            <div
              className={`safety-option-item ${
                contentFilter === "norole" ? "selected" : ""
              } ${!editable ? "disabled" : ""}`}
              onClick={() => handleSelectContentFilter("norole")}
            >
              <div className="safety-option-radio">
                <div
                  className={`safety-radio-dot ${
                    contentFilter === "norole" ? "checked" : ""
                  }`}
                />
              </div>
              <div className="safety-option-content">
                <div className="safety-option-name-row">
                  <strong className="safety-option-name">
                    Verificar conteúdo de membros sem cargo
                  </strong>
                  <span className="safety-tag-pill recommended">Recomendado</span>
                </div>
                <span className="safety-option-desc">
                  Analisa mídias e links de todos os participantes que não possuam cargos atribuídos.
                </span>
              </div>
            </div>

            <div
              className={`safety-option-item ${
                contentFilter === "all" ? "selected" : ""
              } ${!editable ? "disabled" : ""}`}
              onClick={() => handleSelectContentFilter("all")}
            >
              <div className="safety-option-radio">
                <div
                  className={`safety-radio-dot ${
                    contentFilter === "all" ? "checked" : ""
                  }`}
                />
              </div>
              <div className="safety-option-content">
                <strong className="safety-option-name">
                  Verificar conteúdo de todos os membros
                </strong>
                <span className="safety-option-desc">
                  Analisa as mensagens e mídias de todos os membros, exceto proprietários.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: PROTEÇÃO DA COMUNIDADE */}
        <div className="safety-block-card">
          <div className="safety-block-header">
            <div className="safety-block-title-row">
              <Flame size={20} className="safety-icon-primary" />
              <div>
                <h3 className="safety-block-title">Proteção da comunidade</h3>
                <p className="safety-block-subtitle">
                  Ferramentas ativas de mitigação contra incidentes, spam e raid no servidor.
                </p>
              </div>
            </div>
            <span className="safety-status-badge planned">
              <Sparkles size={11} /> Em desenvolvimento
            </span>
          </div>

          <div className="safety-protections-grid">
            <div className="safety-protection-card">
              <div className="safety-protection-info">
                <div className="safety-protection-title-row">
                  <AlertTriangle size={15} color="#f0b232" />
                  <strong>Proteção contra Spam</strong>
                </div>
                <p className="safety-protection-desc">
                  Aplica rate-limit automático e silencia temporariamente contas que enviam mensagens repetidas em alta velocidade.
                </p>
              </div>
              <span className="safety-feature-badge">Planejado</span>
            </div>

            <div className="safety-protection-card">
              <div className="safety-protection-info">
                <div className="safety-protection-title-row">
                  <ShieldCheck size={15} color="#5865f2" />
                  <strong>Filtro de Links Suspeitos</strong>
                </div>
                <p className="safety-protection-desc">
                  Bloqueia links externos não verificados ou que pertençam a domínios com histórico malicioso reportado.
                </p>
              </div>
              <span className="safety-feature-badge">Planejado</span>
            </div>

            <div className="safety-protection-card">
              <div className="safety-protection-info">
                <div className="safety-protection-title-row">
                  <Flame size={15} color="#f23f43" />
                  <strong>Alerta de Atividade Incomum (Raid)</strong>
                </div>
                <p className="safety-protection-desc">
                  Notifica a equipe e pausa temporariamente convites se houver um pico repentino e anômalo de novos ingressos.
                </p>
              </div>
              <span className="safety-feature-badge">Planejado</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
