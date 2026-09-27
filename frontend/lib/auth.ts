export function homeForRole(role: string): string {
  if (role === "official" || role === "admin") return "/dashboard";
  if (role === "field_officer" || role === "volunteer") return "/field-officer";
  return "/";
}
