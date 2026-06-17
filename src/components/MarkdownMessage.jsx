import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function stripMarkdownForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\|.+\|$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/-{3,}/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_SPEECH_CHARS = 320;

export function buildSpeechText(text, maxChars = MAX_SPEECH_CHARS) {
  const plain = stripMarkdownForSpeech(text);
  if (!plain) return "";
  if (plain.length <= maxChars) return plain;

  const snippet = plain.slice(0, maxChars);
  const lastStop = Math.max(
    snippet.lastIndexOf(". "),
    snippet.lastIndexOf("? "),
    snippet.lastIndexOf("! "),
    snippet.lastIndexOf("। ")
  );

  if (lastStop > maxChars * 0.45) {
    return snippet.slice(0, lastStop + 1).trim();
  }

  return `${snippet.trimEnd()}…`;
}

export default function MarkdownMessage({ content }) {
  if (!content) return null;

  return (
    <div className="aura-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
