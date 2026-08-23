import type { Finding, Rule, ScanContext } from "../types";

// Aproximacao grosseira de ~4 caracteres por token (so usada quando nao
// ha ANTHROPIC_API_KEY disponivel para contagem real via count_tokens).
const MAX_RECOMMENDED_CHARS = 8000;

export const claudeMdExists: Rule = {
  id: "claude-md-exists",
  description: "Verifica se existe um CLAUDE.md na raiz do repositorio",
  check(context: ScanContext): Finding[] {
    if (!context.claudeMdPath) {
      return [
        {
          ruleId: "claude-md-exists",
          severity: "critical",
          message:
            "CLAUDE.md nao encontrado na raiz do repositorio. Sem ele, cada sessao comeca sem contexto persistente.",
          scoreImpact: -30,
        },
      ];
    }
    return [];
  },
};

export const claudeMdSize: Rule = {
  id: "claude-md-size",
  description: "Verifica se o CLAUDE.md esta maior do que o recomendado",
  check(context: ScanContext): Finding[] {
    if (!context.claudeMdContent) return [];

    const size = context.claudeMdContent.length;
    if (size > MAX_RECOMMENDED_CHARS) {
      const estimatedTokens = Math.round(size / 4);
      return [
        {
          ruleId: "claude-md-size",
          severity: "medium",
          message: `CLAUDE.md tem ${size} caracteres (~${estimatedTokens} tokens estimados). Considere mover contexto detalhado para skills ou handoffs especificos.`,
          scoreImpact: -10,
        },
      ];
    }
    return [];
  },
};

export const claudeMdDuplicateLines: Rule = {
  id: "claude-md-duplicate-lines",
  description: "Detecta instrucoes duplicadas ou repetidas no CLAUDE.md",
  check(context: ScanContext): Finding[] {
    if (!context.claudeMdContent) return [];

    // Ignora headers (#) e linhas curtas (bullets soltos, divisores etc.),
    // que geram falsos positivos.
    const lines = context.claudeMdContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 20 && !line.startsWith("#"));

    const occurrences = new Map<string, number>();
    for (const line of lines) {
      const normalized = line.toLowerCase();
      occurrences.set(normalized, (occurrences.get(normalized) ?? 0) + 1);
    }

    const duplicates = [...occurrences.entries()].filter(([, count]) => count > 1);

    if (duplicates.length > 0) {
      const preview = duplicates
        .slice(0, 3)
        .map(([line]) => `  - "${truncate(line, 70)}"`)
        .join("\n");

      return [
        {
          ruleId: "claude-md-duplicate-lines",
          severity: "high",
          message: `${duplicates.length} instrucao(oes) duplicada(s) encontrada(s) no CLAUDE.md:\n${preview}`,
          scoreImpact: -15 * Math.min(duplicates.length, 3),
        },
      ];
    }
    return [];
  },
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export const claudeMdRules: Rule[] = [claudeMdExists, claudeMdSize, claudeMdDuplicateLines];
