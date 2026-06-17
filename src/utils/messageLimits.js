export const MAX_MESSAGE_LENGTH = 3000;

export function trimMessage(message, maxLength = MAX_MESSAGE_LENGTH) {
  if (!message) return "";
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}
