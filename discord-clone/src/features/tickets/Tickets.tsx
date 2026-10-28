import { useCallback, useEffect, useState } from "react";
import { Plus, ArrowLeft, Send } from "lucide-react";
import { db, supabase } from "../../lib/supabase";
import { readLocal, writeLocal } from "../../services/demo";
import { useAsync } from "../../hooks/useAsync";
import {
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  Submit,
  useTask,
  Avatar,
} from "../../components/ui";
import { isStaff, cleanContent } from "../../lib/permissions";
import type { Profile, Ticket, TicketMessage } from "../../types";
export function Tickets({ profile }: { profile: Profile }) {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Dúvida");
  const task = useTask();
  const result = useAsync(
    useCallback(async () => {
      if (!supabase) return readLocal().tickets;
      const { data, error } = await db()
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    }, []),
  );
  if (selected)
    return (
      <TicketDetail
        initial={selected}
        profile={profile}
        onBack={() => {
          setSelected(null);
          void result.reload();
        }}
      />
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ESTAMOS DO SEU LADO</span>
          <h1>Central de suporte</h1>
          <p className="muted">Uma conversa privada com a equipe LYC.</p>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>
          <Plus size={17} /> Abrir ticket
        </button>
      </div>
      <ErrorNotice text={result.error || task.error} />
      {result.loading ? (
        <Loading />
      ) : !result.data?.length ? (
        <Empty title="Tudo tranquilo por aqui">
          Precisa de ajuda? Abra um ticket para falar com a staff.
        </Empty>
      ) : (
        <div className="ticket-list">
          {result.data.map((t) => (
            <button
              className="ticket-row"
              key={t.id}
              onClick={() => setSelected(t)}
            >
              <span className="ticket-number">#{t.id.slice(0, 6)}</span>
              <div>
                <b>{t.subject}</b>
                <small>
                  {t.category} ·{" "}
                  {new Date(t.created_at).toLocaleDateString("pt-BR")}
                </small>
              </div>
              <span className={"badge " + t.status}>
                {t.status.replaceAll("_", " ")}
              </span>
              <span>→</span>
            </button>
          ))}
        </div>
      )}
      {creating && (
        <Modal title="Como podemos ajudar?" onClose={() => setCreating(false)}>
          <ErrorNotice text={task.error} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                const values = {
                  user_id: profile.id,
                  subject: subject.trim(),
                  description: cleanContent(description),
                  category,
                };
                if (supabase) {
                  const { error } = await db().from("tickets").insert(values);
                  if (error) throw error;
                } else {
                  const d = readLocal();
                  d.tickets.push({
                    ...values,
                    id: crypto.randomUUID(),
                    status: "ABERTO",
                    assigned_to: null,
                    created_at: new Date().toISOString(),
                  });
                  writeLocal(d);
                }
                setCreating(false);
                await result.reload();
              });
            }}
          >
            <label>
              Categoria
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {["Dúvida", "Competição", "Denúncia", "Problema técnico"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Assunto
              <input
                required
                maxLength={120}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label>
              O que aconteceu?
              <textarea
                required
                maxLength={4000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <Submit busy={task.busy}>Enviar ticket</Submit>
          </form>
        </Modal>
      )}
    </div>
  );
}
function TicketDetail({
  initial,
  profile,
  onBack,
}: {
  initial: Ticket;
  profile: Profile;
  onBack: () => void;
}) {
  const [ticket, setTicket] = useState(initial);
  const [content, setContent] = useState("");
  const [events, setEvents] = useState<
    { id: string; detail: string; created_at: string }[]
  >([]);
  const task = useTask();
  const result = useAsync(
    useCallback(async () => {
      if (!supabase)
        return readLocal().ticketMessages.filter(
          (m) => m.ticket_id === initial.id,
        );
      const { data, error } = await db()
        .from("ticket_messages")
        .select("*,profiles(*)")
        .eq("ticket_id", initial.id)
        .order("created_at");
      if (error) throw error;
      return data as TicketMessage[];
    }, [initial.id]),
  );
  useEffect(() => {
    if (!supabase) return;
    const sync = async () => {
      const { data } = await db()
        .from("tickets")
        .select("*")
        .eq("id", initial.id)
        .single();
      if (data) setTicket(data);
      const { data: history } = await db()
        .from("ticket_history")
        .select("*")
        .eq("ticket_id", initial.id)
        .order("created_at");
      setEvents(history || []);
    };
    void sync();
    const ch = supabase
      .channel("ticket:" + initial.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: "ticket_id=eq." + initial.id,
        },
        () => {
          void result.reload();
          void window.arena?.notify(
            "Ticket atualizado",
            "Há uma nova resposta no seu atendimento.",
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
          filter: "id=eq." + initial.id,
        },
        () => void sync(),
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(ch);
    };
  }, [initial.id, result.reload]);
  const status = async (value: Ticket["status"]) => {
    if (supabase) {
      const { error } = await db()
        .from("tickets")
        .update({ status: value, assigned_to: profile.id })
        .eq("id", ticket.id);
      if (error) throw error;
    } else {
      const d = readLocal();
      d.tickets = d.tickets.map((t) =>
        t.id === ticket.id
          ? { ...t, status: value, assigned_to: profile.id }
          : t,
      );
      writeLocal(d);
    }
    setTicket((t) => ({ ...t, status: value, assigned_to: profile.id }));
  };
  return (
    <div className="page">
      <button onClick={onBack}>
        <ArrowLeft size={16} /> Todos os tickets
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{ticket.category}</span>
          <h1>{ticket.subject}</h1>
        </div>
        <span className="badge">{ticket.status}</span>
      </div>
      <div className="panel">
        <p>{ticket.description}</p>
      </div>
      <ErrorNotice text={result.error || task.error} />
      {isStaff(profile.role) && (
        <div className="button-row">
          <button
            disabled={task.busy}
            onClick={() => void task.run(() => status("EM_ATENDIMENTO"))}
          >
            Assumir atendimento
          </button>
          <button
            disabled={task.busy}
            onClick={() =>
              void task.run(() =>
                status(ticket.status === "FECHADO" ? "ABERTO" : "FECHADO"),
              )
            }
          >
            {ticket.status === "FECHADO" ? "Reabrir" : "Fechar ticket"}
          </button>
        </div>
      )}
      <div className="ticket-conversation">
        {result.data?.map((m) => (
          <article className="message" key={m.id}>
            <Avatar
              userId={m.author_id}
              url={m.profiles?.avatar_url}
              name={m.profiles?.display_name || "Membro"}
            />
            <div>
              <b>{m.profiles?.display_name || "Membro"}</b>
              <small>{new Date(m.created_at).toLocaleString("pt-BR")}</small>
              <p>{m.content}</p>
            </div>
          </article>
        ))}
      </div>
      {ticket.status !== "FECHADO" && (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              const values = {
                ticket_id: ticket.id,
                author_id: profile.id,
                content: cleanContent(content),
              };
              if (supabase) {
                const { error } = await db()
                  .from("ticket_messages")
                  .insert(values);
                if (error) throw error;
              } else {
                const d = readLocal();
                d.ticketMessages.push({
                  ...values,
                  id: crypto.randomUUID(),
                  created_at: new Date().toISOString(),
                  profiles: profile,
                });
                writeLocal(d);
              }
              setContent("");
              await result.reload();
            });
          }}
        >
          <input
            aria-label="Resposta ao ticket"
            required
            maxLength={4000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva sua resposta…"
          />
          <button className="primary" disabled={task.busy}>
            <Send size={16} />
          </button>
        </form>
      )}
      <details className="panel">
        <summary>Histórico do atendimento</summary>
        {events.length ? (
          events.map((e) => (
            <p key={e.id}>
              {new Date(e.created_at).toLocaleString("pt-BR")} · {e.detail}
            </p>
          ))
        ) : (
          <p>
            Criado em {new Date(ticket.created_at).toLocaleString("pt-BR")}.{" "}
            {supabase ? "" : "Histórico detalhado disponível com Supabase."}
          </p>
        )}
      </details>
    </div>
  );
}
