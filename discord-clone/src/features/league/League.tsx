import { useCallback } from "react";
import { Trophy, CalendarDays, Flag } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { db, supabase } from "../../lib/supabase";
import { Empty, ErrorNotice, Loading } from "../../components/ui";
interface Season {
  id: string;
  name: string;
  status: string;
  scoring_rules: Record<string, unknown>;
}
interface Round {
  id: string;
  name: string;
  starts_at: string | null;
  status: string;
}
export function League() {
  const result = useAsync(
    useCallback(async () => {
      if (!supabase) return { seasons: [] as Season[], rounds: [] as Round[] };
      const [s, r] = await Promise.all([
        db()
          .from("seasons")
          .select("*")
          .order("created_at", { ascending: false }),
        db().from("rounds").select("*").order("starts_at"),
      ]);
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      return { seasons: s.data as Season[], rounds: r.data as Round[] };
    }, []),
  );
  return (
    <div className="page">
      <div className="league-hero">
        <span className="eyebrow">A COMPETIÇÃO TEM UMA NOVA CASA</span>
        <h1>
          DARKNESS
          <br />
          <em>LEAGUE</em>
        </h1>
        <p>Um squad. Um objetivo. O topo.</p>
        <Trophy className="hero-trophy" size={170} />
        <span className="hero-footer">FREE FIRE • COMUNIDADE LYC</span>
      </div>
      <div className="section-heading">
        <h2>Central da competição</h2>
        <span className="muted">Temporadas & calendário</span>
      </div>
      <ErrorNotice text={result.error} />
      {result.loading ? (
        <Loading />
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat">
              <Trophy />
              <small>Temporadas</small>
              <strong>{result.data?.seasons.length || 0}</strong>
            </div>
            <div className="stat">
              <CalendarDays />
              <small>Rodadas programadas</small>
              <strong>{result.data?.rounds.length || 0}</strong>
            </div>
            <div className="stat">
              <Flag />
              <small>Pontuação</small>
              <strong className="small-stat">Configurável</strong>
            </div>
          </div>
          {!result.data?.seasons.length ? (
            <Empty title="A próxima temporada está por vir">
              Calendário e classificação aparecerão após a organização cadastrar
              a competição. Nenhuma regra de pontuação foi presumida.
            </Empty>
          ) : (
            result.data.seasons.map((s) => (
              <div className="panel" key={s.id}>
                <h3>{s.name}</h3>
                <span className="badge">{s.status}</span>
                <p className="muted">
                  {Object.keys(s.scoring_rules).length
                    ? "Regras configuradas pela organização."
                    : "Pontuação aguardando configuração."}
                </p>
              </div>
            ))
          )}
          {result.data?.rounds.map((r) => (
            <div className="ticket-row" key={r.id}>
              <CalendarDays />
              <b>{r.name}</b>
              <span>
                {r.starts_at
                  ? new Date(r.starts_at).toLocaleString("pt-BR")
                  : "Data a definir"}
              </span>
              <span className="badge">{r.status}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
