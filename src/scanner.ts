import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { ScanContext, SkillFile } from "./types";

/**
 * Varre um repositorio procurando os artefatos que compoem o "contexto
 * agentico" de uma sessao Claude Code: CLAUDE.md, skills (.claude/skills/**\/SKILL.md),
 * handoffs (.claude/handoffs/**\/*.md) e CURRENT_TASK.md.
 */
export async function scanRepo(repoPath: string): Promise<ScanContext> {
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Caminho nao encontrado: ${repoPath}`);
  }

  const claudeMdPath = findFile(repoPath, "CLAUDE.md");
  const currentTaskPath = findFile(repoPath, "CURRENT_TASK.md");

  const skillPaths = await fg("**/SKILL.md", {
    cwd: repoPath,
    absolute: true,
    ignore: ["**/node_modules/**"],
    dot: true,
  });

  const skillFiles: SkillFile[] = skillPaths.map((skillPath) => {
    const raw = fs.readFileSync(skillPath, "utf-8");
    const { data } = matter(raw);
    return {
      path: skillPath,
      name: typeof data.name === "string" ? data.name : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
    };
  });

  const handoffFiles = await fg(".claude/handoffs/**/*.md", {
    cwd: repoPath,
    absolute: true,
    ignore: ["**/node_modules/**"],
    dot: true,
  });

  return {
    repoPath,
    claudeMdPath,
    claudeMdContent: claudeMdPath ? fs.readFileSync(claudeMdPath, "utf-8") : undefined,
    skillFiles,
    handoffFiles,
    currentTaskPath,
    currentTaskContent: currentTaskPath
      ? fs.readFileSync(currentTaskPath, "utf-8")
      : undefined,
  };
}

function findFile(repoPath: string, fileName: string): string | undefined {
  const direct = path.join(repoPath, fileName);
  return fs.existsSync(direct) ? direct : undefined;
}
