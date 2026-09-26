import {
  UserProfilePopover,
  type UserProfileSelection,
  type OpenUserProfile,
} from "./features/profile/UserProfilePopover";
import { UserProfileCache } from "./services/user-profiles";
import { useAudioSettings } from "./services/audio-settings";
import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  lazy,
  Suspense,
} from "react";
import {
  Home as HomeIcon,
  Users,
  UserRound,
  Trophy,
  Shield,
  LifeBuoy,
  Hash,
  Volume2,
  Settings as SettingsIcon,
  LogOut,
  Minus,
  Square,
  X,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Headphones,
  MicOff,
  Plus,
} from "lucide-react";
import { Auth, useAuth } from "./features/auth/Auth";
import { Home } from "./pages/Home";
import { Chat } from "./features/chat/Chat";
import { Teams } from "./features/teams/Teams";
import { Tickets } from "./features/tickets/Tickets";
import { League } from "./features/league/League";
const Voice = lazy(() =>
  import("./features/voice/Voice").then((m) => ({ default: m.Voice })),
);
import { AvatarEditor } from "./features/profile/AvatarEditor";
import { useAvatarSync } from "./hooks/useAvatar";
import { Settings } from "./features/profile/Settings";
import { Admin } from "./features/admin/Admin";
import { Avatar, ErrorNotice, Loading } from "./components/ui";
import { supabase } from "./lib/supabase";
import { demoChannels } from "./services/demo";
import { useSocial } from "./hooks/useSocial";
import { Social } from "./features/social/Social";
import { presenceLabels, visiblePresence } from "./services/social";
import { useCommunities } from "./hooks/useCommunities";
import {
  CommunityControls,
  CommunityMembers,
} from "./features/communities/Communities";
import { isAdmin } from "./lib/permissions";
import type { Channel } from "./types";
import homeIcon from "../assets/lyc-home.png";
const navigation = [
  { name: "Início", icon: HomeIcon },
  { name: "Comunidade", icon: Users },
  { name: "Amigos e DMs", icon: Users },
  { name: "Darkness League", icon: Trophy },
  { name: "Equipes", icon: Shield },
  { name: "Tickets", icon: LifeBuoy },
];
export function App() {
  const auth = useAuth();
  useAvatarSync(auth.profile?.id);
  const [avatarEditing, setAvatarEditing] = useState(false);
  const [page, setPage] = useState("Comunidade");
  const [channel, setChannel] = useState<Channel | null>(
    supabase ? null : demoChannels.find((c) => c.kind === "text") || null,
  );
  const [voiceChannel, setVoiceChannel] = useState<Channel | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileSelection | null>(
    null,
  );
  const profileCache = useMemo(
    () => new UserProfileCache(),
    [auth.profile?.id],
  );
  const closeUserProfile = useCallback(() => setUserProfile(null), []);
  const openUserProfile: OpenUserProfile = (id, anchor, profile) =>
    setUserProfile((current) =>
      current?.id === id ? null : { id, anchor, profile },
    );
  useEffect(() => {
    setUserProfile(null);
  }, [auth.profile?.id]);
  const [socialNavigationHost, setSocialNavigationHost] =
    useState<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"profile" | "voice">(
    "voice",
  );
  const audioPreferences = useAudioSettings();
  const [voiceControlsHost, setVoiceControlsHost] =
    useState<HTMLDivElement | null>(null);
  const [voiceMembersHost, setVoiceMembersHost] =
    useState<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [communityPanel, setCommunityPanel] = useState<
    "directory" | "settings" | null
  >(null);
  const communities = useCommunities(auth.profile?.id);
  const social = useSocial(auth.profile?.id);
  const unread =
    social.data?.conversations.reduce(
      (n, c) => n + Number(c.unread_count),
      0,
    ) || 0;
  const presence = Object.fromEntries(
    (social.data?.presence || []).map((p) => [
      p.user_id,
      visiblePresence(p, social.now),
    ]),
  );
  const channels = {
    data: supabase ? communities.detail.data?.channels : demoChannels,
    error: communities.detail.error || communities.list.error,
    reload: communities.reload,
  };
  const categories = supabase
    ? communities.detail.data?.categories || []
    : [...new Set(demoChannels.map((c) => c.category))].map((name) => ({
        id: name,
        name,
      }));
  useEffect(() => {
    if (!supabase || communities.detail.loading) return;
    setChannel(
      (previous) =>
        communities.detail.data?.channels.find((c) => c.id === previous?.id) ||
        communities.detail.data?.channels.find((c) => c.kind === "text") ||
        null,
    );
    setVoiceChannel(
      (previous) =>
        communities.detail.data?.channels.find((c) => c.id === previous?.id) ||
        null,
    );
  }, [communities.detail.data, communities.detail.loading]);
  const communityView = page === "Comunidade" || page === "Voz";
  const navigate = (target: string) => {
    setPage(target);
    if (target === "Comunidade" && !channel)
      setChannel(channels.data?.find((c) => c.kind === "text") || null);
    if (target === "Voz" && !voiceChannel)
      setVoiceChannel(channels.data?.find((c) => c.kind === "voice") || null);
  };
  return (
    <>
      <div className="window-controls">
        <div>
          <button
            aria-label="Minimizar"
            onClick={() => void window.arena?.window("minimize")}
          >
            <Minus size={14} />
          </button>
          <button
            aria-label="Maximizar ou restaurar"
            onClick={() => void window.arena?.window("maximize")}
          >
            <Square size={11} />
          </button>
          <button
            className="close-window"
            aria-label="Fechar janela"
            onClick={() => void window.arena?.window("close")}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {auth.loading ? (
        <Loading />
      ) : !auth.profile ? (
        <Auth onDemo={auth.enterDemo} error={auth.error} />
      ) : (
        <div
          className={"app-layout" + (communityView ? " community-layout" : "")}
        >
          <aside className="server-rail" aria-label="Comunidades">
            <button
              className={page === "Início" ? "rail-home selected" : "rail-home"}
              aria-pressed={page === "Início"}
              title="Início"
              aria-label="LYC Arena — Início"
              onClick={() => navigate("Início")}
            >
              <img className="rail-home-image" src={homeIcon} alt="" />
              {unread > 0 && (
                <span
                  className="rail-unread"
                  aria-label={unread + " mensagens privadas não lidas"}
                >
                  {unread}
                </span>
              )}
            </button>
            <div className="rail-divider" />
            <div className="server-list">
              {(communities.list.data || []).map((community) => (
                <button
                  key={community.id}
                  title={community.name}
                  aria-label={community.name}
                  aria-pressed={
                    communityView && communities.current?.id === community.id
                  }
                  className={
                    communityView && communities.current?.id === community.id
                      ? "server-icon selected"
                      : "server-icon"
                  }
                  onClick={() => {
                    if (community.id !== communities.current?.id) {
                      setChannel(null);
                      setVoiceChannel(null);
                      setCommunityPanel(null);
                      communities.select(community.id);
                    }
                    navigate("Comunidade");
                  }}
                >
                  <Avatar
                    name={community.name}
                    url={community.image_url}
                    size={42}
                  />
                </button>
              ))}
            </div>
            {supabase && !communities.legacy && (
              <button
                className="server-add"
                title="Criar ou entrar em comunidade"
                aria-label="Criar ou entrar em comunidade"
                onClick={() => setCommunityPanel("directory")}
              >
                <Plus size={22} />
              </button>
            )}
            <span className="rail-caption">LYC</span>
          </aside>
          <aside className="channels-sidebar">
            <div className="sidebar-scroll">
              {page === "Amigos e DMs" ? (
                <div ref={setSocialNavigationHost} />
              ) : (
                <>
                  {supabase && !communities.legacy ? (
                    <CommunityControls
                      key={communities.current?.id || "none"}
                      communities={communities.list.data || []}
                      current={communities.current}
                      onSelect={(id) => {
                        setChannel(null);
                        setVoiceChannel(null);
                        setCommunityPanel(null);
                        communities.select(id);
                      }}
                      onChanged={communities.reload}
                      categories={communities.detail.data?.categories || []}
                      channels={channels.data || []}
                      members={communities.detail.data?.members || []}
                      roles={communities.detail.data?.roles || []}
                      permissions={communities.detail.data?.permissions || []}
                      userId={auth.profile.id}
                      open={communityPanel}
                      onOpenChange={setCommunityPanel}
                      compact={!communityView}
                    >
                      {" "}
                      <div className="channel-search">
                        <Search size={14} />
                        <input
                          aria-label="Buscar canal"
                          placeholder="Buscar canal"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                    </CommunityControls>
                  ) : (
                    <div className="community-title">
                      <b>{supabase ? "Comunidade" : "Comunidade local"}</b>
                    </div>
                  )}
                  {!communityView && (
                    <div className="home-navigation">
                      <div className="home-navigation-title">LYC Arena</div>
                      <nav>
                        {navigation.map((n) => (
                          <button
                            key={n.name}
                            className={page === n.name ? "active" : ""}
                            onClick={() => navigate(n.name)}
                          >
                            <n.icon size={19} />
                            {n.name}
                            {n.name === "Amigos e DMs" && unread > 0 && (
                              <b
                                className="badge"
                                aria-label={
                                  unread + " mensagens privadas não lidas"
                                }
                              >
                                {unread}
                              </b>
                            )}
                            {page === n.name && <i />}
                          </button>
                        ))}
                      </nav>
                      {isAdmin(auth.profile.role) && (
                        <button
                          className="admin-link"
                          onClick={() => navigate("Administração")}
                        >
                          <SlidersHorizontal size={17} /> Administração
                        </button>
                      )}
                    </div>
                  )}
                  {communityView && (
                    <>
                      <ErrorNotice text={channels.error} />
                      {categories.map((category) => (
                        <div className="channel-category" key={category.id}>
                          <h3>
                            <ChevronDown size={11} />
                            <span>{category.name}</span>
                            {communities.detail.data?.permissions.includes(
                              "manage_channels",
                            ) && (
                              <button
                                className="category-create"
                                title={"Criar canal — " + category.name}
                                onClick={() => setCommunityPanel("settings")}
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </h3>
                          {channels.data
                            ?.filter(
                              (c) =>
                                (supabase
                                  ? c.category_id === category.id
                                  : c.category === category.name) &&
                                c.name
                                  .toLowerCase()
                                  .includes(search.toLowerCase()),
                            )
                            .map((c) => (
                              <div className="sidebar-channel" key={c.id}>
                                <button
                                  className={
                                    (page === "Comunidade" &&
                                      channel?.id === c.id) ||
                                    (page === "Voz" &&
                                      voiceChannel?.id === c.id)
                                      ? "selected"
                                      : ""
                                  }
                                  key={c.id}
                                  onClick={() => {
                                    if (c.kind === "voice") {
                                      setVoiceChannel(c);
                                      setPage("Voz");
                                    } else {
                                      setChannel(c);
                                      setPage("Comunidade");
                                    }
                                  }}
                                >
                                  {c.kind === "voice" ? (
                                    <Volume2 size={17} />
                                  ) : (
                                    <Hash size={17} />
                                  )}
                                  <span>{c.name}</span>
                                  {c.team_id && <Shield size={11} />}
                                </button>
                                {c.kind === "voice" &&
                                  c.id === voiceChannel?.id && (
                                    <div
                                      className="sidebar-voice-members"
                                      ref={setVoiceMembersHost}
                                    />
                                  )}
                              </div>
                            ))}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
            <div className="user-panel">
              <button
                className="profile-button"
                popoverTarget="user-presence-menu"
                title="Perfil e presença"
              >
                <span className="user-avatar-presence">
                  <Avatar
                    userId={auth.profile.id}
                    name={auth.profile.display_name}
                    url={auth.profile.avatar_url}
                    size={32}
                  />
                  <i className={"presence-dot presence-" + social.preference} />
                </span>
                <div>
                  <b>{auth.profile.display_name}</b>
                  <small>@{auth.profile.username}</small>
                </div>
              </button>
              <div
                id="user-presence-menu"
                popover="auto"
                className="shell-popover user-popover"
              >
                <div className="profile-card-cover" />
                <div className="profile-card-identity">
                  <span className="user-avatar-presence">
                    <Avatar
                      userId={auth.profile.id}
                      name={auth.profile.display_name}
                      url={auth.profile.avatar_url}
                      size={58}
                    />
                    <i
                      className={"presence-dot presence-" + social.preference}
                    />
                  </span>
                  <b>{auth.profile.display_name}</b>
                  <small>@{auth.profile.username}</small>

                  {audioPreferences.connected && voiceChannel && (
                    <p className="profile-card-voice">
                      Em voz · {voiceChannel.name}
                    </p>
                  )}
                </div>
                {supabase && (
                  <button
                    onClick={() => {
                      document
                        .getElementById("user-presence-menu")
                        ?.hidePopover();
                      setSettingsSection("profile");
                      setSettings(true);
                    }}
                  >
                    <UserRound size={16} /> Editar perfil
                  </button>
                )}
                {supabase && (
                  <>
                    <label>
                      Meu status
                      <select
                        aria-label="Meu status"
                        value={social.preference}
                        onChange={(e) =>
                          void social.setPresence(e.target.value)
                        }
                      >
                        {Object.entries(presenceLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <ErrorNotice text={social.presenceError} />
                  </>
                )}
                <button
                  onClick={() => {
                    document
                      .getElementById("user-presence-menu")
                      ?.hidePopover();
                    setSettingsSection("voice");
                    setSettings(true);
                  }}
                >
                  <SettingsIcon size={16} /> Configurações
                </button>
                <button title="Sair" onClick={() => void auth.logout()}>
                  <LogOut size={16} /> Sair
                </button>
              </div>
              <div className="user-controls">
                <div
                  className="sidebar-audio-controls"
                  ref={setVoiceControlsHost}
                />
                <div className="sidebar-audio-fallback">
                  <button
                    title="Controles de microfone na sala de voz"
                    onClick={() => navigate("Voz")}
                  >
                    <MicOff size={16} />
                  </button>
                  <button
                    title="Salas de voz e áudio"
                    onClick={() => navigate("Voz")}
                  >
                    <Headphones size={16} />
                  </button>
                </div>
                <button
                  title="Configurações"
                  onClick={() => {
                    setSettingsSection("voice");
                    setSettings(true);
                  }}
                >
                  <SettingsIcon size={16} />
                </button>
              </div>
            </div>
          </aside>
          <main>
            {!communityView && (
              <header className="main-topbar">
                <span>{page === "Início" ? "Visão geral" : page}</span>
                <div>
                  <span className="status-dot" />
                  {supabase ? "SERVIÇOS CONFIGURADOS" : "AMBIENTE LOCAL"}
                  <span className="version">v0.1.0</span>
                </div>
              </header>
            )}
            {!supabase && (
              <div className="local-banner">
                MODO LOCAL{" "}
                <span>
                  Dados salvos neste computador. Chat entre usuários, voz e
                  transmissão exigem configuração dos serviços.
                </span>
              </div>
            )}
            <div className="content">
              {page === "Início" && (
                <Home profile={auth.profile} navigate={navigate} />
              )}{" "}
              {page === "Comunidade" &&
                (channel ? (
                  <Chat
                    key={channel.id}
                    onUserProfile={openUserProfile}
                    channel={channel}
                    profile={auth.profile}
                  />
                ) : (
                  <Loading />
                ))}
              {page === "Amigos e DMs" &&
                (supabase ? (
                  <Social
                    profile={auth.profile}
                    social={social}
                    navigationHost={socialNavigationHost}
                    onUserProfile={openUserProfile}
                  />
                ) : (
                  <p>Amigos e DMs exigem conexão ao Supabase.</p>
                ))}
              {page === "Equipes" && (
                <Teams
                  profile={auth.profile}
                  onChanged={() => void channels.reload()}
                />
              )}{" "}
              {page === "Tickets" && <Tickets profile={auth.profile} />}{" "}
              {page === "Darkness League" && <League />}{" "}
              {page === "Administração" && (
                <Admin
                  profile={auth.profile}
                  onChannelsChanged={() => void channels.reload()}
                />
              )}
              <Suspense fallback={<Loading />}>
                <Voice
                  key={
                    auth.profile.id +
                    ":" +
                    (communities.current?.id || "") +
                    ":" +
                    (communities.detail.data?.permissions || [])
                      .filter((p) =>
                        ["connect_voice", "speak", "share_screen"].includes(p),
                      )
                      .sort()
                      .join(",")
                  }
                  channel={voiceChannel}
                  controlsHost={voiceControlsHost}
                  membersHost={voiceMembersHost}
                  visible={page === "Voz"}
                  onLeave={() => setVoiceChannel(null)}
                />
              </Suspense>
            </div>
          </main>
          {(page === "Comunidade" || page === "Voz") && (
            <CommunityMembers
              onUserProfile={openUserProfile}
              members={communities.detail.data?.members || []}
              presence={presence}
            />
          )}
        </div>
      )}
      {userProfile && auth.profile && !settings && (
        <UserProfilePopover
          key={userProfile.id}
          selection={userProfile}
          viewer={auth.profile}
          presence={presence[userProfile.id] || "offline"}
          cache={profileCache}
          onClose={closeUserProfile}
          onEdit={() => {
            setSettingsSection("profile");
            setSettings(true);
          }}
        />
      )}
      {avatarEditing && auth.profile && (
        <AvatarEditor
          profile={auth.profile}
          onSave={auth.setProfile}
          onClose={() => setAvatarEditing(false)}
        />
      )}
      {settings && auth.profile && (
        <Settings
          presence={social.preference}
          initialSection={settingsSection}
          onLogout={() => void auth.logout()}
          profile={auth.profile}
          onSave={auth.setProfile}
          onAvatar={() => {
            setAvatarEditing(true);
          }}
          onClose={() => setSettings(false)}
        />
      )}
    </>
  );
}
