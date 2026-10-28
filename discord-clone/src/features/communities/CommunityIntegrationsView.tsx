import { useState, useEffect, useMemo } from "react";
import {
  Webhook,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Trash2,
  Send,
  AlertCircle,
  Radio,
  X,
  Hash,
} from "lucide-react";
import type { Community } from "../../services/communities";
import type { Channel } from "../../types";
import {
  loadCommunityWebhooks,
  createCommunityWebhook,
  updateCommunityWebhook,
  regenerateCommunityWebhookToken,
  deleteCommunityWebhook,
  executeWebhookMessage,
  loadCommunityIntegrations,
  toggleCommunityIntegration,
  buildWebhookUrl,
  type CommunityWebhook,
  type CommunityIntegration,
} from "../../services/community-webhooks";
import { recordAuditLogEntry } from "../../services/community-audit";
import "./community-settings.css";

interface CommunityIntegrationsViewProps {
  community: Community;
  channels: Channel[];
  canManage: boolean;
  actor: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  };
}

export function CommunityIntegrationsView({
  community,
  channels,
  canManage,
  actor,
}: CommunityIntegrationsViewProps) {
  const [webhooks, setWebhooks] = useState<CommunityWebhook[]>([]);
  const [integrations, setIntegrations] = useState<CommunityIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState<CommunityWebhook | null>(null);
  const [regenerateModalItem, setRegenerateModalItem] = useState<CommunityWebhook | null>(null);
  const [deleteModalItem, setDeleteModalItem] = useState<CommunityWebhook | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formChannelId, setFormChannelId] = useState("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Text channels available for webhooks
  const textChannels = useMemo(() => {
    return channels.filter((c) => c.kind === "text" && !c.deleted_at);
  }, [channels]);

  // Channel lookup helper
  const getChannelName = (channelId: string) => {
    const ch = channels.find((c) => c.id === channelId);
    return ch ? ch.name : "canal-desconhecido";
  };

  const reloadData = async () => {
    try {
      setLoading(true);
      const [whList, intList] = await Promise.all([
        loadCommunityWebhooks(community.id),
        loadCommunityIntegrations(community.id),
      ]);
      setWebhooks(whList);
      setIntegrations(intList);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadData();
  }, [community.id]);

  const showSuccessFeedback = (msg: string) => {
    setFeedbackSuccess(msg);
    setTimeout(() => setFeedbackSuccess(null), 3500);
  };

  const handleCopyUrl = async (wh: CommunityWebhook) => {
    try {
      const url = buildWebhookUrl(wh.id, wh.token);
      await navigator.clipboard.writeText(url);
      setCopiedWebhookId(wh.id);
      setTimeout(() => setCopiedWebhookId(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleOpenCreateModal = () => {
    setFormName("Webhook da Comunidade");
    setFormChannelId(textChannels[0]?.id || "");
    setFormAvatarUrl("");
    setFormIsActive(true);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (wh: CommunityWebhook) => {
    setEditModalItem(wh);
    setFormName(wh.name);
    setFormChannelId(wh.channel_id);
    setFormAvatarUrl(wh.avatar_url || "");
    setFormIsActive(wh.is_active);
    setFormError(null);
  };

  const handleCreateWebhook = async () => {
    if (!formName.trim() || formName.trim().length < 2) {
      setFormError("O nome do webhook deve ter entre 2 e 64 caracteres.");
      return;
    }
    if (!formChannelId) {
      setFormError("Selecione um canal de destino válido.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const created = await createCommunityWebhook(community.id, {
        name: formName.trim(),
        channel_id: formChannelId,
        avatar_url: formAvatarUrl.trim() || null,
        created_by: actor.id,
        creator_name: actor.display_name,
      });

      // Record Audit Log without leaking the secret token!
      recordAuditLogEntry(community.id, actor, {
        action_type: "webhook_create",
        target_type: "webhook",
        target_name: created.name,
        target_id: created.id,
        metadata: {
          channel_id: created.channel_id,
          channel_name: getChannelName(created.channel_id),
        },
      });

      setWebhooks((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
      showSuccessFeedback(`Webhook "${created.name}" criado com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar webhook.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModalItem) return;
    if (!formName.trim() || formName.trim().length < 2) {
      setFormError("O nome do webhook deve ter entre 2 e 64 caracteres.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const updated = await updateCommunityWebhook(community.id, editModalItem.id, {
        name: formName.trim(),
        channel_id: formChannelId,
        avatar_url: formAvatarUrl.trim() || null,
        is_active: formIsActive,
      });

      // Audit Log
      recordAuditLogEntry(community.id, actor, {
        action_type: "webhook_update",
        target_type: "webhook",
        target_name: updated.name,
        target_id: updated.id,
        metadata: {
          channel_id: updated.channel_id,
          channel_name: getChannelName(updated.channel_id),
          is_active: updated.is_active,
        },
      });

      setWebhooks((prev) =>
        prev.map((w) => (w.id === updated.id ? updated : w)),
      );
      setEditModalItem(null);
      showSuccessFeedback(`Webhook atualizado com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar webhook.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!regenerateModalItem) return;
    try {
      setSubmitting(true);
      const res = await regenerateCommunityWebhookToken(
        community.id,
        regenerateModalItem.id,
      );

      // Audit Log
      recordAuditLogEntry(community.id, actor, {
        action_type: "webhook_token_regenerate",
        target_type: "webhook",
        target_name: regenerateModalItem.name,
        target_id: regenerateModalItem.id,
        metadata: {
          reason: "Chave de acesso regenerada pelo administrador",
        },
      });

      setWebhooks((prev) =>
        prev.map((w) =>
          w.id === res.id ? { ...w, token: res.token, updated_at: new Date().toISOString() } : w,
        ),
      );
      setRegenerateModalItem(null);
      showSuccessFeedback(`Chave de acesso regenerada! O token anterior foi invalidado.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao regenerar token.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!deleteModalItem) return;
    try {
      setSubmitting(true);
      await deleteCommunityWebhook(community.id, deleteModalItem.id);

      // Audit Log
      recordAuditLogEntry(community.id, actor, {
        action_type: "webhook_delete",
        target_type: "webhook",
        target_name: deleteModalItem.name,
        target_id: deleteModalItem.id,
        metadata: {
          channel_id: deleteModalItem.channel_id,
          channel_name: getChannelName(deleteModalItem.channel_id),
        },
      });

      setWebhooks((prev) => prev.filter((w) => w.id !== deleteModalItem.id));
      setDeleteModalItem(null);
      showSuccessFeedback(`Webhook excluído com sucesso.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir webhook.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestMessage = async (wh: CommunityWebhook) => {
    try {
      setTestingWebhookId(wh.id);
      await executeWebhookMessage(community.id, wh.id, wh.token, {
        content: `👋 Mensagem de teste enviada com sucesso pelo webhook **${wh.name}**!`,
      });
      showSuccessFeedback(
        `Mensagem de teste enviada para #${getChannelName(wh.channel_id)}!`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao testar envio.";
      alert(msg);
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleToggleIntegration = async (intItem: CommunityIntegration) => {
    try {
      const nextActive = !intItem.is_active;
      const updated = await toggleCommunityIntegration(
        community.id,
        intItem.id,
        nextActive,
      );
      setIntegrations((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      recordAuditLogEntry(community.id, actor, {
        action_type: nextActive ? "integration_connect" : "integration_disconnect",
        target_type: "integration",
        target_name: updated.name,
        target_id: updated.id,
        metadata: { status: updated.status },
      });
    } catch {
      // ignore
    }
  };

  return (
    <section className="server-integrations-view" aria-label="Integrações">
      {/* Header */}
      <header className="server-settings-header-block">
        <h2 className="server-settings-title">Integrações</h2>
        <p className="server-settings-description">
          Conecte serviços e automações à sua comunidade.
        </p>
      </header>

      {/* Success Notification */}
      {feedbackSuccess && (
        <div className="server-settings-alert success" style={{ marginBottom: "16px" }}>
          <Check size={16} />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SEÇÃO 1: INTEGRAÇÕES CONECTADAS */}
      {/* ---------------------------------------------------- */}
      <div className="server-section-panel" style={{ marginBottom: "28px" }}>
        <div className="integration-section-header">
          <div>
            <h3 className="integration-subtitle">INTEGRAÇÕES CONECTADAS</h3>
            <p className="integration-subdesc">
              Lista das integrações atualmente vinculadas à comunidade.
            </p>
          </div>
        </div>

        {integrations.length === 0 ? (
          <div className="integration-empty-card">
            <Radio size={32} className="integration-empty-icon" />
            <div className="integration-empty-title">Nenhuma integração conectada.</div>
            <div className="integration-empty-desc">
              Conecte serviços para ampliar os recursos da sua comunidade.
            </div>
          </div>
        ) : (
          <div className="integration-list">
            {integrations.map((item) => (
              <div key={item.id} className="integration-item-row">
                <div className="integration-item-icon">
                  {item.icon_url ? (
                    <img src={item.icon_url} alt={item.name} />
                  ) : (
                    <Radio size={20} color="#5865f2" />
                  )}
                </div>
                <div className="integration-item-info">
                  <div className="integration-item-name">{item.name}</div>
                  <div className="integration-item-desc">{item.description}</div>
                </div>
                <div className="integration-item-meta">
                  <span
                    className={`integration-status-badge ${
                      item.status === "Conectado"
                        ? "connected"
                        : item.status === "Erro"
                          ? "error"
                          : "inactive"
                    }`}
                  >
                    {item.status}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      className="server-btn server-btn-secondary server-btn-sm"
                      onClick={() => handleToggleIntegration(item)}
                    >
                      {item.is_active ? "Desativar" : "Ativar"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* SEÇÃO 2: WEBHOOKS */}
      {/* ---------------------------------------------------- */}
      <div className="server-section-panel">
        <div className="integration-section-header">
          <div>
            <h3 className="integration-subtitle">WEBHOOKS</h3>
            <p className="integration-subdesc">
              Permita que serviços externos enviem informações para canais da comunidade.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              className="server-btn server-btn-primary"
              onClick={handleOpenCreateModal}
              disabled={loading || textChannels.length === 0}
              title={
                textChannels.length === 0
                  ? "Crie um canal de texto antes de adicionar webhooks."
                  : "Criar novo webhook"
              }
            >
              <Plus size={16} />
              <span>Criar webhook</span>
            </button>
          )}
        </div>

        {webhooks.length === 0 ? (
          <div className="integration-empty-card">
            <Webhook size={32} className="integration-empty-icon" />
            <div className="integration-empty-title">Nenhum webhook criado ainda.</div>
            <div className="integration-empty-desc">
              Crie um webhook para permitir que serviços externos enviem mensagens diretamente em seus canais de texto.
            </div>
            {canManage && textChannels.length > 0 && (
              <button
                type="button"
                className="server-btn server-btn-primary"
                style={{ marginTop: "14px" }}
                onClick={handleOpenCreateModal}
              >
                Criar webhook
              </button>
            )}
          </div>
        ) : (
          <div className="webhook-list">
            {webhooks.map((wh) => {
              const isCopied = copiedWebhookId === wh.id;
              const isTesting = testingWebhookId === wh.id;
              const usableUrl = buildWebhookUrl(wh.id, wh.token);

              return (
                <div key={wh.id} className="webhook-item-card">
                  <div className="webhook-item-header">
                    <div className="webhook-item-avatar">
                      {wh.avatar_url ? (
                        <img src={wh.avatar_url} alt={wh.name} />
                      ) : (
                        <Webhook size={22} color="#5865f2" />
                      )}
                    </div>
                    <div className="webhook-item-details">
                      <div className="webhook-item-title-row">
                        <span className="webhook-item-name">{wh.name}</span>
                        <span className="webhook-channel-tag">
                          <Hash size={13} />
                          {getChannelName(wh.channel_id)}
                        </span>
                        {!wh.is_active && (
                          <span className="webhook-inactive-tag">Desativado</span>
                        )}
                      </div>
                      <div className="webhook-item-url-row">
                        <span className="webhook-url-mask" title="URL do Webhook">
                          {usableUrl.replace(/(token=)(.*)/, "$1lyc_wh_••••••••••••••••")}
                        </span>
                      </div>
                    </div>

                    <div className="webhook-item-actions">
                      <button
                        type="button"
                        className={`server-btn ${
                          isCopied ? "server-btn-success" : "server-btn-secondary"
                        } server-btn-sm`}
                        onClick={() => handleCopyUrl(wh)}
                        title="Copiar URL utilizável para o webhook"
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{isCopied ? "Copiado!" : "Copiar URL"}</span>
                      </button>

                      {canManage && (
                        <>
                          <button
                            type="button"
                            className="server-btn server-btn-secondary server-btn-sm"
                            onClick={() => handleTestMessage(wh)}
                            disabled={isTesting || !wh.is_active}
                            title="Enviar mensagem de teste para o canal"
                          >
                            <Send size={14} />
                            <span>{isTesting ? "Enviando..." : "Testar"}</span>
                          </button>

                          <button
                            type="button"
                            className="expression-action-btn"
                            onClick={() => setRegenerateModalItem(wh)}
                            title="Regenerar chave de acesso"
                          >
                            <RefreshCw size={14} />
                          </button>

                          <button
                            type="button"
                            className="expression-action-btn"
                            onClick={() => handleOpenEditModal(wh)}
                            title="Editar webhook"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            className="expression-action-btn danger"
                            onClick={() => setDeleteModalItem(wh)}
                            title="Excluir webhook"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: CRIAR WEBHOOK */}
      {/* ---------------------------------------------------- */}
      {isCreateModalOpen && (
        <div className="expression-modal-backdrop" role="dialog" aria-modal="true">
          <div className="expression-modal" style={{ maxWidth: "480px" }}>
            <div className="expression-modal-header">
              <h3 className="expression-modal-title">Criar Webhook</h3>
              <button
                type="button"
                className="expression-modal-close"
                onClick={() => setIsCreateModalOpen(false)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="expression-modal-body">
              {formError && (
                <div className="server-settings-alert error" style={{ marginBottom: "16px" }}>
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="expression-form-group">
                <label className="expression-form-label" htmlFor="wh-create-name">
                  NOME DO WEBHOOK
                </label>
                <input
                  id="wh-create-name"
                  type="text"
                  className="expression-form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: GitHub Releases"
                  maxLength={64}
                />
              </div>

              <div className="expression-form-group">
                <label className="expression-form-label" htmlFor="wh-create-channel">
                  CANAL DE DESTINO
                </label>
                <select
                  id="wh-create-channel"
                  className="expression-form-input"
                  value={formChannelId}
                  onChange={(e) => setFormChannelId(e.target.value)}
                >
                  {textChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      # {c.name}
                    </option>
                  ))}
                </select>
                <div className="expression-form-help">
                  Canal onde as mensagens recebidas serão publicadas.
                </div>
              </div>

              <div className="expression-form-group">
                <label className="expression-form-label" htmlFor="wh-create-avatar">
                  AVATAR DO WEBHOOK (OPCIONAL)
                </label>
                <input
                  id="wh-create-avatar"
                  type="text"
                  className="expression-form-input"
                  value={formAvatarUrl}
                  onChange={(e) => setFormAvatarUrl(e.target.value)}
                  placeholder="https://exemplo.com/avatar.png"
                />
              </div>
            </div>

            <div className="expression-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-primary"
                onClick={handleCreateWebhook}
                disabled={submitting}
              >
                {submitting ? "Criando..." : "Criar webhook"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: EDITAR WEBHOOK */}
      {/* ---------------------------------------------------- */}
      {editModalItem && (
        <div className="expression-modal-backdrop" role="dialog" aria-modal="true">
          <div className="expression-modal" style={{ maxWidth: "480px" }}>
            <div className="expression-modal-header">
              <h3 className="expression-modal-title">Editar Webhook</h3>
              <button
                type="button"
                className="expression-modal-close"
                onClick={() => setEditModalItem(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="expression-modal-body">
              {formError && (
                <div className="server-settings-alert error" style={{ marginBottom: "16px" }}>
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="expression-form-group">
                <label className="expression-form-label" htmlFor="wh-edit-name">
                  NOME DO WEBHOOK
                </label>
                <input
                  id="wh-edit-name"
                  type="text"
                  className="expression-form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={64}
                />
              </div>

              <div className="expression-form-group">
                <label className="expression-form-label" htmlFor="wh-edit-channel">
                  CANAL DE DESTINO
                </label>
                <select
                  id="wh-edit-channel"
                  className="expression-form-input"
                  value={formChannelId}
                  onChange={(e) => setFormChannelId(e.target.value)}
                >
                  {textChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      # {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="expression-form-group">
                <label className="expression-form-label" htmlFor="wh-edit-avatar">
                  AVATAR DO WEBHOOK
                </label>
                <input
                  id="wh-edit-avatar"
                  type="text"
                  className="expression-form-input"
                  value={formAvatarUrl}
                  onChange={(e) => setFormAvatarUrl(e.target.value)}
                  placeholder="https://exemplo.com/avatar.png"
                />
              </div>

              <div className="expression-form-group" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  id="wh-edit-active"
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label htmlFor="wh-edit-active" style={{ fontSize: "14px", color: "#f2f3f5", cursor: "pointer" }}>
                  Webhook ativo (habilitado para receber mensagens)
                </label>
              </div>
            </div>

            <div className="expression-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setEditModalItem(null)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-primary"
                onClick={handleSaveEdit}
                disabled={submitting}
              >
                {submitting ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: REGENERAR TOKEN */}
      {/* ---------------------------------------------------- */}
      {regenerateModalItem && (
        <div className="expression-modal-backdrop" role="dialog" aria-modal="true">
          <div className="expression-modal" style={{ maxWidth: "440px" }}>
            <div className="expression-modal-header">
              <h3 className="expression-modal-title">Regenerar chave de acesso?</h3>
              <button
                type="button"
                className="expression-modal-close"
                onClick={() => setRegenerateModalItem(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="expression-modal-body">
              <p style={{ color: "#dbdee1", fontSize: "14px", lineHeight: "1.5" }}>
                Você tem certeza de que deseja regenerar a chave de acesso do webhook{" "}
                <strong style={{ color: "#ffffff" }}>{regenerateModalItem.name}</strong>?
              </p>
              <div
                className="server-settings-alert warning"
                style={{ marginTop: "14px", fontSize: "13px" }}
              >
                <AlertCircle size={16} />
                <span>
                  A URL anterior deixará de funcionar imediatamente. Qualquer serviço externo que utilize o token antigo não conseguirá mais enviar mensagens.
                </span>
              </div>
            </div>

            <div className="expression-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setRegenerateModalItem(null)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-danger"
                onClick={handleRegenerateToken}
                disabled={submitting}
              >
                {submitting ? "Regenerando..." : "Regenerar chave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: EXCLUIR WEBHOOK */}
      {/* ---------------------------------------------------- */}
      {deleteModalItem && (
        <div className="expression-modal-backdrop" role="dialog" aria-modal="true">
          <div className="expression-modal" style={{ maxWidth: "440px" }}>
            <div className="expression-modal-header">
              <h3 className="expression-modal-title">Excluir Webhook</h3>
              <button
                type="button"
                className="expression-modal-close"
                onClick={() => setDeleteModalItem(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="expression-modal-body">
              <p style={{ color: "#dbdee1", fontSize: "14px", lineHeight: "1.5" }}>
                Tem certeza de que deseja excluir permanentemente o webhook{" "}
                <strong style={{ color: "#ffffff" }}>{deleteModalItem.name}</strong>?
              </p>
              <p style={{ color: "#949ba4", fontSize: "13px", marginTop: "8px" }}>
                Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="expression-modal-footer">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setDeleteModalItem(null)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-danger"
                onClick={handleDeleteWebhook}
                disabled={submitting}
              >
                {submitting ? "Excluindo..." : "Excluir webhook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
