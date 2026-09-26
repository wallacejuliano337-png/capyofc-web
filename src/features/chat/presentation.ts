import type { Message } from "../../types";

/** Presentation only: never combines or changes stored messages. */
export function continuesMessageGroup(
  previous: Message | undefined,
  current: Message,
) {
  if (
    !previous ||
    previous.author_id !== current.author_id ||
    previous.reply_to ||
    current.reply_to
  )
    return false;
  const before = new Date(previous.created_at);
  const after = new Date(current.created_at);
  const elapsed = after.getTime() - before.getTime();
  return (
    elapsed >= 0 &&
    elapsed < 5 * 60 * 1000 &&
    before.toDateString() === after.toDateString()
  );
}
