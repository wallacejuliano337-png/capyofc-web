import type { Role } from "../types";
export const isStaff = (role: Role) =>
  ["OWNER", "ADMIN", "MODERATOR", "STAFF"].includes(role);
export const isAdmin = (role: Role) => ["OWNER", "ADMIN"].includes(role);
export function cleanContent(content: string) {
  const value = content.trim();
  if (!value || value.length > 4000)
    throw new Error("Use entre 1 e 4.000 caracteres.");
  return value;
}
