import type {
  Channel,
  Profile,
  Message,
  Team,
  Ticket,
  TicketMessage,
  TeamMember,
} from "../types";
export const demoProfile: Profile = {
  id: "local-user",
  username: "visitante",
  display_name: "Visitante LYC",
  avatar_url: null,
  status: "online",
  role: "MEMBER",
  created_at: new Date().toISOString(),
};
export const demoChannels: Channel[] = [
  ["geral", "COMUNIDADE", "text", "O ponto de encontro da nossa comunidade."],
  ["avisos", "COMUNIDADE", "text", "Comunicados oficiais da LYC."],
  ["resultados", "COMUNIDADE", "text", "Cada partida conta uma história."],
  ["procurar-time", "COMUNIDADE", "text", "Encontre seu próximo squad."],
  ["lobby", "SALAS DE VOZ", "voice", "Conecte-se com a comunidade."],
  [
    "treino",
    "SALAS DE VOZ",
    "voice",
    "Prepare seu squad para a próxima queda.",
  ],
  ["informações", "DARKNESS LEAGUE", "text", "Tudo sobre a competição."],
  ["calendário", "DARKNESS LEAGUE", "text", "Próximas rodadas."],
  ["classificação", "DARKNESS LEAGUE", "text", "Acompanhe a temporada."],
  ["rodada-atual", "DARKNESS LEAGUE", "text", "Central da rodada."],
].map(([name, category, kind, description], i) => ({
  id: "demo-" + i,
  name,
  category,
  kind: kind as "text" | "voice",
  description,
  team_id: null,
}));
type LocalData = {
  messages: Message[];
  teams: Team[];
  members: TeamMember[];
  tickets: Ticket[];
  ticketMessages: TicketMessage[];
};
const empty: LocalData = {
  messages: [],
  teams: [],
  members: [],
  tickets: [],
  ticketMessages: [],
};
export function readLocal(): LocalData {
  try {
    return {
      ...empty,
      ...JSON.parse(localStorage.getItem("lyc-demo-v1") || "{}"),
    };
  } catch {
    return { ...empty };
  }
}
export function writeLocal(data: LocalData) {
  localStorage.setItem("lyc-demo-v1", JSON.stringify(data));
}
