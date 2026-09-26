export type NotificationEvent =
  | "mention"
  | "important-message"
  | "ticket-reply"
  | "league-announcement"
  | "round-start"
  | "invitation";
const sent = new Map<string, number>();
export async function notify(
  event: NotificationEvent,
  id: string,
  title: string,
  body: string,
) {
  if (localStorage.getItem("lyc-notifications") === "off") return;
  const key = event + ":" + id;
  if (Date.now() - (sent.get(key) || 0) < 60000) return;
  sent.set(key, Date.now());
  if (sent.size > 500) sent.clear();
  await window.arena?.notify(title.slice(0, 80), body.slice(0, 200));
}
