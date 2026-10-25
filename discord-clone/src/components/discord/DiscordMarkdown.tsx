import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface DiscordMarkdownProps {
  content: string;
}

export const DiscordMarkdown: React.FC<DiscordMarkdownProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});

  const handleCopy = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleSpoiler = (index: number) => {
    setRevealedSpoilers((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // 1. Separate code blocks from normal text
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: (
    | { type: 'codeblock'; lang: string; code: string }
    | { type: 'text'; text: string }
  )[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        text: content.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'codeblock',
      lang: match[1] || 'plaintext',
      code: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      text: content.slice(lastIndex),
    });
  }

  let spoilerCounter = 0;

  // 2. Parse inline markdown: spoilers, inline code, bold, italics, mentions, links
  const renderInline = (raw: string, keyPrefix: string): React.ReactNode[] => {
    // Tokenize by spoilers first: ||spoiler||
    const spoilerRegex = /\|\|([\s\S]*?)\|\|/g;
    const segments: React.ReactNode[] = [];
    let curIdx = 0;
    let sMatch: RegExpExecArray | null;

    while ((sMatch = spoilerRegex.exec(raw)) !== null) {
      if (sMatch.index > curIdx) {
        segments.push(renderFormatting(raw.slice(curIdx, sMatch.index), `${keyPrefix}-txt-${curIdx}`));
      }
      const sIndex = spoilerCounter++;
      const isRevealed = !!revealedSpoilers[sIndex];
      const spoilerContent = sMatch[1];

      segments.push(
        <span
          key={`${keyPrefix}-spoiler-${sIndex}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSpoiler(sIndex);
          }}
          title={isRevealed ? 'Spoiler revelado' : 'Clique para revelar spoiler'}
          className={`cursor-pointer rounded px-1 transition-all select-none ${
            isRevealed
              ? 'bg-[#2b2d31]/80 text-[#dbdee1] border border-white/10'
              : 'bg-[#202225] hover:bg-[#25272b] text-transparent hover:text-white/20 select-none'
          }`}
        >
          {spoilerContent}
        </span>
      );
      curIdx = sMatch.index + sMatch[0].length;
    }

    if (curIdx < raw.length) {
      segments.push(renderFormatting(raw.slice(curIdx), `${keyPrefix}-txt-${curIdx}`));
    }

    return segments;
  };

  // 3. Render formatting (bold, italic, inline code, mentions, urls)
  const renderFormatting = (str: string, prefix: string): React.ReactNode => {
    // Regex for mentions, inline code, bold, italic, url
    const inlineRegex =
      /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|~~[^~]+~~|@[a-zA-Z0-9_À-ÿ-]+|#[a-zA-Z0-9_-]+|https?:\/\/[^\s]+)/g;

    const parts = str.split(inlineRegex);

    return parts.map((sub, i) => {
      const k = `${prefix}-${i}`;
      if (sub.startsWith('`') && sub.endsWith('`') && sub.length >= 2) {
        return (
          <code
            key={k}
            className="bg-[#1e1f22] text-[#e0e1e5] px-1.5 py-0.5 rounded text-[12px] font-mono border border-black/20"
          >
            {sub.slice(1, -1)}
          </code>
        );
      }
      if (sub.startsWith('**') && sub.endsWith('**') && sub.length >= 4) {
        return <strong key={k} className="font-bold text-white">{sub.slice(2, -2)}</strong>;
      }
      if ((sub.startsWith('*') && sub.endsWith('*')) || (sub.startsWith('_') && sub.endsWith('_'))) {
        return <em key={k} className="italic text-[#dbdee1]">{sub.slice(1, -1)}</em>;
      }
      if (sub.startsWith('~~') && sub.endsWith('~~') && sub.length >= 4) {
        return <del key={k} className="line-through text-[#949ba4]">{sub.slice(2, -2)}</del>;
      }
      if (sub.startsWith('@')) {
        const isBroadMention = sub === '@everyone' || sub === '@here';
        return (
          <span
            key={k}
            className={`font-medium px-1 rounded cursor-pointer transition-colors ${
              isBroadMention
                ? 'bg-[#faa61a]/20 hover:bg-[#faa61a]/30 text-[#faa61a] hover:text-[#fee75c]'
                : 'bg-[#5865f2]/20 hover:bg-[#5865f2]/30 text-[#c9cdfb] hover:text-white'
            }`}
          >
            {sub}
          </span>
        );
      }
      if (sub.startsWith('#')) {
        return (
          <span
            key={k}
            className="bg-[#35373c] text-[#dbdee1] hover:underline px-1 rounded font-medium cursor-pointer"
          >
            {sub}
          </span>
        );
      }
      if (sub.startsWith('http://') || sub.startsWith('https://')) {
        return (
          <a
            key={k}
            href={sub}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00a8fc] hover:underline"
          >
            {sub}
          </a>
        );
      }
      return <React.Fragment key={k}>{sub}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-1.5 leading-relaxed break-words">
      {parts.map((p, idx) => {
        if (p.type === 'codeblock') {
          return (
            <div
              key={`cb-${idx}`}
              className="my-2 rounded-md overflow-hidden bg-[#1e1f22] border border-[#2b2d31] font-mono text-[12.5px] shadow-sm max-w-2xl"
            >
              {/* Header com linguagem e botão copiar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#2b2d31]/80 text-[#949ba4] text-[11px] font-bold uppercase tracking-wider border-b border-[#232428]">
                <span>{p.lang}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(p.code, idx)}
                  className="flex items-center gap-1 hover:text-white text-[#dbdee1] transition-colors cursor-pointer text-[11px]"
                  title="Copiar código"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#23a55a]" />
                      <span className="text-[#23a55a]">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-[#dbdee1] leading-snug">
                <code>{p.code}</code>
              </pre>
            </div>
          );
        }

        return (
          <span key={`txt-${idx}`}>
            {renderInline(p.text, `part-${idx}`)}
          </span>
        );
      })}
    </div>
  );
};
