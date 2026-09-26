import authBackground from "../../../assets/auth/background.png";
import authLogo from "../../../assets/auth/logo.png";
import authMascot from "../../../assets/auth/mascot.png";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import "./auth.css";
import { useEffect, useState } from "react";
import { supabase, db, messageOf, configured } from "../../lib/supabase";
import { demoProfile } from "../../services/demo";
import type { Profile } from "../../types";
import { ErrorNotice, useTask } from "../../components/ui";
export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const load = async (id?: string) => {
      if (sessionStorage.getItem("lyc-recovery")) {
        setLoading(false);
        return;
      }
      if (!id) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await db()
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
        if (active) {
          setProfile(data);
          setError("");
        }
      } catch (e) {
        if (active) setError(messageOf(e));
      } finally {
        if (active) setLoading(false);
      }
    };
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError(error.message);
        setLoading(false);
      } else void load(data.session?.user.id);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (active) void load(session?.user.id);
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return {
    profile,
    setProfile,
    loading,
    error,
    enterDemo: () => setProfile(demoProfile),
    logout: async () => {
      sessionStorage.removeItem("lyc-recovery");
      if (supabase) await supabase.auth.signOut();
      setProfile(null);
    },
  };
}
export function Auth({
  error: outerError,
}: {
  onDemo: () => void;
  error: string;
}) {
  const [mode, setMode] = useState<
    "login" | "signup" | "reset" | "verify" | "password"
  >(
    sessionStorage.getItem("lyc-recovery") === "verified"
      ? "password"
      : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const task = useTask();
  const switchMode = (next: typeof mode) => {
    setMode(next);
    setNotice("");
    task.setError("");
    setConfirmation("");
    setShowPassword(false);
    setShowConfirmation(false);
  };
  return (
    <main className="arena-auth">
      <div className="arena-auth-brand">
        <img src={authLogo} alt="LYC Arena" draggable={false} />
      </div>
      <div className="arena-auth-scenery" aria-hidden="true">
        <img
          className="arena-auth-background"
          src={authBackground}
          alt=""
          draggable={false}
        />
        <div className="arena-auth-mascot">
          <img src={authMascot} alt="" draggable={false} />
        </div>
      </div>
      <section
        className={"arena-auth-card " + (mode === "signup" ? "is-signup" : "")}
        aria-labelledby="auth-title"
      >
        {mode !== "login" && (
          <button
            type="button"
            className="arena-auth-back"
            disabled={task.busy}
            onClick={() => switchMode("login")}
          >
            <ArrowLeft size={16} />
            Voltar para o login
          </button>
        )}
        <header key={mode} className="arena-auth-heading">
          <h1 id="auth-title">
            {
              {
                login: "Bem-vindo de volta!",
                signup: "Criar sua conta",
                reset: "Recupere sua conta",
                verify: "Confirme seu código",
                password: "Nova senha",
              }[mode]
            }
          </h1>
          <p>
            {mode === "login" ? (
              <>
                Entre com sua conta para continuar
                <br />
                na LYC ARENA.
              </>
            ) : mode === "signup" ? (
              <>
                Preencha os dados abaixo para começar
                <br />
                na LYC ARENA.
              </>
            ) : mode === "reset" ? (
              "Informe o e-mail da sua conta."
            ) : mode === "verify" ? (
              "Digite o código recebido por e-mail."
            ) : (
              "Escolha uma nova senha para sua conta."
            )}
          </p>
        </header>
        <ErrorNotice text={outerError || task.error} />
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              if (mode === "login") {
                sessionStorage.removeItem("lyc-recovery");
                const { error } = await db().auth.signInWithPassword({
                  email,
                  password,
                });
                if (error) throw error;
              }
              if (mode === "signup") {
                if (password !== confirmation)
                  throw new Error("As senhas não coincidem.");
                const { error } = await db().auth.signUp({
                  email,
                  password,
                  options: { data: { display_name: name } },
                });
                if (error) throw error;
                setNotice("Conta criada. Confirme seu e-mail antes de entrar.");
              }
              if (mode === "reset") {
                const { error } = await db().auth.resetPasswordForEmail(email);
                if (error) throw error;
                setNotice("Se a conta existir, enviaremos um código.");
                setMode("verify");
              }
              if (mode === "verify") {
                sessionStorage.setItem("lyc-recovery", "1");
                const { error } = await db().auth.verifyOtp({
                  email,
                  token,
                  type: "recovery",
                });
                if (error) {
                  sessionStorage.removeItem("lyc-recovery");
                  throw error;
                }
                sessionStorage.setItem("lyc-recovery", "verified");
                setMode("password");
              }
              if (mode === "password") {
                const { error } = await db().auth.updateUser({ password });
                if (error) throw error;
                sessionStorage.removeItem("lyc-recovery");
                await db().auth.signOut();
                setMode("login");
                setNotice("Senha atualizada. Entre com sua nova senha.");
              }
            });
          }}
        >
          <fieldset disabled={task.busy}>
            {mode === "signup" && (
              <div className="arena-auth-field">
                <label className="arena-auth-input">
                  <UserRound size={18} />
                  <input
                    aria-label="Nome de usuário"
                    autoComplete="nickname"
                    required
                    maxLength={40}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome de usuário"
                    aria-describedby="auth-name-hint"
                  />
                </label>
                <small id="auth-name-hint">
                  Escolha um nome que será exibido na comunidade.
                </small>
              </div>
            )}
            {mode !== "password" && (
              <div className="arena-auth-field">
                <label className="arena-auth-input">
                  <Mail size={18} />
                  <input
                    aria-label="E-mail"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail"
                  />
                </label>
                {mode === "signup" && <small>Informe um e-mail válido.</small>}
              </div>
            )}
            {["login", "signup", "password"].includes(mode) && (
              <div className="arena-auth-field">
                <div className="arena-auth-input">
                  <LockKeyhole size={18} />
                  <input
                    aria-label="Senha"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
                {mode !== "login" && <small>Mínimo de 8 caracteres.</small>}
              </div>
            )}
            {mode === "signup" && (
              <div className="arena-auth-field">
                <div className="arena-auth-input">
                  <LockKeyhole size={18} />
                  <input
                    aria-label="Confirmar senha"
                    autoComplete="new-password"
                    type={showConfirmation ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="Confirmar senha"
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmation
                        ? "Ocultar confirmação"
                        : "Mostrar confirmação"
                    }
                    aria-pressed={showConfirmation}
                    onClick={() => setShowConfirmation((v) => !v)}
                  >
                    {showConfirmation ? (
                      <Eye size={18} />
                    ) : (
                      <EyeOff size={18} />
                    )}
                  </button>
                </div>
                <small>Digite a mesma senha novamente.</small>
              </div>
            )}
            {mode === "verify" && (
              <label className="arena-auth-input">
                <Mail size={18} />
                <input
                  aria-label="Código do e-mail"
                  autoComplete="one-time-code"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Código do e-mail"
                />
              </label>
            )}
            {mode === "login" && (
              <div className="arena-auth-options">
                <label title="Sua sessão é mantida automaticamente neste dispositivo.">
                  <input type="checkbox" checked disabled />
                  Manter-me conectado
                </label>
                <button type="button" onClick={() => switchMode("reset")}>
                  Esqueceu sua senha?
                </button>
              </div>
            )}
            <button className="arena-auth-submit" type="submit">
              {task.busy
                ? "Aguarde…"
                : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : "Continuar"}
              <ArrowRight size={18} />
            </button>
          </fieldset>
        </form>
        {mode === "login" ? (
          <p className="arena-auth-footer">
            Não tem uma conta?{" "}
            <button disabled={task.busy} onClick={() => switchMode("signup")}>
              Registre-se
            </button>
          </p>
        ) : (
          mode === "signup" && (
            <p className="arena-auth-footer">
              Já tem uma conta?{" "}
              <button disabled={task.busy} onClick={() => switchMode("login")}>
                Entrar
              </button>
            </p>
          )
        )}
      </section>
    </main>
  );
}
