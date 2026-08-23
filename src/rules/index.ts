import type { Finding, Rule, ScanContext } from "../types";
import { claudeMdRules } from "./claude-md-rules";
import { handoffRules } from "./handoff-rules";
import { skillCoverageRules } from "./skill-coverage-rules";

/**
 * Registro central de regras. Para adicionar uma nova checagem, crie um novo
 * arquivo em src/rules/ e adicione o array de regras aqui.
 */
export const allRules: Rule[] = [
  ...claudeMdRules,
  ...skillCoverageRules,
  ...handoffRules,
];

/**
 * Roda as regras e concatena os findings. Regras sincronas e assincronas
 * convivem: `check` pode devolver `Finding[]` ou `Promise<Finding[]>` (ver a
 * justificativa da assinatura em src/types.ts).
 *
 * As regras rodam em paralelo, mas os findings saem na ordem de `rules`, e nao
 * na ordem de conclusao — a saida da CLI precisa ser deterministica para poder
 * ser comparada entre execucoes.
 */
export async function runRules(
  context: ScanContext,
  rules: Rule[] = allRules,
): Promise<Finding[]> {
  const results = await Promise.all(rules.map((rule) => rule.check(context)));
  return results.flat();
}
