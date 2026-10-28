import { useState, useEffect, useMemo, useRef } from "react";
import { X, Shield, AlertCircle } from "lucide-react";
import { ErrorNotice, useTask } from "../../components/ui";
import {
  communityAction,
  type Community,
  type Member,
  type CommunityRole,
} from "../../services/communities";
import {
  uploadCommunityMedia,
  validateCommunityName,
  validateCommunityDescription,
  canManageCommunity,
  COMMUNITY_MEDIA_ACCEPT,
} from "../../services/community-media";
import { RolesManagerView } from "./RolesManagerView";
import { CommunityMembersView } from "./CommunityMembersView";
import { CommunityInvitesView } from "./CommunityInvitesView";
import { CommunityAccessView } from "./CommunityAccessView";
import { CommunitySafetyView } from "./CommunitySafetyView";
import { CommunityBansView } from "./CommunityBansView";
import { CommunityAuditLogView } from "./CommunityAuditLogView";
import { CommunityExpressionsView } from "./CommunityExpressionsView";
import { CommunityIntegrationsView } from "./CommunityIntegrationsView";
import {
  recordAuditLogEntry,
  type AuditChangeDetail,
} from "../../services/community-audit";
import {
  loadCommunityNotificationLevel,
  saveCommunityNotificationLevel,
  type CommunityNotificationLevel,
} from "../../services/notifications";
import type { Channel } from "../../types";
import "./community-settings.css";

export type ServerSettingsSection =
  | "overview"
  | "tag"
  | "engagement"
  | "emojis"
  | "stickers"
  | "soundboard"
  | "members"
  | "roles"
  | "invites"
  | "access"
  | "integrations"
  | "safety"
  | "audit_log"
  | "bans"
  | "template"
  | "delete_server";

interface NavGroup {
  title: string;
  items: {
    id: ServerSettingsSection;
    label: string;
    danger?: boolean;
    badge?: string;
  }[];
}

