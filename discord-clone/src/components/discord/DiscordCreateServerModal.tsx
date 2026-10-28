import React, { useState, useRef, useEffect } from 'react';
import { useDiscord } from '../../store/discordStore';
import { joinByInviteCode, parseCapyInviteCode } from '../../lib/invite';
import {
  X,
  ChevronRight,
  Upload,
  Camera,
  Gamepad2,
  GraduationCap,
  BookOpen,
  Users,
  Compass,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  FileUp,
} from 'lucide-react';
import {
  fetchServerTemplate,
  validateServerTemplate,
  ServerTemplateData,
} from '../../services/server-templates';

interface DiscordCreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscordCreateServerModal: React.FC<DiscordCreateServerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, addServer, setActiveServer, servers, createServerFromTemplate, joinCommunityServer, createCommunityServer } = useDiscord();
  const [view, setView] = useState<'templates' | 'customize' | 'join' | 'import-template'>('templates');
  const [serverName, setServerName] = useState(`Servidor de ${currentUser.displayName || currentUser.name}`);
  const [serverIcon, setServerIcon] = useState<string>('');
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [templateInput, setTemplateInput] = useState('');
  const [importedTemplate, setImportedTemplate] = useState<ServerTemplateData | null>(null);
  const [isCheckingTemplate, setIsCheckingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setView('templates');
      setServerName(`Servidor de ${currentUser.displayName || currentUser.name}`);
      setServerIcon('');
      setInviteCode('');
      setTemplateInput('');
      setImportedTemplate(null);
      setTemplateError(null);
      setCreateError(null);
      setIsCreating(false);
    }
  }, [isOpen, currentUser]);

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          setServerIcon(ev.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim() || isCreating) return;

    setIsCreating(true);
    setCreateError(null);

    const res = await createCommunityServer(serverName, serverIcon);
    setIsCreating(false);

    if (res.success) {
      onClose();
    } else {
      setCreateError(res.error || 'Erro ao criar servidor.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || isJoining) return;

    setIsJoining(true);
    setJoinError(null);

    const code = parseCapyInviteCode(inviteCode);

    // 1. Servidor Oficial CapyChat
    if (code.toLowerCase() === 'capychat-oficial' || code.toLowerCase() === 'lyc-arena') {
      setActiveServer('server-lyc');
      setIsJoining(false);
      onClose();
      return;
    }

    // 2. Servidores locais existentes
    const localMatch = servers.find(
      (s) => s.id === code || s.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === code.toLowerCase()
    );
    if (localMatch) {
      setActiveServer(localMatch.id);
      setIsJoining(false);
      onClose();
      return;
    }

    // 3. Validação segura Supabase
    const result = await joinByInviteCode(code);
    setIsJoining(false);

    if (result.success) {
      if (result.communityId) {
        if (result.communityId === 'server-lyc') {
          setActiveServer('server-lyc');
        } else {
          await joinCommunityServer(result.communityId);
        }
      }
      onClose();
    } else {
      setJoinError(result.error || 'Código de convite inválido ou expirado.');
    }
  };

  const TEMPLATES = [
    { id: 'custom', name: 'Criar o meu', icon: Compass, desc: 'Comece do zero com canais gerais de texto e voz.' },
    { id: 'gaming', name: 'Jogos', icon: Gamepad2, desc: 'Para você e seus amigos jogarem juntos e fazerem clips.' },
    { id: 'school', name: 'Clube escolar', icon: GraduationCap, desc: 'Para grupos de turma, clubes e matérias.' },
    { id: 'study', name: 'Grupo de estudos', icon: BookOpen, desc: 'Para sessões de foco, lição de casa e projetos.' },
    { id: 'friends', name: 'Amigos', icon: Users, desc: 'Para um grupo de amigos próximos conversarem diariamente.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#313338] w-full max-w-[440px] rounded-lg shadow-2xl border border-[#1f2023] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
        {/* Top Header */}
        <div className="relative p-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#949ba4] hover:text-white p-1 rounded hover:bg-[#35373c] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {view === 'templates' && (
            <>
              <h2 className="text-2xl font-bold text-white tracking-tight">Crie o seu servidor</h2>
              <p className="text-xs text-[#949ba4] mt-2 leading-relaxed">
                Seu servidor é onde você e seus amigos se reúnem. Crie o seu e comece a conversar por voz, texto e streaming.
              </p>
            </>
          )}

          {view === 'customize' && (
            <>
              <h2 className="text-2xl font-bold text-white tracking-tight">Personalize seu servidor</h2>
              <p className="text-xs text-[#949ba4] mt-2 leading-relaxed">
                Dê uma personalidade ao seu novo servidor com um nome e um ícone. Você sempre pode alterá-los mais tarde.
              </p>
            </>
          )}

          {view === 'join' && (
            <>
              <h2 className="text-2xl font-bold text-white tracking-tight">Entrar em um servidor</h2>
              <p className="text-xs text-[#949ba4] mt-2 leading-relaxed">
                Insira um convite abaixo para entrar em um servidor existente no CapyChat Oficial.
              </p>
            </>
          )}

          {view === 'import-template' && (
            <>
              <h2 className="text-2xl font-bold text-white tracking-tight">Usar Modelo de Servidor</h2>
              <p className="text-xs text-[#949ba4] mt-2 leading-relaxed">
                Cole o link de um modelo ou carregue um arquivo JSON para clonar canais, categorias e cargos.
              </p>
            </>
          )}
        </div>

        {/* View 1: Templates List */}
        {view === 'templates' && (
          <div className="px-6 pb-6 space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin">
            {TEMPLATES.map((tmpl) => {
              const IconComp = tmpl.icon;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => {
                    setSelectedTemplate(tmpl.id);
                    if (tmpl.id !== 'custom') {
                      setServerName(`Servidor de ${tmpl.name} de ${currentUser.displayName || currentUser.name}`);
                    }
                    setView('customize');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-[#2b2d31] hover:bg-[#35373c]/50 hover:border-[#3f4147] transition-all cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#5865f2]/15 text-[#5865f2] flex items-center justify-center flex-shrink-0 group-hover:bg-[#5865f2] group-hover:text-white transition-colors">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-white block">{tmpl.name}</span>
                      <span className="text-[11px] text-[#949ba4] line-clamp-1">{tmpl.desc}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#949ba4] group-hover:text-white transition-colors flex-shrink-0" />
                </button>
              );
            })}

            {/* Template Import Button */}
            <button
              type="button"
              onClick={() => {
                setTemplateInput('');
                setImportedTemplate(null);
                setTemplateError(null);
                setView('import-template');
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-[#2b2d31] hover:bg-[#35373c]/50 hover:border-[#3f4147] transition-all cursor-pointer group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#23a55a]/15 text-[#23a55a] flex items-center justify-center flex-shrink-0 group-hover:bg-[#23a55a] group-hover:text-white transition-colors">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-white block">Usar Modelo de Servidor</span>
                  <span className="text-[11px] text-[#949ba4] line-clamp-1">Cole um link ou carregue um arquivo JSON de modelo</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#949ba4] group-hover:text-white transition-colors flex-shrink-0" />
            </button>

            {/* Bottom: Join Server prompt */}
            <div className="pt-4 mt-2 border-t border-[#2b2d31] text-center">
              <span className="text-xs text-[#949ba4] block mb-2">Já tem um convite?</span>
              <button
                type="button"
                onClick={() => setView('join')}
                className="w-full py-2.5 bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-bold rounded-[4px] transition-colors cursor-pointer border border-[#3f4147]"
              >
                Entrar em um servidor
              </button>
            </div>
          </div>
        )}

        {/* View 2: Customize Server Form */}
        {view === 'customize' && (
          <form onSubmit={handleCreate} className="px-6 pb-6 space-y-5">
            {/* Circular Icon Upload */}
            <div className="flex flex-col items-center justify-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full border-2 border-dashed border-[#5865f2] hover:border-white bg-[#2b2d31] flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group shadow-md"
              >
                {serverIcon ? (
                  <img src={serverIcon} alt="Ícone" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-[#949ba4] group-hover:text-white transition-colors" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#949ba4] mt-1 group-hover:text-white">
                      UPLOAD
                    </span>
                  </>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Upload className="w-5 h-5" />
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleIconChange}
              />
              <span className="text-[11px] text-[#949ba4] mt-2">Clique para carregar o ícone</span>
            </div>

            {/* Server Name Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                NOME DO SERVIDOR
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                required
                className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5865f2] transition-colors font-medium"
              />
              <span className="text-[10px] text-[#949ba4] block">
                Ao criar um servidor, você concorda com as Diretrizes da Comunidade do CapyChat Oficial.
              </span>
              {createError && (
                <span className="text-[11px] text-[#f23f43] font-medium block">
                  {createError}
                </span>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setView('templates')}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#dbdee1] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
              <button
                type="submit"
                disabled={!serverName.trim() || isCreating}
                className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold text-xs rounded-[4px] transition-colors cursor-pointer shadow disabled:opacity-50"
              >
                {isCreating ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </form>
        )}

        {/* View 3: Join Server Form */}
        {view === 'join' && (
          <form onSubmit={handleJoin} className="px-6 pb-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                LINK OU CÓDIGO DE CONVITE *
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value);
                  if (joinError) setJoinError(null);
                }}
                placeholder="https://capy.ofc/invite/h7x8w ou Hm9aqnt3c"
                required
                autoFocus
                className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5865f2] transition-colors font-medium placeholder-[#80848e]"
              />
              {joinError ? (
                <span className="text-[11px] text-[#f23f43] font-medium block">
                  {joinError}
                </span>
              ) : (
                <span className="text-[10px] text-[#949ba4] block">
                  Exemplos: https://capy.ofc/invite/capychat-oficial, Hm9aqnt3c, capy-ranked
                </span>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setView('templates');
                  setJoinError(null);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#dbdee1] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
              <button
                type="submit"
                disabled={!inviteCode.trim() || isJoining}
                className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold text-xs rounded-[4px] transition-colors cursor-pointer shadow disabled:opacity-50"
              >
                {isJoining ? 'Entrando...' : 'Entrar no servidor'}
              </button>
            </div>
          </form>
        )}

        {/* View 4: Import Server Template Form */}
        {view === 'import-template' && (
          <div className="px-6 pb-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider block">
                LINK OU CÓDIGO DO MODELO
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={templateInput}
                  onChange={(e) => {
                    setTemplateInput(e.target.value);
                    if (templateError) setTemplateError(null);
                  }}
                  placeholder="https://capy.ofc/template/cpt_... ou código"
                  className="flex-1 bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2] placeholder-[#80848e]"
                />
                <button
                  type="button"
                  disabled={!templateInput.trim() || isCheckingTemplate}
                  onClick={async () => {
                    setIsCheckingTemplate(true);
                    setTemplateError(null);
                    const tmpl = await fetchServerTemplate(templateInput.trim());
                    setIsCheckingTemplate(false);
                    if (tmpl) {
                      setImportedTemplate(tmpl);
                      setServerName(tmpl.name);
                    } else {
                      setTemplateError('Modelo não encontrado ou link inválido.');
                    }
                  }}
                  className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold text-xs rounded-[4px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCheckingTemplate ? '...' : 'Buscar'}
                </button>
              </div>
            </div>

            {/* File upload prompt */}
            <div className="flex items-center justify-between text-xs text-[#949ba4] pt-1">
              <span>Ou carregue um arquivo local (.json):</span>
              <button
                type="button"
                onClick={() => jsonFileInputRef.current?.click()}
                className="text-[#5865f2] hover:underline font-semibold cursor-pointer flex items-center gap-1"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Carregar JSON</span>
              </button>
              <input
                type="file"
                ref={jsonFileInputRef}
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const parsed = JSON.parse(String(ev.target?.result));
                        const validation = validateServerTemplate(parsed);
                        if (validation.valid && validation.template) {
                          setImportedTemplate(validation.template);
                          setServerName(validation.template.name);
                          setTemplateError(null);
                        } else {
                          setTemplateError(validation.errors.join(' '));
                        }
                      } catch {
                        setTemplateError('Arquivo JSON inválido ou malformado.');
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>

            {templateError && (
              <div className="p-2.5 rounded bg-[#f23f43]/15 border border-[#f23f43]/30 text-[#f23f43] text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{templateError}</span>
              </div>
            )}

            {/* Preview if importedTemplate is present */}
            {importedTemplate && (
              <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#232428] space-y-3 animate-in fade-in">
                <div>
                  <span className="text-xs font-bold text-white block">{importedTemplate.name}</span>
                  <p className="text-[11px] text-[#949ba4] line-clamp-2 mt-0.5">{importedTemplate.description}</p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#949ba4] bg-[#1e1f22] p-2 rounded border border-[#232428]">
                  <span>{importedTemplate.categories.length} Categorias</span>
                  <span>•</span>
                  <span>{importedTemplate.categories.reduce((acc, c) => acc + c.channels.length, 0)} Canais</span>
                  <span>•</span>
                  <span>{importedTemplate.roles.length} Cargos</span>
                </div>

                {/* Channels preview list */}
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin text-[11px]">
                  {importedTemplate.categories.map((cat, idx) => (
                    <div key={idx} className="bg-[#1e1f22] p-1.5 rounded">
                      <span className="font-bold text-[#949ba4] text-[10px] uppercase block mb-0.5">{cat.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {cat.channels.map((ch, chIdx) => (
                          <span key={chIdx} className="bg-[#2b2d31] text-[#dbdee1] px-1.5 py-0.5 rounded text-[10px]">
                            #{ch.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Server name for creation */}
                <div className="pt-2">
                  <label className="text-[10px] font-bold text-[#b5bac1] uppercase block mb-1">
                    NOME DO NOVO SERVIDOR
                  </label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>
            )}

            {/* Bottom Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setView('templates');
                  setTemplateError(null);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#dbdee1] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
              {importedTemplate && (
                <button
                  type="button"
                  disabled={!serverName.trim()}
                  onClick={async () => {
                    await createServerFromTemplate(importedTemplate, serverName, serverIcon);
                    onClose();
                  }}
                  className="px-5 py-2 bg-[#23a55a] hover:bg-[#1a8345] text-white font-bold text-xs rounded-[4px] transition-colors cursor-pointer shadow"
                >
                  Criar Servidor com este Modelo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
