import path from "node:path";
import type { Finding, Rule, ScanContext, SkillFile } from "../types";

/**
 * Skills consideradas essenciais para um repositorio que usa Claude Code de
 * forma intensa: revisao de codigo, revisao de seguranca e alguma forma de
 * skill de testes. Sem elas o agente improvisa o criterio de qualidade a cada
 * sessao, que e exatamente o que a skill deveria congelar.
 */
interface EssentialSkill {
  /** Nome canonico usado na mensagem do finding. */
  label: string;
  /**
   * Casado contra a IDENTIDADE da skill (frontmatter `name` ou, na falta dele,
   * o nome do diretorio) — nunca contra a `description`. Casar description
   * gera falso positivo trivial: uma skill de code-review cuja descricao cita
   * "riscos de seguranca e cobertura de testes" satisfaria as tres checagens
   * de uma vez sem que exista nenhuma skill de seguranca ou de teste.
   */
  matches: RegExp;
  /** Sugestao concreta incluida na mensagem. */
  hint: string;
}

const ESSENTIAL_SKILLS: EssentialSkill[] = [
  {
    label: "code-review",
    matches: /code[-_ ]?review|revisao[-_ ]?de[-_ ]?codigo/i,
    hint: "auditoria de diff antes do merge",
  },
  {
    label: "security-review",
    matches: /security[-_ ]?review|seguranca|vulnerab/i,
    hint: "injection, authz, cripto e segredos vazados",
  },
  {
    label: "testes",
    matches: /\btests?\b|\btestes?\b|testing|\bqa\b|\btdd\b|guia[-_ ]?de[-_ ]?testes/i,
    hint: "guia de testes ou estrategia de teste reproduzivel",
  },
];

/** Cada skill ausente e um Medium. -8 (e nao -10, como claude-md-size) porque
 * o finding e repetido por skill: tres ausencias somariam -30, o mesmo peso de
 * um CLAUDE.md inexistente, que e um problema de outra ordem de gravidade. */
const SCORE_IMPACT_PER_MISSING_SKILL = -8;

export const skillCoverage: Rule = {
  id: "skill-coverage",
  description:
    "Verifica se o repositorio tem as skills essenciais (code-review, security-review, testes)",
  check(context: ScanContext): Finding[] {
    const identities = context.skillFiles.map(skillIdentity);

    return ESSENTIAL_SKILLS.filter(
      (essential) => !identities.some((identity) => essential.matches.test(identity)),
    ).map((essential) => ({
      ruleId: "skill-coverage",
      severity: "medium" as const,
      message: `Skill essencial ausente: "${essential.label}" (${essential.hint}). Sem ela, o criterio e reinventado a cada sessao.`,
      scoreImpact: SCORE_IMPACT_PER_MISSING_SKILL,
    }));
  },
};

/**
 * Identidade da skill: o `name` do frontmatter quando existe, senao o nome do
 * diretorio que contem o SKILL.md (a convencao do Claude Code e
 * `.claude/skills/<nome>/SKILL.md`).
 */
function skillIdentity(skill: SkillFile): string {
  if (skill.name && skill.name.trim().length > 0) return skill.name;
  return path.basename(path.dirname(skill.path));
}

export const skillCoverageRules: Rule[] = [skillCoverage];
