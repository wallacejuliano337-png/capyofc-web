import { Component, type ReactNode, useState } from "react";
import { X, AlertCircle, LoaderCircle } from "lucide-react";
import { useAvatarUrl } from "../hooks/useAvatar";
export function Avatar({
  name,
  url,
  size = 38,
  userId,
}: {
  name: string;
  userId?: string;
  url?: string | null;
  size?: number;
}) {
  const source = useAvatarUrl(userId, url);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {source && failed !== source ? (
        <img src={source} alt="" onError={() => setFailed(source)} />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">L</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ErrorNotice({ text }: { text: string }) {
  return text ? (
    <div role="alert" className="error">
      <AlertCircle size={16} />
      {text}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" />
      Carregando…
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Empty title="Algo não saiu como esperado">
        <button onClick={() => location.reload()}>Reabrir o aplicativo</button>
      </Empty>
    ) : (
      this.props.children
    );
  }
}
export function Submit({
  children,
  busy,
}: {
  children: ReactNode;
  busy: boolean;
}) {
  return (
    <button type="submit" className="primary" disabled={busy}>
      {busy ? "Aguarde…" : children}
    </button>
  );
}
export function useTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return {
    busy,
    error,
    setError,
    run: async (fn: () => Promise<void>) => {
      setBusy(true);
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : String((e as { message?: string }).message || e),
        );
      } finally {
        setBusy(false);
      }
    },
  };
}
