import type { Rule } from "../types";
import { claudeMdRules } from "./claude-md-rules";

/**
 * Registro central de regras. Para adicionar uma nova checagem (ex: cobertura
 * de skills, freshness dos handoffs), crie um novo arquivo em src/rules/ e
 * adicione o array de regras aqui.
 */
export const allRules: Rule[] = [...claudeMdRules];
