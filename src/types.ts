export type Severity = "critical" | "high" | "medium" | "low";

export interface SkillFile {
  path: string;
  name?: string;
  description?: string;
}

export interface ScanContext {
  repoPath: string;
  claudeMdPath?: string;
  claudeMdContent?: string;
  skillFiles: SkillFile[];
  handoffFiles: string[];
  currentTaskPath?: string;
  currentTaskContent?: string;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  /** Impacto no score, sempre negativo (pontos a deduzir de 100). */
  scoreImpact: number;
}

export interface Rule {
  id: string;
  description: string;
  /**
   * A assinatura original era estritamente sincrona (`=> Finding[]`). Foi
   * alargada para `Finding[] | Promise<Finding[]>` por um motivo concreto: a
   * regra `token-budget` consulta POST /v1/messages/count_tokens, que e I/O de
   * rede. Sem async so restariam duas saidas ruins — bloquear o event loop com
   * uma requisicao sincrona, ou abandonar a contagem oficial de tokens e voltar
   * para a heuristica de caracteres que a propria tarefa manda substituir.
   *
   * A uniao foi escolhida em vez de tornar `check` sempre `Promise<Finding[]>`
   * porque e retrocompativel: as regras sincronas existentes (claude-md-*,
   * skill-coverage, handoff-freshness) continuam validas sem uma linha alterada,
   * e testa-las nao exige await. Quem consome o contrato usa `runRules()`
   * (src/rules/index.ts), que faz o await por conta propria.
   */
  check: (context: ScanContext) => Finding[] | Promise<Finding[]>;
}
