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
  check: (context: ScanContext) => Finding[];
}
