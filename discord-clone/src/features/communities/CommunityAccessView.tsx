import { useMemo } from "react";
import {
  KeyRound,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Lock,
  Globe,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { Community, CommunityRole } from "../../services/communities";
import { getRoleColor } from "./RolesManagerView";

export function CommunityAccessView({
  community,
  roles,
  onNavigateToRoles,
}: {
  community: Community;
  roles: CommunityRole[];
  onNavigateToRoles?: () => void;
}) {
  // Find default MEMBER role
  const defaultRole = useMemo(() => {
    return (
      roles.find((r) => r.base_role === "MEMBER") || {
        id: "default-member",
        name: "Membro",
        base_role: "MEMBER",
        position: 0,
        permissions: ["send_messages", "connect_voice", "speak", "share_screen"],
      }
    );
  }, [roles]);

  const defaultRoleColor = getRoleColor(community.id, defaultRole);

  return (
    <section className="community-access-section" aria-labelledby="access-view-title">
      {/* Header */}
      <div className="access-main-header">
        <h2 id="access-view-title" className="server-settings-title">
          Acesso à comunidade
        </h2>
        <p className="server-settings-description">
          Centralize as regras de entrada, cargo padrão de novos participantes e requisitos de segurança.
        </p>
      </div>

      <div className="access-blocks-container">
        {/* BLOCO 1: ACESSO À COMUNIDADE */}
        <div className="access-block-card">
          <div className="access-block-header">
            <div className="access-block-title-row">
              <KeyRound size={20} className="access-icon-primary" />
              <div>
                <h3 className="access-block-title">Método de Entrada</h3>
                <p className="access-block-subtitle">
                  Como novos usuários encontram e entram nesta comunidade.
                </p>
              </div>
            </div>
            <span className="access-status-pill active">
              <CheckCircle2 size={12} />
              Configuração Ativa
            </span>
          </div>

          <div className="access-methods-grid">
            {/* Active method: Convite Direto */}
            <div className="access-method-item selected">
              <div className="access-method-item-header">
                <div className="access-method-item-icon">
                  <Lock size={18} color="#23a55a" />
                </div>
                <div className="access-method-item-info">
                  <strong>Acesso por Convite Direto</strong>
                  <span className="access-method-badge current">Padrão Seguro</span>
                </div>
              </div>
              <p className="access-method-item-desc">
                Somente usuários com um código ou link de convite válido gerado pela equipe podem ingressar nesta comunidade.
              </p>
            </div>

            {/* Future method: Descoberta Pública */}
            <div className="access-method-item disabled">
              <div className="access-method-item-header">
                <div className="access-method-item-icon">
                  <Globe size={18} color="#949ba4" />
                </div>
                <div className="access-method-item-info">
                  <strong>Comunidade Pública / Descoberta</strong>
                  <span className="access-method-badge planned">
                    <Sparkles size={11} /> Em breve
                  </span>
                </div>
              </div>
              <p className="access-method-item-desc">
                Permitirá que a comunidade apareça na lista de servidores públicos da LYC Arena e receba membros sem convite prévio.
              </p>
            </div>
          </div>
        </div>

        {/* BLOCO 2: CARGO PADRÃO */}
        <div className="access-block-card">
          <div className="access-block-header">
            <div className="access-block-title-row">
              <UserCheck size={20} className="access-icon-primary" />
              <div>
                <h3 className="access-block-title">Cargo Padrão de Novos Membros</h3>
                <p className="access-block-subtitle">
                  Cargo atribuído automaticamente quando um membro entra pelo convite.
                </p>
              </div>
            </div>
          </div>

          <div className="access-default-role-panel">
            <div className="access-default-role-info">
              <span
                className="role-color-dot"
                style={{ background: defaultRoleColor }}
              />
              <div className="access-default-role-text">
                <div className="access-default-role-name-row">
                  <strong className="access-default-role-name">
                    {defaultRole.name}
                  </strong>
                  <span className="access-role-system-badge">
                    Cargo Base do Sistema
                  </span>
                </div>
                <span className="access-default-role-desc">
                  Todos os novos participantes recebem este cargo imediatamente ao entrar.
                </span>
              </div>
            </div>

            {onNavigateToRoles && (
              <button
                type="button"
                className="server-btn server-btn-secondary access-manage-roles-btn"
                onClick={onNavigateToRoles}
              >
                <span>Configurar permissões em Cargos</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* BLOCO 3: REQUISITOS DE ENTRADA */}
        <div className="access-block-card">
          <div className="access-block-header">
            <div className="access-block-title-row">
              <ShieldCheck size={20} className="access-icon-primary" />
              <div>
                <h3 className="access-block-title">Requisitos de Entrada</h3>
                <p className="access-block-subtitle">
                  Critérios de triagem e verificação para proteção contra acessos indesejados.
                </p>
              </div>
            </div>
            <span className="access-status-pill upcoming">
              Recursos Planejados
            </span>
          </div>

          <div className="access-requirements-list">
            {/* Req 1: Conta Verificada */}
            <div className="access-requirement-row">
              <div className="access-req-info">
                <div className="access-req-title-row">
                  <span className="access-req-title">Conta Verificada</span>
                  <span className="access-req-badge">Próxima versão</span>
                </div>
                <span className="access-req-desc">
                  Exige que o membro possua e-mail autenticado na plataforma LYC antes de ingressar.
                </span>
              </div>
              <label className="role-switch">
                <input type="checkbox" disabled checked={false} />
                <span className="role-switch-slider" />
              </label>
            </div>

            {/* Req 2: Regras da Comunidade */}
            <div className="access-requirement-row">
              <div className="access-req-info">
                <div className="access-req-title-row">
                  <span className="access-req-title">
                    Aceite das Regras da Comunidade
                  </span>
                  <span className="access-req-badge">Próxima versão</span>
                </div>
                <span className="access-req-desc">
                  Obrigatório confirmar leitura das diretrizes do servidor antes de poder interagir nos canais de texto e salas de voz.
                </span>
              </div>
              <label className="role-switch">
                <input type="checkbox" disabled checked={false} />
                <span className="role-switch-slider" />
              </label>
            </div>

            {/* Req 3: Tempo de Conta */}
            <div className="access-requirement-row">
              <div className="access-req-info">
                <div className="access-req-title-row">
                  <span className="access-req-title">
                    Tempo Mínimo de Registro
                  </span>
                  <span className="access-req-badge">Próxima versão</span>
                </div>
                <span className="access-req-desc">
                  O participante deve possuir conta na LYC Arena há pelo menos 10 minutos para poder participar.
                </span>
              </div>
              <label className="role-switch">
                <input type="checkbox" disabled checked={false} />
                <span className="role-switch-slider" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
