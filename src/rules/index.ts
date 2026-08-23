import type { Rule } from "../types";
import { claudeMdRules } from "./claude-md-rules";
import { skillCoverageRules } from "./skill-coverage-rules";

/**
 * Registro central de regras. Para adicionar uma nova checagem (ex: freshness
 * dos handoffs, orcamento de tokens), crie um novo arquivo em src/rules/ e
 * adicione o array de regras aqui.
 */
export const allRules: Rule[] = [...claudeMdRules, ...skillCoverageRules];
