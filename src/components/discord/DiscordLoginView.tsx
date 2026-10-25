import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, User as UserIcon, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User } from '../../types/discord';
import { supabase, db, messageOf } from '../../lib/supabase';
import { DEFAULT_AVATAR, getAvatarUrl } from '../../utils/avatar';

interface Props {
  onLogin: (updates?: Partial<User>) => void;
}

export const DiscordLoginView: React.FC<Props> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = emailOrPhone.trim();
    if (!cleanEmail) {
      setErrorMessage('Por favor, informe seu e-mail.');
      return;
    }

    if (!password) {
      setErrorMessage('Por favor, informe sua senha.');
      return;
    }

    if (isRegistering) {
      const cleanDisplayName = displayName.trim();
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

      if (!cleanDisplayName) {
        setErrorMessage('Por favor, informe seu nome de exibição.');
        return;
      }
      if (!cleanUsername || cleanUsername.length < 3) {
        setErrorMessage('O nome de usuário deve ter no mínimo 3 caracteres (apenas letras, números e sublinhado _).');
        return;
      }
      if (cleanUsername.length > 30) {
        setErrorMessage('O nome de usuário deve ter no máximo 30 caracteres.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
        return;
      }

      setLoading(true);
      try {
        if (!supabase) {
          onLogin({
            name: cleanUsername,
            displayName: cleanDisplayName,
          });
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: cleanDisplayName,
              username: cleanUsername,
            },
          },
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('user already registered') || msg.includes('already registered')) {
            setErrorMessage('Este e-mail já está cadastrado. Tente entrar na sua conta.');
          } else if (msg.includes('password should be at least')) {
            setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
          } else if (msg.includes('invalid') && msg.includes('email')) {
            setErrorMessage('Endereço de e-mail inválido. Utilize um e-mail válido (ex: seu_nome@gmail.com).');
          } else {
            setErrorMessage(messageOf(error));
          }
          return;
        }

        if (data?.user) {
          // If a session is returned immediately (email confirmation not blocking)
          if (data.session) {
            try {
              await db()
                .from('profiles')
                .update({ username: cleanUsername, display_name: cleanDisplayName })
                .eq('id', data.user.id);
            } catch {}

            onLogin({
              id: data.user.id,
              name: cleanUsername,
              displayName: cleanDisplayName,
              avatar: DEFAULT_AVATAR,
            });
            return;
          }

          // Email confirmation is required by Supabase
          setSuccessMessage(
            'Conta criada com sucesso! Enviamos uma confirmação para seu e-mail. Por favor, confirme para acessar.'
          );
          setIsRegistering(false);
        }
      } catch (err: any) {
        setErrorMessage(messageOf(err));
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        if (!supabase) {
          onLogin({
            name: cleanEmail.split('@')[0] || 'CapyMembro',
            displayName: cleanEmail.split('@')[0] || 'CapyMembro',
          });
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('invalid login credentials')) {
            setErrorMessage('E-mail ou senha incorretos.');
          } else if (msg.includes('email not confirmed')) {
            setErrorMessage('Seu e-mail ainda não foi confirmado. Verifique a mensagem recebida em sua caixa de entrada para ativar sua conta.');
          } else {
            setErrorMessage(messageOf(error));
          }
          return;
        }

        if (data?.user) {
          try {
            const { data: prof } = await db()
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (prof) {
              onLogin({
                id: prof.id,
                name: prof.username || cleanEmail.split('@')[0],
                displayName: prof.display_name || prof.username || 'CapyMembro',
                avatar: getAvatarUrl(prof.avatar_url),
                bannerColor: prof.profile_primary_color || '#5865f2',
                bannerImage: prof.banner_url || undefined,
                aboutMe: prof.bio || '',
              });
              return;
            }
          } catch {}

          onLogin({
            id: data.user.id,
            name: cleanEmail.split('@')[0],
            displayName: cleanEmail.split('@')[0],
            avatar: DEFAULT_AVATAR,
          });
        }
      } catch (err: any) {
        setErrorMessage(messageOf(err));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = emailOrPhone.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Digite seu e-mail acima para solicitar a redefinição de senha.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (error) throw error;
        setSuccessMessage('Se a conta existir, enviamos instruções de redefinição para seu e-mail.');
      }
    } catch (err: any) {
      setErrorMessage(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-[#070913] text-white select-none overflow-y-auto md:overflow-hidden flex flex-col justify-between pt-safe pb-safe"
      style={{
        backgroundImage: `radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.28) 0%, transparent 55%),
                          radial-gradient(circle at 25% 65%, rgba(88, 101, 242, 0.25) 0%, transparent 55%),
                          url('/assets/login/fundo.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* ── 1. LOGOTIPO CAPYCHAT (TOPO ESQUERDO DESTACADO E NÍTIDO CONFORME EXEMPLO) ── */}
      <header className="absolute top-4 sm:top-9 left-4 sm:left-10 lg:left-12 z-40 pointer-events-none">
        <img
          src="/assets/login/capychat-tight.png"
          alt="CapyChat"
          className="h-8 sm:h-11 lg:h-12 w-auto object-contain drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]"
        />
      </header>

      {/* ── 2. CRISTAIS FLUTUANTES NAS MARGENS (REFERÊNCIA 1:1) ──────────────────── */}
      {/* Cristal flutuante superior esquerdo (profundidade / bokeh no céu cósmico) */}
      <div className="absolute top-[10vh] left-[23vw] w-[8vw] min-w-[85px] max-w-[130px] h-auto pointer-events-none select-none z-10 hidden sm:block">
        <img
          src="/assets/login/dado-topo-esq.png"
          alt=""
          className="w-full h-full object-contain filter blur-[0.6px] opacity-80 drop-shadow-[0_0_20px_rgba(168,85,247,0.7)]"
        />
      </div>

      {/* Cristal nítido com pata no chão reflexivo (ao lado da pata esquerda da capivara) */}
      <div className="absolute bottom-[3.5vh] left-[2.5vw] w-[10.5vw] min-w-[110px] max-w-[160px] h-auto pointer-events-none select-none z-30 hidden sm:block">
        <img
          src="/assets/login/cristal-dado.png"
          alt=""
          className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.95)]"
        />
      </div>

      {/* Cristal flutuante superior direito */}
      <div className="absolute top-[8vh] right-[4vw] w-[8.5vw] min-w-[90px] max-w-[140px] h-auto pointer-events-none select-none filter blur-[0.8px] opacity-75 hidden md:block z-10">
        <img
          src="/assets/login/cristal-bokeh-right.png"
          alt=""
          className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.6)]"
        />
      </div>

      {/* Cristal na base inferior direita */}
      <div className="absolute -bottom-[2vh] -right-[1vw] w-[15vw] min-w-[160px] max-w-[250px] h-auto pointer-events-none select-none filter blur-[1.5px] opacity-60 hidden sm:block z-10">
        <img
          src="/assets/login/cristal-bokeh-right.png"
          alt=""
          className="w-full h-full object-contain"
        />
      </div>

      {/* ── 3. COMPOSIÇÃO INTEGRADA: CAPIVARA À ESQUERDA & CARD CENTRALIZADO ──────── */}
      <div
        role="main"
        className="relative z-20 flex-1 w-full min-h-full flex items-center md:items-end justify-center px-4 sm:px-8 lg:px-12 py-16 sm:py-0 pb-6 sm:pb-[3.5vh] pt-16 sm:pt-[6vh]"
        style={{ background: 'transparent' }}
      >
        <div className="relative w-full max-w-[1650px] h-auto md:h-[76vh] md:min-h-[500px] md:max-h-[700px] flex flex-col md:flex-row items-center md:items-end justify-center gap-4 sm:gap-6 lg:gap-8">
          
          {/* COLUNA ESQUERDA: Mascote da Capivara (No desktop mantém 1:1; no mobile compacta no topo) */}
          <div className="relative flex-shrink-0 h-24 md:h-full w-24 md:w-[33vw] max-w-[560px] md:min-w-[340px] flex items-end justify-center z-20 pb-0.5">
            <div className="relative w-full h-full flex items-end justify-center">
              {/* Brilho suave difuso atrás da capivara */}
              <div className="absolute inset-x-0 bottom-2 md:bottom-4 h-3/4 bg-gradient-to-tr from-[#7c3aed]/35 via-[#ec4899]/18 to-transparent rounded-full blur-2xl md:blur-3xl scale-95 pointer-events-none" />
              <img
                src="/assets/login/capylogin.png"
                alt="Mascote CapyChat"
                className="h-full w-full object-contain object-bottom drop-shadow-[0_10px_25px_rgba(0,0,0,0.65)] md:drop-shadow-[0_20px_45px_rgba(0,0,0,0.65)] select-none pointer-events-none transform transition-transform duration-700 hover:scale-[1.01]"
              />
            </div>
          </div>

          {/* COLUNA DIREITA: Card Central de Autenticação (PROPORÇÃO LARGA E PERFEITAMENTE VISÍVEL) */}
          <div className="relative w-full flex-1 max-w-[880px] min-w-0 md:min-w-[480px] self-center bg-[#131527]/95 backdrop-blur-2xl border border-[#7c3aed]/40 rounded-2xl sm:rounded-[28px] p-5 sm:p-8 lg:p-9 shadow-[0_0_60px_rgba(124,58,237,0.22),0_25px_60px_rgba(0,0,0,0.65)] flex flex-col sm:flex-row items-stretch gap-6 sm:gap-8 lg:gap-10 z-20">
            
            {/* LADO ESQUERDO DO CARD: Formulário de Autenticação */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                {/* Título & Subtítulo */}
                <div className="mb-4 sm:mb-5">
                  <h2 className="text-2xl sm:text-[27px] font-extrabold text-white tracking-tight leading-snug">
                    {isRegistering ? 'Criar uma conta' : 'Boas-vindas de volta!'}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#949ba4] font-medium mt-1">
                    {isRegistering
                      ? 'Junte-se à comunidade oficial do CapyChat.'
                      : 'Sua comunidade está esperando por você.'}
                  </p>
                </div>

                {/* Avisos de Erro ou Sucesso */}
                {errorMessage && (
                  <div className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/35 text-red-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="leading-snug font-medium">{errorMessage}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="leading-snug font-medium">{successMessage}</span>
                  </div>
                )}

                {/* Formulário de Login / Registro */}
                <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
                  
                  {/* Campos adicionais para Registro */}
                  {isRegistering && (
                    <>
                      <div>
                        <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1.5 block">
                          Nome de Exibição
                        </label>
                        <div className="flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl bg-[#0e101f] border border-[#2e3150] focus-within:border-[#8b5cf6] focus-within:bg-[#121428] transition-all">
                          <Sparkles className="w-4 h-4 text-[#80848e] flex-shrink-0" />
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Como quer ser chamado?"
                            className="bg-transparent text-white text-base sm:text-sm outline-none w-full placeholder:text-[#6b7280]"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1.5 block">
                          Nome de Usuário
                        </label>
                        <div className="flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl bg-[#0e101f] border border-[#2e3150] focus-within:border-[#8b5cf6] focus-within:bg-[#121428] transition-all">
                          <UserIcon className="w-4 h-4 text-[#80848e] flex-shrink-0" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="nome_usuario"
                            className="bg-transparent text-white text-base sm:text-sm outline-none w-full placeholder:text-[#6b7280]"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* E-mail ou Telefone */}
                  <div>
                    <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1.5 block">
                      E-mail ou telefone
                    </label>
                    <div className="flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl bg-[#0e101f] border border-[#2e3150] focus-within:border-[#8b5cf6] focus-within:bg-[#121428] transition-all">
                      <Mail className="w-4 h-4 text-[#80848e] flex-shrink-0" />
                      <input
                        type="text"
                        value={emailOrPhone}
                        onChange={(e) => setEmailOrPhone(e.target.value)}
                        placeholder="Digite seu e-mail ou telefone"
                        className="bg-transparent text-white text-base sm:text-sm outline-none w-full placeholder:text-[#6b7280]"
                        required
                      />
                    </div>
                  </div>

                  {/* Senha */}
                  <div>
                    <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1.5 block">
                      Senha
                    </label>
                    <div className="flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl bg-[#0e101f] border border-[#2e3150] focus-within:border-[#8b5cf6] focus-within:bg-[#121428] transition-all">
                      <Lock className="w-4 h-4 text-[#80848e] flex-shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Digite sua senha"
                        className="bg-transparent text-white text-base sm:text-sm outline-none w-full placeholder:text-[#6b7280]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#80848e] hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Esqueceu sua senha? (Apenas no Login) */}
                  {!isRegistering && (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-[#8b5cf6] hover:underline font-semibold cursor-pointer"
                      >
                        Esqueceu sua senha?
                      </button>
                    </div>
                  )}

                  {/* Botão Principal: Entrar / Cadastrar */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2.5 py-3 sm:py-3.5 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-[0_4px_24px_rgba(88,101,242,0.45)] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{loading ? (isRegistering ? 'Cadastrando...' : 'Entrando...') : (isRegistering ? 'Cadastrar e Entrar' : 'Entrar')}</span>
                  </button>
                </form>
              </div>

              {/* Alternância Login / Cadastro */}
              <div className="mt-4 sm:mt-5 text-xs text-[#949ba4] text-left">
                {isRegistering ? (
                  <>
                    Já tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(false);
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[#8b5cf6] hover:underline font-semibold cursor-pointer"
                    >
                      Entrar
                    </button>
                  </>
                ) : (
                  <>
                    Ainda não tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[#8b5cf6] hover:underline font-semibold cursor-pointer"
                    >
                      Crie sua conta
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* LADO DIREITO DO CARD: QR Code (Em Breve) */}
            <div className="w-full sm:w-[220px] lg:w-[240px] flex flex-col items-center justify-center text-center pl-0 sm:pl-7 sm:border-l border-[#2e3150]/80 pt-4 sm:pt-0 select-none">
              {/* Ilustração decorativa do QR Code com badge "EM BREVE" */}
              <div className="relative">
                <div
                  className="w-40 h-40 sm:w-44 sm:h-44 lg:w-48 lg:h-48 p-2.5 bg-white/95 rounded-2xl shadow-xl shadow-black/40 flex items-center justify-center relative overflow-hidden pointer-events-none select-none"
                  aria-hidden="true"
                >
                  <img
                    src="/assets/login/qrcode.png"
                    alt=""
                    className="w-full h-full object-contain filter grayscale-[30%] opacity-85"
                  />
                  {/* Overlay suave fosco decorativo */}
                  <div className="absolute inset-0 bg-[#070913]/10 backdrop-blur-[0.5px]" />
                </div>

                {/* Selo / Indicador Elegante "EM BREVE" */}
                <div className="absolute -top-2.5 -right-2 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg shadow-indigo-500/30 border border-white/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Em Breve</span>
                </div>
              </div>

              {/* Título & Descrição Informativa */}
              <h3 className="text-base sm:text-lg font-bold text-white mt-4 tracking-tight">
                Login por QR Code
              </h3>
              <p className="text-[11px] sm:text-xs text-[#949ba4] max-w-[200px] mt-1.5 leading-relaxed">
                Entre na sua conta rapidamente escaneando um código. Esse recurso estará disponível em breve.
              </p>

              {/* Selo informativo complementar discreto */}
              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[#a5b4fc] bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 px-2.5 py-1 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] animate-pulse" />
                <span>Recurso em desenvolvimento</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Espaçador inferior */}
      <div className="h-1 pointer-events-none" />
    </div>
  );
};
