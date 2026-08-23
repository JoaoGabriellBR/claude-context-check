import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ScanContext, SkillFile } from "../src/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ScanContext minimo, para testar uma regra sem tocar no disco. */
export function makeContext(overrides: Partial<ScanContext> = {}): ScanContext {
  return {
    repoPath: path.join(os.tmpdir(), "chc-fake-repo"),
    skillFiles: [],
    handoffFiles: [],
    ...overrides,
  };
}

/**
 * SkillFile com o caminho na convencao do Claude Code
 * (`.claude/skills/<dir>/SKILL.md`), para exercitar tambem o fallback de
 * identidade pelo nome do diretorio.
 */
export function makeSkill(dir: string, frontmatter: Partial<SkillFile> = {}): SkillFile {
  return {
    path: path.join(os.tmpdir(), "chc-fake-repo", ".claude", "skills", dir, "SKILL.md"),
    ...frontmatter,
  };
}

/**
 * Cria um repositorio temporario com os arquivos informados (chave = caminho
 * relativo com "/"). Usado onde a regra precisa de arquivo real no disco, como
 * o fallback de mtime do handoff-freshness.
 */
export function makeTempRepo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chc-test-"));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
  }
  return root;
}

export function removeTempRepo(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

/** Prefixo `YYYY-MM-DD` de N dias atras, para nomear handoffs nos testes. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function repeatText(text: string, totalChars: number): string {
  return text.repeat(Math.ceil(totalChars / text.length)).slice(0, totalChars);
}
