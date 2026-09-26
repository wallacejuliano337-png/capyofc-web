import {
  ArrowUpRight,
  MessageSquare,
  Headphones,
  Trophy,
  Shield,
  LifeBuoy,
} from "lucide-react";
import type { Profile } from "../types";
export function Home({
  profile,
  navigate,
}: {
  profile: Profile;
  navigate: (page: string) => void;
}) {
  return (
    <div className="page home">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BEM-VINDO À SUA COMUNIDADE</span>
          <h1>
            Salve, {profile.display_name.split(" ")[0]}
            <span className="red">.</span>
          </h1>
          <p className="muted">Sua próxima conexão começa aqui.</p>
        </div>
        <span className="edition">
          LYC ARENA <b>EARLY ACCESS</b>
        </span>
      </div>
      <section className="home-hero">
        <div>
          <span className="eyebrow">COMPETIÇÃO • CONEXÃO • COMUNIDADE</span>
          <h2>
            SEU SQUAD.
            <br />
            SUA HISTÓRIA.
            <br />
            <em>SUA ARENA.</em>
          </h2>
          <p>
            Onde a comunidade se encontra
            <br />e a próxima jogada ganha vida.
          </p>
          <button className="primary" onClick={() => navigate("Comunidade")}>
            Entrar na comunidade <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="arena-emblem">
          <span>L</span>
          <i>Y C</i>
        </div>
        <div className="hero-index">01 / LYC</div>
      </section>
      <div className="section-heading">
        <h2>Entre em campo</h2>
        <span className="muted">Seu próximo destino</span>
      </div>
      <div className="destination-grid">
        {[
          {
            title: "Comunidade",
            icon: MessageSquare,
            text: "A conversa não para por aqui.",
            label: "Abrir canais",
          },
          {
            title: "Darkness League",
            icon: Trophy,
            text: "Acompanhe cada etapa da liga.",
            label: "Explorar competição",
          },
          {
            title: "Equipes",
            icon: Shield,
            text: "Encontre quem joga com você.",
            label: "Conhecer equipes",
          },
        ].map((c) => (
          <button
            className="destination"
            key={c.title}
            onClick={() => navigate(c.title)}
          >
            <div className="card-icon">
              <c.icon size={23} />
            </div>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <span>
              {c.label}
              <ArrowUpRight size={16} />
            </span>
          </button>
        ))}
      </div>
      <div className="home-bottom">
        <button className="panel" onClick={() => navigate("Voz")}>
          <Headphones size={25} />
          <div>
            <h3>Conecte sua voz</h3>
            <p>Um lugar para conversar, treinar e transmitir.</p>
          </div>
          <ArrowUpRight />
        </button>
        <button className="panel" onClick={() => navigate("Tickets")}>
          <LifeBuoy size={25} />
          <div>
            <h3>Conte com a staff</h3>
            <p>Suporte privado, direto na Arena.</p>
          </div>
          <ArrowUpRight />
        </button>
      </div>
    </div>
  );
}
