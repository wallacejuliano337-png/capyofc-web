import { useCallback, useState } from "react";
import { db, supabase } from "../../lib/supabase";
import { useAsync } from "../../hooks/useAsync";
import { ErrorNotice, Submit, useTask } from "../../components/ui";
import type { Channel, Profile } from "../../types";
import { isAdmin } from "../../lib/permissions";
export function Admin({
  profile,
  onChannelsChanged,
}: {
  profile: Profile;
  onChannelsChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("COMUNIDADE");
  const [kind, setKind] = useState("text");
  const task = useTask();
  const result = useAsync(
    useCallback(async () => {
      if (!supabase) return [];
      const { data, error } = await db()
        .from("channels")
        .select("*")
        .is("team_id", null)
        .order("name");
      if (error) throw error;
      return data as Channel[];
    }, []),
  );
  if (!isAdmin(profile.role))
    return <ErrorNotice text="Acesso restrito à administração." />;
  return (
    <div className="page">
      <span className="eyebrow">GESTÃO DA ARENA</span>
      <h1>Administração</h1>
      <p className="muted">
        Canais ativos. Cargos, punições e temporadas têm estrutura no banco e
        exigem expansão do painel.
      </p>
      <ErrorNotice text={task.error || result.error} />
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            const { error } = await db()
              .from("channels")
              .insert({ name, category, kind, description: "" });
            if (error) throw error;
            setName("");
            await result.reload();
            onChannelsChanged();
          });
        }}
      >
        <h2>Novo canal</h2>
        <label>
          Nome
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Categoria
          <input
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label>
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="text">Texto</option>
            <option value="voice">Voz</option>
          </select>
        </label>
        <Submit busy={task.busy}>Criar canal</Submit>
      </form>
      {result.data?.map((c) => (
        <div className="ticket-row" key={c.id}>
          <b>{c.name}</b>
          <span>{c.kind}</span>
          <button
            disabled={task.busy}
            onClick={() =>
              void task.run(async () => {
                if (!confirm("Excluir o canal e seu histórico?")) return;
                const { error } = await db()
                  .from("channels")
                  .delete()
                  .eq("id", c.id);
                if (error) throw error;
                await result.reload();
                onChannelsChanged();
              })
            }
          >
            Excluir
          </button>
        </div>
      ))}
    </div>
  );
}