export function CommunitySettings({
  community,
  channels,
  members,
  roles,
  permissions,
  userId,
  presence = {},
  initialSection = "overview",
  onClose,
  onChanged,
  onSelectCommunity: _onSelectCommunity,
}: {
  community: Community;
  channels: Channel[];
  members: Member[];
  roles: CommunityRole[];
  permissions: string[];
  userId: string;
  presence?: Record<string, string>;
  initialSection?: ServerSettingsSection;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onSelectCommunity?: (id: string) => void;
}) {
  const isOwner = community.owner_id === userId;
  const canAdmin =
    isOwner ||
    permissions.includes("manage_community") ||
    permissions.includes("manage_roles") ||
    permissions.includes("manage_channels");
  const canModerate =
    isOwner ||
    permissions.includes("moderate_members") ||
    permissions.includes("manage_community");

  const actorMember = members.find((m) => m.user_id === userId);
  const actorProfile = {
    id: userId,
    display_name: actorMember?.profiles.display_name || "Administrador",
    username: actorMember?.profiles.username || "admin",
    avatar_url: actorMember?.profiles.avatar_url,
  };

  const canManageProfile = canManageCommunity(
    community.owner_id,
    userId,
    permissions,
  );

  const [activeSection, setActiveSection] =
    useState<ServerSettingsSection>(() => {
      if (typeof window !== "undefined") {
        const p = new URLSearchParams(window.location.search).get("section");
        if (p) return p as ServerSettingsSection;
      }
      return initialSection || "overview";
    });

  if (!canAdmin) {
    return (
      <div
        className="server-settings-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Acesso restrito"
      >
        <div style={{ padding: "40px", color: "#f2f3f5" }}>
          <h2>Acesso restrito</h2>
          <p style={{ color: "#949ba4", marginTop: "8px" }}>
            Você não possui permissão administrativa nesta comunidade.
          </p>
          <button
            type="button"
            className="server-btn server-btn-primary"
            onClick={onClose}
            style={{ marginTop: "16px" }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // Initial persisted values from DB or localStorage cache
  const initialPersistedBanner =
    community.banner_url ||
    (() => {
      try {
        return (
          localStorage.getItem(`lyc_community_banner_${community.id}`) || ""
        );
      } catch {
        return "";
      }
    })();

  const initialPersistedDesc =
    community.description ||
    (() => {
      try {
        return (
          localStorage.getItem(`lyc_community_desc_${community.id}`) || ""
        );
      } catch {
        return "";
      }
    })();

  const initialPersistedTag =
    community.tag ||
    (() => {
      try {
        return (
          localStorage.getItem(`lyc_community_tag_${community.id}`) || "LYC"
        );
      } catch {
        return "LYC";
      }
    })();

  // Editable fields for Server Profile
  const [name, setName] = useState(community.name);
  const [imageUrl, setImageUrl] = useState(community.image_url || "");
  const [bannerUrl, setBannerUrl] = useState(initialPersistedBanner);
  const [description, setDescription] = useState(initialPersistedDesc);
  const [tag, setTag] = useState(initialPersistedTag);

  // Staged files for real upload
  const [stagedIconFile, setStagedIconFile] = useState<File | null>(null);
  const [stagedBannerFile, setStagedBannerFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Track initial values for dirty state
  const [initialName, setInitialName] = useState(community.name);
  const [initialImageUrl, setInitialImageUrl] = useState(
    community.image_url || "",
  );
  const [initialBannerUrl, setInitialBannerUrl] =
    useState(initialPersistedBanner);
  const [initialDesc, setInitialDesc] = useState(initialPersistedDesc);
  const [initialTag, setInitialTag] = useState(initialPersistedTag);

  const isDirty =
    name.trim() !== initialName.trim() ||
    imageUrl.trim() !== initialImageUrl.trim() ||
    bannerUrl.trim() !== initialBannerUrl.trim() ||
    description.trim() !== initialDesc.trim() ||
    tag.trim().toUpperCase() !== initialTag.trim().toUpperCase() ||
    stagedIconFile !== null ||
    stagedBannerFile !== null;

  const task = useTask();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [communityNotifLevel, setCommunityNotifLevel] =
    useState<CommunityNotificationLevel>("all");

  useEffect(() => {
    loadCommunityNotificationLevel(community.id, userId).then(
      setCommunityNotifLevel,
    );
  }, [community.id, userId]);

  const handleSaveCommunityNotifLevel = async (
    lvl: CommunityNotificationLevel,
  ) => {
    setCommunityNotifLevel(lvl);
    try {
      await saveCommunityNotificationLevel(community.id, userId, lvl);
    } catch {
      // ignore
    }
  };

  // Delete server confirmation
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // Real stats for Server Card Preview
  const onlineCount = useMemo(() => {
    return members.filter((m) => {
      const p = presence[m.user_id];
      return p && p !== "offline";
    }).length;
  }, [members, presence]);

  const totalMembers = members.length;

  // Dynamic engagement level based on real community membership
  const engagementLevel = useMemo(() => {
    if (totalMembers >= 20) {
      return { level: "Nível 3", title: "Comunidade Consolidada" };
    }
    if (totalMembers >= 5) {
      return { level: "Nível 2", title: "Comunidade Ativa" };
    }
    return { level: "Nível 1", title: "Comunidade Inicial" };
  }, [totalMembers]);

  // Server Template generator state
  const [generatedTemplateUrl, setGeneratedTemplateUrl] = useState<string | null>(
    null,
  );
  const [templateCopied, setTemplateCopied] = useState(false);

  const handleGenerateTemplate = () => {
    const templateData = {
      name: community.name,
      description: community.description || "",
      tag: community.tag || "",
      channels: channels.map((c) => ({
        name: c.name,
        kind: c.kind,
        category: c.category_id || "Canais",
      })),
      roles: roles.map((r) => ({
        name: r.name,
        permissions: r.permissions,
      })),
      created_at: new Date().toISOString(),
    };

    const encoded = btoa(
      unescape(encodeURIComponent(JSON.stringify(templateData))),
    );
    const url = `https://arena.lyc.gg/template/${community.id.slice(0, 8)}?t=${encoded.slice(0, 48)}`;
    setGeneratedTemplateUrl(url);
  };

  const handleCopyTemplate = async () => {
    if (!generatedTemplateUrl) return;
    try {
      await navigator.clipboard.writeText(generatedTemplateUrl);
      setTemplateCopied(true);
      setTimeout(() => setTemplateCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // ESC key handler to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleIconFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadError(null);
      if (iconPreviewUrl) {
        URL.revokeObjectURL(iconPreviewUrl);
      }
      const preview = URL.createObjectURL(file);
      setIconPreviewUrl(preview);
      setImageUrl(preview);
      setStagedIconFile(file);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao carregar o arquivo.";
      setUploadError(msg);
    } finally {
      if (iconFileInputRef.current) iconFileInputRef.current.value = "";
    }
  };

  const handleRemoveIcon = () => {
    if (iconPreviewUrl) {
      URL.revokeObjectURL(iconPreviewUrl);
      setIconPreviewUrl(null);
    }
    setStagedIconFile(null);
    setImageUrl("");
    setUploadError(null);
  };

  const handleBannerFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadError(null);
      if (bannerPreviewUrl) {
        URL.revokeObjectURL(bannerPreviewUrl);
      }
      const preview = URL.createObjectURL(file);
      setBannerPreviewUrl(preview);
      setBannerUrl(preview);
      setStagedBannerFile(file);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao carregar o arquivo.";
      setUploadError(msg);
    } finally {
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
    }
  };

  const handleRemoveBanner = () => {
    if (bannerPreviewUrl) {
      URL.revokeObjectURL(bannerPreviewUrl);
      setBannerPreviewUrl(null);
    }
    setStagedBannerFile(null);
    setBannerUrl("");
    setUploadError(null);
  };

  const handleReset = () => {
    if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    setStagedIconFile(null);
    setStagedBannerFile(null);
    setIconPreviewUrl(null);
    setBannerPreviewUrl(null);
    setName(initialName);
    setImageUrl(initialImageUrl);
    setBannerUrl(initialBannerUrl);
    setDescription(initialDesc);
    setTag(initialTag);
    setUploadError(null);
  };

  // Save changes handler
  const handleSave = async () => {
    const nameErr = validateCommunityName(name);
    if (nameErr) {
      setUploadError(nameErr);
      return;
    }
    const descErr = validateCommunityDescription(description);
    if (descErr) {
      setUploadError(descErr);
      return;
    }
    setUploadError(null);

    await task.run(async () => {
      let finalImageUrl = imageUrl;
      let finalBannerUrl = bannerUrl;

      // 1. Upload staged icon if any
      if (stagedIconFile) {
        try {
          const res = await uploadCommunityMedia(
            userId,
            community.id,
            "icon",
            stagedIconFile,
          );
          finalImageUrl = res.url;
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Falha no upload do ícone.";
          setUploadError(msg);
          throw new Error(msg, { cause: err });
        }
      }

      // 2. Upload staged banner if any
      if (stagedBannerFile) {
        try {
          const res = await uploadCommunityMedia(
            userId,
            community.id,
            "banner",
            stagedBannerFile,
          );
          finalBannerUrl = res.url;
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Falha no upload do banner.";
          setUploadError(msg);
          throw new Error(msg, { cause: err });
        }
      }

      // 3. Persist to backend RPC
      await communityAction("edit_community", {
        community_id: community.id,
        name: name.trim(),
        image_url: finalImageUrl.trim() || null,
        banner_url: finalBannerUrl.trim() || null,
        description: description.trim(),
        tag: tag.trim().toUpperCase() || null,
      });

      // 4. Update client-side local cache for instant UI availability
      try {
        localStorage.setItem(
          `lyc_community_banner_${community.id}`,
          finalBannerUrl.trim(),
        );
        localStorage.setItem(
          `lyc_community_desc_${community.id}`,
          description.trim(),
        );
        localStorage.setItem(
          `lyc_community_tag_${community.id}`,
          tag.trim().toUpperCase(),
        );
      } catch {
        // non-blocking
      }

      // 5. Record changes in Audit Log
      const changes: AuditChangeDetail[] = [];
      if (name.trim() !== initialName.trim()) {
        changes.push({
          field: "Nome da comunidade",
          before: initialName.trim(),
          after: name.trim(),
        });
      }
      if (finalImageUrl.trim() !== initialImageUrl.trim()) {
        changes.push({
          field: "Ícone da comunidade",
          before: initialImageUrl.trim() ? "Ícone anterior" : "(nenhum)",
          after: finalImageUrl.trim() ? "Novo ícone" : "(removido)",
        });
      }
      if (finalBannerUrl.trim() !== initialBannerUrl.trim()) {
        changes.push({
          field: "Banner da comunidade",
          before: initialBannerUrl.trim() ? "Banner anterior" : "(nenhum)",
          after: finalBannerUrl.trim() ? "Novo banner" : "(removido)",
        });
      }
      if (description.trim() !== initialDesc.trim()) {
        changes.push({
          field: "Descrição da comunidade",
          before: initialDesc.trim() || "(nenhuma)",
          after: description.trim() || "(nenhuma)",
        });
      }
      if (tag.trim().toUpperCase() !== initialTag.trim().toUpperCase()) {
        changes.push({
          field: "Tag da comunidade",
          before: initialTag.trim().toUpperCase() || "(nenhuma)",
          after: tag.trim().toUpperCase() || "(nenhuma)",
        });
      }

      if (changes.length > 0) {
        recordAuditLogEntry(community.id, actorProfile, {
          action_type: "community_update",
          target_type: "community",
          target_name: name.trim(),
          metadata: { changes },
        });
      }

      // 6. Clean up temporary preview URLs
      if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
      if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
      setStagedIconFile(null);
      setStagedBannerFile(null);
      setIconPreviewUrl(null);
      setBannerPreviewUrl(null);

      setInitialName(name.trim());
      setInitialImageUrl(finalImageUrl.trim());
      setInitialBannerUrl(finalBannerUrl.trim());
      setInitialDesc(description.trim());
      setInitialTag(tag.trim().toUpperCase());
      setImageUrl(finalImageUrl.trim());
      setBannerUrl(finalBannerUrl.trim());

      await onChanged();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    });
  };

  const navGroups: NavGroup[] = [
    {
      title: "GERAL",
      items: [
        { id: "overview", label: "Perfil do servidor" },
        { id: "tag", label: "Tag do servidor" },
        { id: "engagement", label: "Engajamento" },
      ],
    },
    {
      title: "EXPRESSÕES",
      items: [
        { id: "emojis", label: "Emoji" },
        { id: "stickers", label: "Figurinhas" },
        { id: "soundboard", label: "Painel de efeitos sonoros" },
      ],
    },
    {
      title: "PESSOAS",
      items: [
        { id: "members", label: "Membros", badge: String(members.length) },
        { id: "roles", label: "Cargos" },
        { id: "invites", label: "Convites" },
        { id: "access", label: "Acesso" },
      ],
    },
    {
      title: "APPS",
      items: [{ id: "integrations", label: "Integrações" }],
    },
    {
      title: "MODERAÇÃO",
      items: [
        { id: "safety", label: "Configurações de Segurança" },
        { id: "audit_log", label: "Registro de auditoria" },
        { id: "bans", label: "Banimentos" },
      ],
    },
    {
      title: "",
      items: [{ id: "template", label: "Modelo do servidor" }],
    },
    ...(isOwner
      ? [
          {
            title: "",
            items: [
              {
                id: "delete_server" as ServerSettingsSection,
                label: "Excluir servidor",
                danger: true,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <div
      className="server-settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Configurações do servidor"
    >
      {/* Sidebar */}
      <aside className="server-settings-sidebar">
        <div className="server-settings-header" title={community.name}>
          {community.name}
        </div>

        {navGroups.map((group, gIdx) => (
          <div key={group.title || `group-${gIdx}`}>
            {group.title ? (
              <div className="server-settings-group-title">{group.title}</div>
            ) : (
              <div className="server-settings-divider" />
            )}
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`server-settings-nav-item ${
                  activeSection === item.id ? "active" : ""
                } ${item.danger ? "danger" : ""}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="server-settings-badge">{item.badge}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Main Content Pane */}
      <main className="server-settings-content">
        <div
          className={`server-settings-content-inner ${
            activeSection === "roles" ? "server-settings-content-inner-roles" : ""
          }`}
        >
          <ErrorNotice text={task.error} />
          {savedSuccess && (
            <div
              style={{
                background: "rgba(35, 165, 90, 0.15)",
                color: "#23a55a",
                border: "1px solid rgba(35, 165, 90, 0.3)",
                padding: "10px 16px",
                borderRadius: "4px",
                marginBottom: "20px",
                fontWeight: 600,
              }}
            >
              Alterações salvas com sucesso!
            </div>
          )}
          {activeSection === "overview" && (
            <section aria-labelledby="section-overview-title">
              <h2 id="section-overview-title" className="server-settings-title">
                Perfil do servidor
              </h2>
              <p className="server-settings-description">
                Personalize como sua comunidade aparece no LYC Arena.
              </p>

              {uploadError && (
                <div
                  className="server-settings-alert error"
                  style={{ marginBottom: "20px" }}
                >
                  <AlertCircle size={16} />
                  <span>{uploadError}</span>
                </div>
              )}

              {!canManageProfile && (
                <div
                  className="server-settings-alert info"
                  style={{ marginBottom: "20px" }}
                >
                  <Shield size={16} />
                  <span>
                    Você está em modo de visualização. É necessário ter a
                    permissão Administrar comunidade para salvar alterações.
                  </span>
                </div>
              )}

              <div className="server-profile-grid">
                {/* Left Form Controls */}
                <div className="server-profile-form">
                  {/* Nome da Comunidade */}
                  <div className="server-settings-field">
                    <label
                      htmlFor="server-name-input"
                      className="server-settings-label"
                    >
                      Nome da comunidade
                    </label>
                    <input
                      id="server-name-input"
                      type="text"
                      className="server-settings-input"
                      value={name}
                      maxLength={60}
                      disabled={!canManageProfile || task.busy}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Comunidade LYC"
                    />
                  </div>

                  {/* Ícone da Comunidade */}
                  <div className="server-settings-field">
                    <span className="server-settings-label">
                      Ícone da comunidade
                    </span>
                    <div className="server-icon-manager">
                      <div className="server-icon-preview">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt="Ícone da comunidade"
                            onError={() => setImageUrl("")}
                          />
                        ) : (
                          <div className="server-icon-fallback">
                            {name.charAt(0).toUpperCase() || "L"}
                          </div>
                        )}
                      </div>
                      <div className="server-icon-actions">
                        <input
                          ref={iconFileInputRef}
                          type="file"
                          accept={COMMUNITY_MEDIA_ACCEPT}
                          style={{ display: "none" }}
                          onChange={handleIconFileSelect}
                          disabled={!canManageProfile || task.busy}
                        />
                        <button
                          type="button"
                          className="server-btn server-btn-secondary"
                          disabled={!canManageProfile || task.busy}
                          onClick={() => iconFileInputRef.current?.click()}
                        >
                          Alterar ícone
                        </button>
                        {imageUrl && (
                          <button
                            type="button"
                            className="server-btn server-btn-danger"
                            disabled={!canManageProfile || task.busy}
                            onClick={handleRemoveIcon}
                          >
                            Remover ícone
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="server-field-hint">
                      Recomendado: 512x512 ou maior. Formatos: PNG, JPG, WEBP ou
                      GIF (até 5 MB).
                    </p>
                  </div>

                  {/* Banner / Faixa da Comunidade */}
                  <div className="server-settings-field">
                    <span className="server-settings-label">
                      Banner da comunidade
                    </span>
                    <div className="server-banner-preview">
                      {bannerUrl ? (
                        <img
                          src={bannerUrl}
                          alt="Banner da comunidade"
                          onError={() => setBannerUrl("")}
                        />
                      ) : (
                        <div className="server-banner-empty">
                          <span>Nenhum banner configurado</span>
                        </div>
                      )}
                    </div>
                    <div
                      className="server-icon-actions"
                      style={{ flexDirection: "row", gap: "10px" }}
                    >
                      <input
                        ref={bannerFileInputRef}
                        type="file"
                        accept={COMMUNITY_MEDIA_ACCEPT}
                        style={{ display: "none" }}
                        onChange={handleBannerFileSelect}
                        disabled={!canManageProfile || task.busy}
                      />
                      <button
                        type="button"
                        className="server-btn server-btn-secondary"
                        disabled={!canManageProfile || task.busy}
                        onClick={() => bannerFileInputRef.current?.click()}
                      >
                        Alterar banner
                      </button>
                      {bannerUrl && (
                        <button
                          type="button"
                          className="server-btn server-btn-danger"
                          disabled={!canManageProfile || task.busy}
                          onClick={handleRemoveBanner}
                        >
                          Remover banner
                        </button>
                      )}
                    </div>
                    <p className="server-field-hint">
                      Recomendado: proporção 16:9 (mínimo 960x540). Formatos:
                      PNG, JPG, WEBP ou GIF (até 5 MB).
                    </p>
                  </div>

                  {/* Descrição */}
                  <div className="server-settings-field">
                    <label
                      htmlFor="server-desc-input"
                      className="server-settings-label"
                    >
                      Descrição da comunidade
                    </label>
                    <textarea
                      id="server-desc-input"
                      className="server-settings-textarea"
                      placeholder="Conte às pessoas sobre esta comunidade."
                      maxLength={300}
                      rows={3}
                      disabled={!canManageProfile || task.busy}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <div className="server-settings-char-count">
                      {description.length}/300
                    </div>
                  </div>

                  {/* Configurações padrão de notificação da comunidade */}
                  <div className="server-settings-field">
                    <span className="server-settings-label">
                      Configurações padrão de notificação
                    </span>
                    <p
                      className="server-field-hint"
                      style={{ marginTop: 2, marginBottom: 8 }}
                    >
                      Define a regra padrão de notificações que você e os membros recebem neste servidor.
                    </p>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="button"
                        className={`server-btn ${communityNotifLevel === "all" ? "server-btn-primary" : "server-btn-secondary"}`}
                        onClick={() => handleSaveCommunityNotifLevel("all")}
                        disabled={task.busy}
                      >
                        Todas as mensagens
                      </button>
                      <button
                        type="button"
                        className={`server-btn ${communityNotifLevel === "mentions" ? "server-btn-primary" : "server-btn-secondary"}`}
                        onClick={() => handleSaveCommunityNotifLevel("mentions")}
                        disabled={task.busy}
                      >
                        Apenas @menções
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Server Card Preview */}
                <div className="server-card-preview-wrapper">
                  <div className="server-card-preview-label">PRÉVIA</div>
                  <div className="server-card-preview">
                    <div className="server-card-cover">
                      {bannerUrl && (
                        <img src={bannerUrl} alt="Banner da comunidade" />
                      )}
                    </div>
                    <div className="server-card-body">
                      <div className="server-card-avatar-wrap">
                        <div className="server-card-avatar">
                          {imageUrl ? (
                            <img src={imageUrl} alt={name} />
                          ) : (
                            <span className="server-card-avatar-initial">
                              {name.charAt(0).toUpperCase() || "L"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="server-card-title-row">
                        <h3 className="server-card-name">
                          {name || "Comunidade LYC"}
                        </h3>
                        {community.is_official && (
                          <Shield size={14} color="#5865f2" />
                        )}
                      </div>
                      <div className="server-card-stats">
                        <div className="server-stat-item">
                          <span className="server-stat-dot online" />
                          <span>{onlineCount} Online</span>
                        </div>
                        <div className="server-stat-item">
                          <span className="server-stat-dot total" />
                          <span>
                            {totalMembers}{" "}
                            {totalMembers === 1 ? "Membro" : "Membros"}
                          </span>
                        </div>
                      </div>
                      {description ? (
                        <div className="server-card-desc">{description}</div>
                      ) : (
                        <div
                          className="server-card-desc"
                          style={{ color: "#80848e", fontStyle: "italic" }}
                        >
                          Nenhuma descrição informada.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 2. TAG DO SERVIDOR */}
          {activeSection === "tag" && (
            <section>
              <h2 className="server-settings-title">Tag do servidor</h2>
              <p className="server-settings-description">
                Personalize a abreviação do seu squad para exibição nos canais de
                chat e nas salas de voz.
              </p>
              <div className="server-section-panel">
                <div className="server-settings-field">
                  <label className="server-settings-label">
                    Abreviação da Tag (até 4 caracteres)
                  </label>
                  <input
                    type="text"
                    className="server-settings-input"
                    maxLength={4}
                    value={tag}
                    onChange={(e) => setTag(e.target.value.toUpperCase())}
                    style={{ width: "160px", textTransform: "uppercase" }}
                  />
                </div>
                <p style={{ marginTop: "12px", color: "#949ba4" }}>
                  Prévia no chat:{" "}
                  <strong style={{ color: "#ffffff" }}>
                    [{tag || "LYC"}] {members[0]?.profiles.display_name || "Membro"}
                  </strong>
                </p>
              </div>
            </section>
          )}

          {/* 3. ENGAJAMENTO */}
          {activeSection === "engagement" && (
            <section>
              <h2 className="server-settings-title">
                Engajamento da comunidade
              </h2>
              <p className="server-settings-description">
                Métricas em tempo real sobre a atividade dos membros e salas de
                voz.
              </p>
              <div className="server-grid-cards">
                <div className="server-grid-card">
                  <span className="server-grid-card-icon">👥</span>
                  <div className="server-grid-card-name">
                    {totalMembers} Membros
                  </div>
                  <div className="server-grid-card-sub">Total registrado</div>
                </div>
                <div className="server-grid-card">
                  <span className="server-grid-card-icon">🟢</span>
                  <div className="server-grid-card-name">
                    {onlineCount} Online
                  </div>
                  <div className="server-grid-card-sub">Conectados agora</div>
                </div>
                <div className="server-grid-card">
                  <span className="server-grid-card-icon">💬</span>
                  <div className="server-grid-card-name">
                    {channels.length} Canais
                  </div>
                  <div className="server-grid-card-sub">Texto e voz</div>
                </div>
                <div className="server-grid-card">
                  <span className="server-grid-card-icon">🏆</span>
                  <div className="server-grid-card-name">
                    {engagementLevel.level}
                  </div>
                  <div className="server-grid-card-sub">
                    {engagementLevel.title}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 4. EMOJI */}
          {activeSection === "emojis" && (
            <CommunityExpressionsView
              community={community}
              kind="emoji"
              canManage={canManageProfile}
              actor={actorProfile}
            />
          )}

          {/* 5. FIGURINHAS */}
          {activeSection === "stickers" && (
            <CommunityExpressionsView
              community={community}
              kind="sticker"
              canManage={canManageProfile}
              actor={actorProfile}
            />
          )}

          {/* 6. PAINEL DE EFEITOS SONOROS */}
          {activeSection === "soundboard" && (
            <CommunityExpressionsView
              community={community}
              kind="sound"
              canManage={canManageProfile}
              actor={actorProfile}
            />
          )}

          {/* 7. MEMBROS */}
          {activeSection === "members" && (
            <CommunityMembersView
              community={community}
              members={members}
              roles={roles}
              permissions={permissions}
              userId={userId}
              presence={presence}
              onChanged={onChanged}
            />
          )}

          {/* 8. CARGOS */}
          {activeSection === "roles" && (
            <RolesManagerView
              community={community}
              roles={roles}
              members={members}
              permissions={permissions}
              userId={userId}
              onChanged={onChanged}
            />
          )}

          {/* 9. CONVITES */}
          {activeSection === "invites" && (
            <CommunityInvitesView
              community={community}
              members={members}
              permissions={permissions}
              userId={userId}
              onChanged={onChanged}
            />
          )}

          {/* 10. ACESSO */}
          {activeSection === "access" && (
            <CommunityAccessView
              community={community}
              roles={roles}
              onNavigateToRoles={() => setActiveSection("roles")}
            />
          )}

          {/* 11. INTEGRAÇÕES */}
          {activeSection === "integrations" && (
            <CommunityIntegrationsView
              community={community}
              channels={channels}
              canManage={canManageProfile}
              actor={actorProfile}
            />
          )}

          {/* 12. CONFIGURAÇÕES DE SEGURANÇA */}
          {activeSection === "safety" && (
            <CommunitySafetyView
              community={community}
              isOwner={isOwner}
              canAdmin={canAdmin}
              actor={actorProfile}
            />
          )}

          {/* 13. REGISTRO DE AUDITORIA */}
          {activeSection === "audit_log" && (
            <CommunityAuditLogView
              community={community}
              isOwner={isOwner}
              permissions={permissions}
            />
          )}

          {/* 14. BANIMENTOS */}
          {activeSection === "bans" && (
            <CommunityBansView
              community={community}
              canModerate={canModerate}
              actorProfile={actorProfile}
            />
          )}

          {/* 15. MODELO DO SERVIDOR */}
          {activeSection === "template" && (
            <section>
              <h2 className="server-settings-title">Modelo do servidor</h2>
              <p className="server-settings-description">
                Compartilhe a estrutura de canais e cargos desta comunidade como
                um modelo reutilizável para outros squads.
              </p>
              <div className="server-section-panel">
                <p
                  style={{
                    color: "#949ba4",
                    fontSize: "14px",
                    marginBottom: "16px",
                  }}
                >
                  O modelo incluirá <strong>{channels.length} canais</strong> e{" "}
                  <strong>{roles.length} cargos</strong>. Mensagens, membros e
                  configurações de segurança não são incluídos no modelo.
                </p>
                {!generatedTemplateUrl ? (
                  <button
                    type="button"
                    className="server-btn server-btn-primary"
                    onClick={handleGenerateTemplate}
                  >
                    Gerar link do modelo
                  </button>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        readOnly
                        value={generatedTemplateUrl}
                        className="server-settings-input"
                        style={{
                          flex: 1,
                          fontFamily: "monospace",
                          fontSize: "13px",
                        }}
                      />
                      <button
                        type="button"
                        className="server-btn server-btn-primary"
                        onClick={() => void handleCopyTemplate()}
                      >
                        {templateCopied ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <span
                      style={{
                        color: "#23a55a",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      Link do modelo pronto para compartilhamento com outros moderadores.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 16. EXCLUIR SERVIDOR (Owner only danger zone) */}
          {activeSection === "delete_server" && isOwner && (
            <section>
              <h2 className="server-settings-title" style={{ color: "#f23f43" }}>
                Excluir servidor
              </h2>
              <div className="server-danger-box">
                <h3>Atenção: Ação Irreversível</h3>
                <p>
                  Você tem certeza absoluta de que deseja excluir{" "}
                  <strong>{community.name}</strong>? Todos os canais, histórico
                  de mensagens, convites e funções serão permanentemente
                  apagados.
                </p>

                <label
                  htmlFor="delete-confirm-input"
                  className="server-settings-label"
                >
                  Digite o nome do servidor ({community.name}) para confirmar:
                </label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  className="server-danger-input"
                  placeholder={community.name}
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                />

                <button
                  type="button"
                  className="server-btn-solid-danger"
                  disabled={
                    deleteConfirmName.trim() !== community.name.trim() ||
                    task.busy
                  }
                  onClick={() =>
                    void task.run(async () => {
                      await communityAction("delete_community", {
                        community_id: community.id,
                        id: community.id,
                      });
                      await onChanged();
                      onClose();
                    })
                  }
                >
                  {task.busy ? "Excluindo..." : "Excluir este servidor"}
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Floating Save Changes Bar when dirty */}
      {isDirty && (
        <div className="server-settings-save-bar">
          <span className="server-save-bar-text">
            Cuidado — você tem alterações não salvas!
          </span>
          <div className="server-save-bar-actions">
            <button
              type="button"
              className="server-btn server-btn-secondary"
              onClick={handleReset}
              disabled={task.busy}
            >
              Redefinir
            </button>
            <button
              type="button"
              className="server-btn server-btn-primary"
              onClick={() => void handleSave()}
              disabled={task.busy}
            >
              {task.busy ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}

      {/* Close button with ESC indicator */}
      <div className="server-settings-close-col">
        <button
          type="button"
          className="server-settings-close-btn"
          onClick={onClose}
          aria-label="Fechar configurações"
          title="Fechar (Esc)"
        >
          <X size={18} />
        </button>
        <span className="server-settings-esc-label">ESC</span>
      </div>
    </div>
  );
}
