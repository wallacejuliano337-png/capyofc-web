import { useState, useRef, useEffect } from "react";
import { Search, X, Smile } from "lucide-react";
import "./modern-chat.css";

const QUICK_EMOJIS = ["🔥", "❤️", "😂", "👍", "🎉", "🚀", "👀", "💀", "💯", "✨"];

const EMOJI_CATEGORIES = [
  {
    name: "Expressões",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
      "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜",
      "🤪", "🤨", "🧐", "🤓", "😎", "🥳", "😏", "😒", "😞", "😔",
      "😟", "😕", "🙁", "😣", "😖", "😫", "😩", "🥺", "😢", "😭",
      "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨",
      "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🤫", "🤥", "😶",
      "😐", "😑", "😬", "🫠", "🙄", "😯", "😦", "😧", "😮", "😲",
      "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧",
    ],
  },
  {
    name: "Gestos & Pessoas",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌",
      "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉",
      "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜",
      "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪",
    ],
  },
  {
    name: "Corações & Reações",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "🔥",
      "💥", "✨", "🌟", "💫", "⭐", "⚡", "🌈", "☀️", "🌙", "☁️",
    ],
  },
  {
    name: "Gamer & Itens",
    emojis: [
      "🎮", "🕹️", "🎲", "🎯", "🎳", "🏆", "🥇", "🥈", "🥉", "🎖️",
      "🏅", "⚔️", "🛡️", "🏹", "🗡️", "🔫", "💣", "🎧", "🎤", "💻",
      "💀", "☠️", "👾", "🤖", "🎃", "👻", "👽", "👑", "💎", "💯",
    ],
  },
];

export function EmojiPicker({
  onSelect,
  onClose,
  position = "top",
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: "top" | "bottom";
}) {
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const filteredCategories = EMOJI_CATEGORIES.map((cat) => ({
    ...cat,
    emojis: cat.emojis.filter((em) => !query || em.includes(query)),
  })).filter((cat) => cat.emojis.length > 0);

  return (
    <div
      ref={pickerRef}
      className={`modern-emoji-picker position-${position}`}
      role="dialog"
      aria-label="Seletor de emojis"
    >
      <div className="emoji-picker-search">
        <Search size={14} />
        <input
          autoFocus
          aria-label="Buscar emoji"
          placeholder="Buscar emoji..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="emoji-search-clear"
            onClick={() => setQuery("")}
            title="Limpar busca"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div className="emoji-quick-row">
        {QUICK_EMOJIS.map((em) => (
          <button
            key={em}
            type="button"
            className="emoji-btn"
            onClick={() => {
              onSelect(em);
              onClose();
            }}
          >
            {em}
          </button>
        ))}
      </div>

      <div className="emoji-picker-scroll">
        {filteredCategories.map((cat) => (
          <div key={cat.name} className="emoji-category-section">
            <h4 className="emoji-category-title">{cat.name}</h4>
            <div className="emoji-grid">
              {cat.emojis.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="emoji-btn"
                  onClick={() => {
                    onSelect(em);
                    onClose();
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="emoji-no-results">
            <Smile size={24} />
            <span>Nenhum emoji encontrado</span>
          </div>
        )}
      </div>
    </div>
  );
}
