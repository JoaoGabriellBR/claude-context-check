/**
 * Heuristica de ~4 caracteres por token, usada quando nao ha credencial para
 * chamar POST /v1/messages/count_tokens.
 *
 * E uma aproximacao grosseira e assumida como tal: erra para cima em codigo e
 * em portugues acentuado, e para baixo em texto ingles corrido. Serve para
 * ordem de grandeza, nao para orcamento. tiktoken e gpt-tokenizer nao sao
 * alternativa: sao tokenizers da OpenAI e subestimam tokens do Claude em
 * 15-20% em texto comum, e mais que isso em codigo.
 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.round(text.length / CHARS_PER_TOKEN);
}
