import { useCallback, useState } from "react";
import { Avatar, ErrorNotice, Submit, useTask } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { db } from "../../lib/supabase";
import {
  communityAction,
  communityPermissionLabels,
  type Community,
  type CommunityRole,
  type Member,
} from "../../services/communities";

export function OrderButtons({
  items,
  id,
  name,
  busy,
  move,
}: {
  items: { id: string }[];
  id: string;
  name: string;
  busy: boolean;
  move: (ids: string[]) => Promise<unknown>;
}) {
  const index = items.findIndex((item) => item.id === id);
  const change = (offset: number) => {
    const ids = items.map((item) => item.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    void move(ids);
  };
  return (
    <>
      <button
        disabled={busy || index <= 0}
        aria-label={"Subir " + name}
        onClick={() => change(-1)}
      >
        ↑
      </button>
      <button
        disabled={busy || index < 0 || index === items.length - 1}
        aria-label={"Descer " + name}
        onClick={() => change(1)}
      >
        ↓
      </button>
    </>
  );
}
export function RoleManager({
  community,
  roles,
  members,
  permissions,
  userId,
  onChanged,
}: {
  community: Community;
  roles: CommunityRole[];
  members: Member[];
  permissions: string[];
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const task = useTask();
  const [draft, setDraft] = useState<{
    id: string;
    name: string;
    position: number;
    permissions: string[];
  }>({ id: "", name: "", position: 1, permissions: [] });
  const owner = community.owner_id === userId;
  const actor = roles.find(
    (r) => r.id === members.find((m) => m.user_id === userId)?.role_id,
  );
  const editable = (r: CommunityRole) =>
    r.base_role !== "OWNER" &&
    (owner || (r.id !== actor?.id && r.position < (actor?.position || 0)));
  const grantable = (r: CommunityRole) =>
    editable(r) &&
    (owner || r.permissions?.every((p) => permissions.includes(p)));
  const run = async (action: string, payload: Record<string, unknown>) => {
    await communityAction(action, { community_id: community.id, ...payload });
    await onChanged();
  };
  const reset = () =>
    setDraft({ id: "", name: "", position: 1, permissions: [] });
  return (
    <section className="panel">
      <h3>Cargos e permissões</h3>
      <ErrorNotice text={task.error} />
      <p className="muted">
        Maior prioridade significa maior autoridade. O proprietário sempre tem
        controle total. Cada membro possui um cargo nesta comunidade; remover
        retorna ao cargo Membro.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await run(draft.id ? "edit_role" : "create_role", draft);
            reset();
          });
        }}
      >
        <h3>{draft.id ? "Editar cargo" : "Novo cargo"}</h3>
        <label>
          Nome do cargo
          <input
            required
            maxLength={40}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Prioridade do cargo
          <input
            type="number"
            min={0}
            max={owner ? 99 : (actor?.position || 1) - 1}
            required
            value={draft.position}
            onChange={(e) =>
              setDraft({ ...draft, position: Number(e.target.value) })
            }
          />
        </label>
        <fieldset>
          <legend>Permissões do cargo</legend>
          {Object.entries(communityPermissionLabels).map(([key, label]) => (
            <label className="checkbox" key={key}>
              <input
                type="checkbox"
                checked={draft.permissions.includes(key)}
                disabled={!owner && !permissions.includes(key)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    permissions: e.target.checked
                      ? [...draft.permissions, key]
                      : draft.permissions.filter((p) => p !== key),
                  })
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <Submit busy={task.busy}>
          {draft.id ? "Salvar cargo" : "Criar cargo"}
        </Submit>
        {draft.id && (
          <button type="button" onClick={reset}>
            Cancelar edição do cargo
          </button>
        )}
      </form>
      {roles.map((r) => (
        <div className="ticket-row" key={r.id}>
          <b>{r.name}</b>
          <span>Prioridade {r.position}</span>
          {editable(r) && (
            <>
              <button
                disabled={task.busy}
                onClick={() =>
                  setDraft({
                    id: r.id,
                    name: r.name,
                    position: r.position,
                    permissions: r.permissions || [],
                  })
                }
              >
                Editar cargo {r.name}
              </button>
              {!r.base_role && (
                <button
                  disabled={task.busy}
                  onClick={() =>
                    void task.run(async () => {
                      if (
                        !confirm(
                          "Excluir o cargo " +
                            r.name +
                            "? Os membros com esse cargo voltarão a Membro.",
                        )
                      )
                        return;
                      await run("delete_role", { id: r.id });
                      if (draft.id === r.id) reset();
                    })
                  }
                >
                  Excluir cargo {r.name}
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <h3>Membros e cargos</h3>
      {members.map((m) => {
        const subject = roles.find((r) => r.id === m.role_id);
        const allowed =
          m.user_id !== community.owner_id &&
          (owner || (m.user_id !== userId && !!subject && editable(subject)));
        return (
          <div className="ticket-row" key={m.user_id}>
            <Avatar
              userId={m.user_id}
              name={m.profiles.display_name}
              url={m.profiles.avatar_url}
            />
            <b>{m.profiles.display_name}</b>
            {allowed ? (
              <>
                <select
                  aria-label={"Cargo de " + m.profiles.display_name}
                  value={m.role_id}
                  disabled={task.busy}
                  onChange={(e) =>
                    void task.run(() =>
                      run("assign_role", {
                        user_id: m.user_id,
                        role_id: e.target.value,
                      }),
                    )
                  }
                >
                  {roles
                    .filter((r) => r.id === m.role_id || grantable(r))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
                {subject?.base_role !== "MEMBER" && (
                  <button
                    disabled={task.busy}
                    onClick={() =>
                      void task.run(() =>
                        run("remove_role", {
                          user_id: m.user_id,
                          role_id: m.role_id,
                        }),
                      )
                    }
                  >
                    Remover cargo de {m.profiles.display_name}
                  </button>
                )}
              </>
            ) : (
              <span>{m.community_roles.name}</span>
            )}
          </div>
        );
      })}
      {owner && (
        <OwnershipTransfer
          community={community}
          members={members}
          onChanged={onChanged}
        />
      )}
    </section>
  );
}
function OwnershipTransfer({
  community,
  members,
  onChanged,
}: {
  community: Community;
  members: Member[];
  onChanged: () => Promise<void>;
}) {
  const task = useTask();
  const [target, setTarget] = useState("");
  const [confirmation, setConfirmation] = useState("");
  return (
    <details>
      <summary>Transferir propriedade</summary>
      <p>
        Esta operação torna o sucessor proprietário e seu cargo passa a
        Administrador.
      </p>
      <ErrorNotice text={task.error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await communityAction("transfer_ownership", {
              community_id: community.id,
              user_id: target,
              confirm_name: confirmation,
            });
            setTarget("");
            setConfirmation("");
            await onChanged();
          });
        }}
      >
        <label>
          Novo proprietário
          <select
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Selecione um membro</option>
            {members
              .filter((m) => m.user_id !== community.owner_id)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profiles.display_name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Digite o nome da comunidade para confirmar
          <input
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="danger"
          disabled={task.busy || !target || confirmation !== community.name}
        >
          Confirmar transferência de propriedade
        </button>
      </form>
    </details>
  );
}
interface Invite {
  code: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
}
export function InviteManager({
  community,
  onChanged,
}: {
  community: Community;
  onChanged: () => Promise<void>;
}) {
  const task = useTask();
  const [expires, setExpires] = useState(""),
    [uses, setUses] = useState("");
  const invites = useAsync(
    useCallback(async () => {
      const { data, error } = await db()
        .from("community_invites")
        .select("code,expires_at,max_uses,uses,revoked_at")
        .eq("community_id", community.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invite[];
    }, [community.id, community.revision]),
  );
  return (
    <section className="panel">
      <h3>Convites</h3>
      <ErrorNotice text={task.error || invites.error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await communityAction("invite", {
              community_id: community.id,
              expires_at: expires ? new Date(expires).toISOString() : null,
              max_uses: uses ? Number(uses) : null,
            });
            await invites.reload();
            await onChanged();
          });
        }}
      >
        <label>
          Expiração (opcional)
          <input
            type="datetime-local"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </label>
        <label>
          Limite de usos (opcional)
          <input
            type="number"
            min={1}
            step={1}
            value={uses}
            onChange={(e) => setUses(e.target.value)}
          />
        </label>
        <Submit busy={task.busy}>Gerar convite</Submit>
      </form>
      {invites.data?.map((inv) => {
        const inactive =
          !!inv.revoked_at ||
          (!!inv.expires_at && Date.parse(inv.expires_at) <= Date.now()) ||
          (inv.max_uses !== null && inv.uses >= inv.max_uses);
        return (
          <div className="panel" key={inv.code}>
            <label>
              Código do convite
              <input readOnly value={inv.code} />
            </label>
            <small>
              {inv.revoked_at
                ? "Revogado"
                : inactive
                  ? "Expirado ou esgotado"
                  : "Ativo"}{" "}
              · Usos {inv.uses}/{inv.max_uses ?? "ilimitados"} ·{" "}
              {inv.expires_at
                ? new Date(inv.expires_at).toLocaleString()
                : "Sem expiração"}
            </small>
            <button
              disabled={inactive || task.busy}
              onClick={() =>
                void task.run(() => navigator.clipboard.writeText(inv.code))
              }
            >
              Copiar código
            </button>
            <button
              disabled={!!inv.revoked_at || task.busy}
              onClick={() =>
                void task.run(async () => {
                  await communityAction("revoke_invite", {
                    community_id: community.id,
                    code: inv.code,
                  });
                  await invites.reload();
                  await onChanged();
                })
              }
            >
              Revogar convite
            </button>
          </div>
        );
      })}
    </section>
  );
}
