import { useState, useEffect, useRef, useMemo } from "react";
import {
  Smile,
  Image as ImageIcon,
  Volume2,
  Play,
  Square,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Upload,
} from "lucide-react";
import type { Community } from "../../services/communities";
import {
  type ExpressionKind,
  type CommunityExpression,
  loadCommunityExpressions,
  createCommunityExpression,
  updateCommunityExpression,
  deleteCommunityExpression,
  uploadExpressionFile,
  validateEmojiName,
  formatEmojiName,
  validateStickerName,
  validateSoundName,
  EXPRESSION_LIMITS,
  EXPRESSION_SIZE_LIMITS,
  EMOJI_ACCEPT,
  STICKER_ACCEPT,
  SOUND_ACCEPT,
  SOUND_MAX_DURATION,
} from "../../services/community-expressions";
import { recordAuditLogEntry } from "../../services/community-audit";

interface CommunityExpressionsViewProps {
  community: Community;
  kind: ExpressionKind;
  canManage: boolean;
  actor: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
  };
}

export function CommunityExpressionsView({
  community,
  kind,
  canManage,
  actor,
}: CommunityExpressionsViewProps) {
  const [items, setItems] = useState<CommunityExpression[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState<CommunityExpression | null>(null);
  const [deleteModalItem, setDeleteModalItem] = useState<CommunityExpression | null>(null);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [detectedDuration, setDetectedDuration] = useState<number | undefined>();
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Audio playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const limit = EXPRESSION_LIMITS[kind];
  const sizeLimitMB = Math.round(EXPRESSION_SIZE_LIMITS[kind] / (1024 * 1024));

  const acceptMime = useMemo(() => {
    if (kind === "emoji") return EMOJI_ACCEPT;
    if (kind === "sticker") return STICKER_ACCEPT;
    return SOUND_ACCEPT;
  }, [kind]);

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await loadCommunityExpressions(community.id, kind);
      setItems(list);
    } catch {
      setErrorNotice("Não foi possível carregar os itens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // Stop any playing audio when switching views
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingId(null);
    }
  }, [community.id, kind]);

  // Audio playback handler
  const handleTogglePlay = (item: CommunityExpression) => {
    if (playingId === item.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(item.file_url);
      audioPlayerRef.current = audio;
      setPlayingId(item.id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => {
        setPlayingId(null);
        setErrorNotice("Erro ao reproduzir o som.");
      };
      void audio.play();
    }
  };

  // Preview audio player in upload modal
  const handleTogglePreviewAudio = () => {
    if (!previewUrl) return;
    if (previewPlaying) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewPlaying(false);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(previewUrl);
      previewAudioRef.current = audio;
      setPreviewPlaying(true);
      audio.onended = () => setPreviewPlaying(false);
      audio.onerror = () => setPreviewPlaying(false);
      void audio.play();
    }
  };

  const handleOpenUploadModal = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFormName("");
    setFormDescription("");
    setDetectedDuration(undefined);
    setFormError(null);
    setPreviewPlaying(false);
    setUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setUploadModalOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);

    // Validate size limit
    if (file.size > EXPRESSION_SIZE_LIMITS[kind]) {
      setFormError(`O arquivo deve ter no máximo ${sizeLimitMB} MB.`);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Auto-populate default name from filename without extension
    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const cleanSuggested = baseName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().slice(0, 32);

    if (!formName) {
      setFormName(kind === "emoji" ? cleanSuggested : baseName.slice(0, 32));
    }

    // Detect sound duration
    if (kind === "sound") {
      const audio = new Audio(objectUrl);
      audio.onloadedmetadata = () => {
        const sec = Math.round(audio.duration * 10) / 10;
        setDetectedDuration(sec);
        if (sec > SOUND_MAX_DURATION) {
          setFormError(`Duração excede ${SOUND_MAX_DURATION} segundos (${sec}s detectados).`);
        }
      };
    }
  };

  const handleSaveUpload = async () => {
    if (!selectedFile) {
      setFormError("Selecione um arquivo para enviar.");
      return;
    }

    // Validate name
    const nameValidation =
      kind === "emoji"
        ? validateEmojiName(formName)
        : kind === "sticker"
          ? validateStickerName(formName)
          : validateSoundName(formName);

    if (nameValidation) {
      setFormError(nameValidation);
      return;
    }

    if (kind === "sound" && detectedDuration && detectedDuration > SOUND_MAX_DURATION) {
      setFormError(`O som deve ter no máximo ${SOUND_MAX_DURATION} segundos.`);
      return;
    }

    try {
      setUploading(true);
      setFormError(null);

      // 1. Upload file
      const uploadRes = await uploadExpressionFile(
        actor.id,
        community.id,
        kind,
        selectedFile,
      );

      // 2. Create expression record
      const created = await createCommunityExpression(community.id, {
        kind,
        name: formName,
        file_url: uploadRes.url,
        file_path: uploadRes.path,
        description: formDescription,
        duration: detectedDuration,
        created_by: actor.id,
        creator_name: actor.display_name,
      });

      // 3. Record in Audit Log
      const auditAction =
        kind === "emoji"
          ? "emoji_create"
          : kind === "sticker"
            ? "sticker_create"
            : "sound_create";

      recordAuditLogEntry(community.id, actor, {
        action_type: auditAction,
        target_type: kind,
        target_name: created.name,
        metadata: {
          file_name: selectedFile.name,
          duration: detectedDuration,
        },
      });

      setItems((current) => [created, ...current]);
      handleCloseUploadModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar o upload.";
      setFormError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModalItem) return;

    const nameValidation =
      kind === "emoji"
        ? validateEmojiName(formName)
        : kind === "sticker"
          ? validateStickerName(formName)
          : validateSoundName(formName);

    if (nameValidation) {
      setFormError(nameValidation);
      return;
    }

    try {
      setUploading(true);
      const updated = await updateCommunityExpression(community.id, editModalItem.id, {
        name: formName,
        description: formDescription,
      });

      const auditAction =
        kind === "emoji"
          ? "emoji_update"
          : kind === "sticker"
            ? "sticker_update"
            : "sound_update";

      recordAuditLogEntry(community.id, actor, {
        action_type: auditAction,
        target_type: kind,
        target_name: updated.name,
        metadata: {
          changes: [
            ...(editModalItem.name !== updated.name
              ? [{ field: "Nome", before: editModalItem.name, after: updated.name }]
              : []),
            ...(editModalItem.description !== updated.description
              ? [{ field: "Descrição", before: editModalItem.description, after: updated.description }]
              : []),
          ],
        },
      });

      setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
      setEditModalItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar.";
      setFormError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteModalItem) return;
    try {
      setUploading(true);
      await deleteCommunityExpression(community.id, deleteModalItem.id);

      const auditAction =
        kind === "emoji"
          ? "emoji_delete"
          : kind === "sticker"
            ? "sticker_delete"
            : "sound_delete";

      recordAuditLogEntry(community.id, actor, {
        action_type: auditAction,
        target_type: kind,
        target_name: deleteModalItem.name,
      });

      setItems((current) => current.filter((i) => i.id !== deleteModalItem.id));
      setDeleteModalItem(null);
    } catch {
      setErrorNotice("Não foi possível excluir o item.");
    } finally {
      setUploading(false);
    }
  };

  const titleText =
    kind === "emoji"
      ? "Emojis"
      : kind === "sticker"
        ? "Figurinhas"
        : "Efeitos sonoros";

  const descriptionText =
    kind === "emoji"
      ? "Adicione emojis personalizados para sua comunidade."
      : kind === "sticker"
        ? "Adicione figurinhas personalizadas para usar nas conversas da comunidade."
        : "Adicione sons personalizados para usar nos canais de voz.";

  const uploadBtnText =
    kind === "emoji"
      ? "Enviar emoji"
      : kind === "sticker"
        ? "Enviar figurinha"
        : "Adicionar som";

  return (
    <section aria-labelledby="expressions-section-title">
      <h2 id="expressions-section-title" className="server-settings-title">
        {titleText}
      </h2>
      <p className="server-settings-description">{descriptionText}</p>

      {errorNotice && (
        <div className="server-settings-alert error" style={{ marginBottom: "16px" }}>
          <AlertCircle size={16} />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* Toolbar with Counter and Add Button */}
      <div className="expression-header-toolbar">
        <div className="expression-counter">
          {titleText}: <strong>{items.length}</strong> / {limit} espaços preenchidos
        </div>
        <button
          type="button"
          className="server-btn server-btn-primary"
          disabled={!canManage || items.length >= limit}
          onClick={handleOpenUploadModal}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={16} />
          <span>{uploadBtnText}</span>
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#949ba4" }}>
          Carregando {titleText.toLowerCase()}...
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="expression-empty">
          {kind === "emoji" && <Smile size={40} color="#80848e" />}
          {kind === "sticker" && <ImageIcon size={40} color="#80848e" />}
          {kind === "sound" && <Volume2 size={40} color="#80848e" />}
          <div className="expression-empty-title">
            {kind === "emoji" && "Nenhum emoji personalizado."}
            {kind === "sticker" && "Nenhuma figurinha adicionada."}
            {kind === "sound" && "Nenhum efeito sonoro adicionado."}
          </div>
          <div className="expression-empty-desc">
            {kind === "emoji" && "Adicione emojis para deixar sua comunidade com a sua cara."}
            {kind === "sticker" && "Adicione figurinhas para enriquecer as conversas dos seus membros."}
            {kind === "sound" && "Adicione sons curtos para tocar nas salas de voz."}
          </div>
        </div>
      ) : kind === "emoji" ? (
        /* Emojis Table View */
        <table className="expression-table">
          <thead>
            <tr>
              <th className="expression-preview-cell">Emoji</th>
              <th>Nome</th>
              <th>Enviado por</th>
              <th className="expression-actions-cell">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((emoji) => (
              <tr key={emoji.id}>
                <td className="expression-preview-cell">
                  <img
                    src={emoji.file_url}
                    alt={emoji.name}
                    className="expression-preview-img"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </td>
                <td>
                  <span className="expression-name-code">{emoji.name}</span>
                </td>
                <td>
                  <span className="expression-creator">
                    {emoji.creator_name || "Membro"}
                  </span>
                </td>
                <td className="expression-actions-cell">
                  {canManage && (
                    <>
                      <button
                        type="button"
                        className="expression-action-btn"
                        title="Editar nome"
                        onClick={() => {
                          setEditModalItem(emoji);
                          setFormName(emoji.name.replace(/^:|:$/g, ""));
                          setFormError(null);
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="expression-action-btn danger"
                        title="Excluir emoji"
                        onClick={() => setDeleteModalItem(emoji)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : kind === "sticker" ? (
        /* Stickers Grid View */
        <div className="expression-grid">
          {items.map((sticker) => (
            <div key={sticker.id} className="expression-card">
              <div className="expression-card-preview">
                <img src={sticker.file_url} alt={sticker.name} />
              </div>
              <div className="expression-card-name" title={sticker.name}>
                {sticker.name}
              </div>
              {sticker.description && (
                <div className="expression-card-desc" title={sticker.description}>
                  {sticker.description}
                </div>
              )}
              {canManage && (
                <div className="expression-card-actions">
                  <button
                    type="button"
                    className="expression-action-btn"
                    title="Editar"
                    onClick={() => {
                      setEditModalItem(sticker);
                      setFormName(sticker.name);
                      setFormDescription(sticker.description || "");
                      setFormError(null);
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="expression-action-btn danger"
                    title="Excluir"
                    onClick={() => setDeleteModalItem(sticker)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Sounds List View */
        <div style={{ marginTop: "12px" }}>
          {items.map((sound) => {
            const isPlaying = playingId === sound.id;
            return (
              <div key={sound.id} className="sound-row">
                <button
                  type="button"
                  className={`sound-play-toggle ${isPlaying ? "playing" : ""}`}
                  onClick={() => handleTogglePlay(sound)}
                  title={isPlaying ? "Parar" : "Reproduzir som"}
                >
                  {isPlaying ? <Square size={14} fill="#fff" /> : <Play size={14} fill="#fff" />}
                </button>
                <div className="sound-info">
                  <div className="sound-name">{sound.name}</div>
                  <div className="sound-meta">
                    {sound.duration !== undefined && (
                      <span className="sound-duration-badge">
                        {sound.duration.toFixed(1)}s
                      </span>
                    )}
                    <span>Enviado por {sound.creator_name || "Membro"}</span>
                  </div>
                </div>
                {canManage && (
                  <div className="expression-actions-cell">
                    <button
                      type="button"
                      className="expression-action-btn"
                      title="Editar nome"
                      onClick={() => {
                        setEditModalItem(sound);
                        setFormName(sound.name);
                        setFormError(null);
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="expression-action-btn danger"
                      title="Excluir som"
                      onClick={() => setDeleteModalItem(sound)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="expression-modal-backdrop" role="dialog" aria-modal="true">
          <div className="expression-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>{uploadBtnText}</h3>
              <button
                type="button"
                className="expression-action-btn"
                onClick={handleCloseUploadModal}
                disabled={uploading}
              >
                <X size={18} />
              </button>
            </div>
            <p className="expression-modal-desc">
              Formatos aceitos: {kind === "sound" ? "MP3, OGG, WAV (até 10s)" : "PNG, JPG, WEBP ou GIF"} (máx {sizeLimitMB} MB).
            </p>

            {formError && (
              <div className="server-settings-alert error" style={{ marginBottom: "14px" }}>
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}

            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptMime}
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploading}
            />

            {/* Upload Drag/Click Zone */}
            <div
              className="expression-upload-box"
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                kind === "sound" ? (
                  <div className="expression-upload-preview">
                    <Volume2 size={36} color="#5865f2" />
                    <span style={{ fontSize: "13px", color: "#f2f3f5", fontWeight: 600 }}>
                      {selectedFile?.name}
                    </span>
                    {detectedDuration !== undefined && (
                      <span style={{ fontSize: "12px", color: "#949ba4" }}>
                        Duração: {detectedDuration}s
                      </span>
                    )}
                    <button
                      type="button"
                      className="server-btn server-btn-secondary"
                      style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePreviewAudio();
                      }}
                    >
                      {previewPlaying ? <Square size={12} fill="#fff" /> : <Play size={12} fill="#fff" />}
                      <span>{previewPlaying ? "Parar áudio" : "Ouvir prévia"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="expression-upload-preview">
                    <img src={previewUrl} alt="Prévia" />
                    <span style={{ fontSize: "12px", color: "#949ba4" }}>
                      Clique para trocar de arquivo
                    </span>
                  </div>
                )
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <Upload size={32} color="#949ba4" />
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#f2f3f5" }}>
                    Escolha um arquivo
                  </span>
                  <span style={{ fontSize: "12px", color: "#949ba4" }}>
                    Clique aqui para selecionar do seu computador
                  </span>
                </div>
              )}
            </div>

            {/* Name Input */}
            <div className="server-settings-field">
              <label htmlFor="exp-name-input" className="server-settings-label">
                {kind === "emoji" ? "Nome do emoji" : "Nome"}
              </label>
              <input
                id="exp-name-input"
                type="text"
                className="server-settings-input"
                placeholder={kind === "emoji" ? "ex: lyc_trofeu" : "ex: Meu item"}
                value={formName}
                maxLength={32}
                disabled={uploading}
                onChange={(e) => setFormName(e.target.value)}
              />
              {kind === "emoji" && (
                <p className="server-field-hint">
                  Será formatado como: <strong>{formatEmojiName(formName || "nome")}</strong>
                </p>
              )}
            </div>

            {/* Optional Description (for stickers) */}
            {kind === "sticker" && (
              <div className="server-settings-field">
                <label htmlFor="exp-desc-input" className="server-settings-label">
                  Descrição (opcional)
                </label>
                <input
                  id="exp-desc-input"
                  type="text"
                  className="server-settings-input"
                  placeholder="Ex: Mascote comemorando"
                  value={formDescription}
                  maxLength={60}
                  disabled={uploading}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            )}

            <div className="expression-modal-actions">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={handleCloseUploadModal}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-primary"
                onClick={handleSaveUpload}
                disabled={uploading || !selectedFile}
              >
                {uploading ? "Enviando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Name Modal */}
      {editModalItem && (
        <div className="expression-modal-backdrop" role="dialog" aria-modal="true">
          <div className="expression-modal">
            <h3>Editar {kind === "emoji" ? "Emoji" : kind === "sticker" ? "Figurinha" : "Efeito Sonoro"}</h3>
            <p className="expression-modal-desc">
              Atualize as informações do item selecionado.
            </p>

            {formError && (
              <div className="server-settings-alert error" style={{ marginBottom: "14px" }}>
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}

            <div className="server-settings-field">
              <label htmlFor="edit-name-input" className="server-settings-label">
                Nome
              </label>
              <input
                id="edit-name-input"
                type="text"
                className="server-settings-input"
                value={formName}
                maxLength={32}
                disabled={uploading}
                onChange={(e) => setFormName(e.target.value)}
              />
              {kind === "emoji" && (
                <p className="server-field-hint">
                  Exibição: <strong>{formatEmojiName(formName || "nome")}</strong>
                </p>
              )}
            </div>

            {kind === "sticker" && (
              <div className="server-settings-field">
                <label htmlFor="edit-desc-input" className="server-settings-label">
                  Descrição
                </label>
                <input
                  id="edit-desc-input"
                  type="text"
                  className="server-settings-input"
                  value={formDescription}
                  maxLength={60}
                  disabled={uploading}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            )}

            <div className="expression-modal-actions">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setEditModalItem(null)}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-primary"
                onClick={handleSaveEdit}
                disabled={uploading}
              >
                {uploading ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalItem && (
        <div className="expression-modal-backdrop" role="dialog" aria-modal="true">
          <div className="expression-modal">
            <h3>Excluir {deleteModalItem.name}?</h3>
            <p className="expression-modal-desc">
              Esta ação removerá o item permanentemente da comunidade.
            </p>

            <div className="expression-modal-actions">
              <button
                type="button"
                className="server-btn server-btn-secondary"
                onClick={() => setDeleteModalItem(null)}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="server-btn server-btn-danger"
                style={{ background: "#da373c", color: "#fff" }}
                onClick={handleDeleteItem}
                disabled={uploading}
              >
                {uploading ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
