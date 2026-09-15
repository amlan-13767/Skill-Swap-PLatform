const skillAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  reactjs: "react",
  nodejs: "node.js",
};

export function normalizeSkill(skill: string) {
  const normalized = skill.trim().toLowerCase().replace(/\s+/g, " ");
  return skillAliases[normalized] ?? normalized;
}

export function normalizeSkills(skills: string[] | undefined) {
  return Array.from(new Set((skills ?? []).map(normalizeSkill).filter(Boolean)));
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function safeUser(user: { passwordHash: string; [key: string]: unknown }) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}