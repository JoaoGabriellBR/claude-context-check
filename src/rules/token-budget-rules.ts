import Anthropic from "@anthropic-ai/sdk";
import type { Finding, Rule, ScanContext } from "../types";
import { estimateTokens } from "../tokens";

/**
 * Modelo usado na contagem. Contagem de tokens e especifica do modelo, entao o
 * numero so vale para o modelo informado.
 */
const COUNT_MODEL = "claude-opus-5";

/**
 * Limiares do "cold start": os tokens que toda sessao paga antes da primeira
 * pergunta (CLAUDE.md inteiro + indice de nomes/descricoes das skills).
 *
 * 4000 tokens e o ponto onde o custo fixo deixa de ser ruido: ele e pago em
 * toda sessao e, sem cache, em todo turno. 10000 e o ponto onde o cold start
 * come contexto que deveria ser do trabalho em si.
 */
const WARN_TOKENS = 4000;
const ALERT_TOKENS = 10000;

/** Uma checagem de contexto nao pode ficar minutos pendurada num socket; o
 * default do SDK e 10 minutos. 10s e mais que suficiente para count_tokens. */
const REQUEST_TIMEOUT_MS = 10_000;

export const tokenBudget: Rule = {
  id: "token-budget",
  description:
    "Estima os tokens de cold start (CLAUDE.md + indice de skills) via count_tokens",
  async check(context: ScanContext): Promise<Finding[]> {
    const payload = buildColdStartPayload(context);
    if (payload.trim().length === 0) return [];

    const count = await countTokens(payload);
    if (count.tokens <= WARN_TOKENS) return [];

    const severity = count.tokens > ALERT_TOKENS ? "medium" : "low";
    const scoreImpact = count.tokens > ALERT_TOKENS ? -10 : -5;
    const limit = count.tokens > ALERT_TOKENS ? ALERT_TOKENS : WARN_TOKENS;

    return [
      {
        ruleId: "token-budget",
        severity,
        message: `Cold start de ${count.tokens} tokens (CLAUDE.md + indice de ${context.skillFiles.length} skill(s)), acima do limiar de ${limit}. ${count.note} Esse custo e pago em toda sessao: mova detalhe para skills carregadas sob demanda.`,
        scoreImpact,
      },
    ];
  },
};

interface TokenCount {
  tokens: number;
  /** Texto que deixa explicito se o numero e exato ou aproximado. */
  note: string;
}

/**
 * Conta tokens via POST /v1/messages/count_tokens quando ha credencial, e cai
 * na heuristica de caracteres quando nao ha. O resultado sempre carrega no
 * `note` de onde o numero veio — um numero aproximado apresentado como exato e
 * pior do que nao ter numero.
 */
async function countTokens(payload: string): Promise<TokenCount> {
  const hasCredential = Boolean(
    process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN,
  );

  if (!hasCredential) {
    return {
      tokens: estimateTokens(payload),
      note: "[ESTIMATIVA APROXIMADA, ~4 caracteres/token: defina ANTHROPIC_API_KEY para contagem exata via /v1/messages/count_tokens]",
    };
  }

  try {
    const client = new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
    const response = await client.messages.countTokens({
      model: COUNT_MODEL,
      messages: [{ role: "user", content: payload }],
    });
    return {
      tokens: response.input_tokens,
      note: `[contagem exata via /v1/messages/count_tokens, modelo ${COUNT_MODEL}]`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      tokens: estimateTokens(payload),
      note: `[ESTIMATIVA APROXIMADA, ~4 caracteres/token: a chamada a /v1/messages/count_tokens falhou (${reason})]`,
    };
  }
}

/**
 * Monta o que o agente realmente carrega ao abrir uma sessao: o CLAUDE.md
 * inteiro mais uma linha por skill com nome e descricao. O corpo das skills
 * nao entra — ele so e lido quando a skill e invocada, e cobrar isso no cold
 * start superestimaria o custo fixo.
 */
function buildColdStartPayload(context: ScanContext): string {
  const parts: string[] = [];

  if (context.claudeMdContent) {
    parts.push(context.claudeMdContent);
  }

  for (const skill of context.skillFiles) {
    const name = skill.name ?? "(sem nome)";
    const description = skill.description ?? "(sem descricao)";
    parts.push(`${name}: ${description}`);
  }

  return parts.join("\n\n");
}

export const tokenBudgetRules: Rule[] = [tokenBudget];
