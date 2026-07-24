import type { UserRole } from "@/types/auth";

export function canManageCatalogue(role: UserRole) {
  return role === "OWNER";
}

export function settingsAccessMode(role: UserRole) {
  return role === "OWNER" ? "editable" : "readonly";
}
