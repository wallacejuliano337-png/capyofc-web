import { useCallback, useState } from "react";
import { Plus, Shield, Users } from "lucide-react";
import { db, supabase } from "../../lib/supabase";
import { readLocal, writeLocal } from "../../services/demo";
import { useAsync } from "../../hooks/useAsync";
import {
  Avatar,
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  Submit,
  useTask,
} from "../../components/ui";
import type { Profile, Team, TeamMember } from "../../types";
import { isAdmin } from "../../lib/permissions";
export function Teams({
  profile,
  onChanged,
}: {
  profile: Profile;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<Team | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const task = useTask();
  const result = useAsync(
    useCallback(async () => {
      if (!supabase) return readLocal().teams;
      const { data, error } = await db()
        .from("teams")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Team[];
    }, []),
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">JUNTOS NA QUEDA</span>
          <h1>Equipes</h1>
          <p className="muted">Encontre seu lugar. Construa sua história.</p>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>
          <Plus size={17} /> Criar equipe
        </button>
      </div>
      <ErrorNotice text={result.error || task.error} />
      {result.loading ? (
        <Loading />
      ) : !result.data?.length ? (
        <Empty title="A próxima equipe pode ser a sua">
          Crie seu squad e organize o elenco.
        </Empty>
      ) : (
        <div className="team-grid">
          {result.data.map((team) => (
            <button
              className="team-card"
              key={team.id}
              onClick={() => setSelected(team)}
            >
              <Shield size={32} />
              <span className="eyebrow">{team.tag}</span>
              <h2>{team.name}</h2>
              <span className="muted">Ver equipe →</span>
            </button>
          ))}
        </div>
      )}
      {creating && (
        <Modal title="Criar equipe" onClose={() => setCreating(false)}>
          <ErrorNotice text={task.error} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                if (supabase) {
                  const { error } = await db().rpc("create_team", {
                    team_name: name,
                    team_tag: tag,
                  });
                  if (error) throw error;
                } else {
                  const d = readLocal();
                  const id = crypto.randomUUID();
                  d.teams.push({
                    id,
                    name,
                    tag,
                    captain_id: profile.id,
                    logo_url: null,
                    created_at: new Date().toISOString(),
                  });
                  d.members.push({
                    team_id: id,
                    user_id: profile.id,
                    slot: "CAPTAIN",
                    profiles: profile,
                  });
                  writeLocal(d);
                }
                setCreating(false);
                await result.reload();
                onChanged();
              });
            }}
          >
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
              Tag
              <input
                required
                pattern="[A-Za-z0-9]{2,6}"
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
              />
            </label>
            <p className="muted">
              Você será a capitã. Em produção, um canal privado é criado
              automaticamente.
            </p>
            <Submit busy={task.busy}>Criar equipe</Submit>
          </form>
        </Modal>
      )}
      {selected && (
        <TeamDetail
          team={selected}
          profile={profile}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function TeamDetail({
  team,
  profile,
  onClose,
}: {
  team: Team;
  profile: Profile;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [slot, setSlot] = useState("PLAYER");
  const task = useTask();
  const canManage = team.captain_id === profile.id || isAdmin(profile.role);
  const result = useAsync(
    useCallback(async () => {
      if (!supabase)
        return readLocal().members.filter((m) => m.team_id === team.id);
      const { data, error } = await db()
        .from("team_members")
        .select("*,profiles(*)")
        .eq("team_id", team.id);
      if (error) throw error;
      return data as TeamMember[];
    }, [team.id]),
  );
  return (
    <Modal title={team.name + " · " + team.tag} onClose={onClose}>
      <ErrorNotice text={result.error || task.error} />
      <p className="muted">
        <Users size={16} /> Elenco · canal privado acessível apenas aos membros
        e administradores.
      </p>
      {result.loading ? (
        <Loading />
      ) : (
        result.data?.map((m) => (
          <div className="roster" key={m.user_id}>
            <Avatar
              userId={m.user_id}
              url={m.profiles?.avatar_url}
              name={m.profiles?.display_name || "Membro"}
            />
            <div>
              <b>{m.profiles?.display_name || m.user_id}</b>
              <small>{m.slot}</small>
            </div>
            {canManage && m.user_id !== team.captain_id && (
              <button
                onClick={() =>
                  void task.run(async () => {
                    if (supabase) {
                      const { error } = await db()
                        .from("team_members")
                        .delete()
                        .eq("team_id", team.id)
                        .eq("user_id", m.user_id);
                      if (error) throw error;
                    } else {
                      const d = readLocal();
                      d.members = d.members.filter(
                        (v) =>
                          !(v.team_id === team.id && v.user_id === m.user_id),
                      );
                      writeLocal(d);
                    }
                    await result.reload();
                  })
                }
              >
                Remover
              </button>
            )}
          </div>
        ))
      )}
      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              if (!supabase)
                throw new Error("Adicionar outros usuários requer Supabase.");
              const { data, error } = await db()
                .from("profiles")
                .select("id")
                .eq("username", username)
                .single();
              if (error) throw new Error("Username não encontrado.");
              const { error: insertError } = await db()
                .from("team_members")
                .insert({ team_id: team.id, user_id: data.id, slot });
              if (insertError) throw insertError;
              setUsername("");
              await result.reload();
            });
          }}
        >
          <label>
            Adicionar pelo username
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username do jogador"
            />
          </label>
          <label>
            Posição
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="PLAYER">Jogador</option>
              <option value="RESERVE">Reserva</option>
            </select>
          </label>
          <Submit busy={task.busy}>Adicionar ao elenco</Submit>
        </form>
      )}
    </Modal>
  );
}
