import fs from "node:fs";
import path from "node:path";
import type { Finding, Rule, ScanContext } from "../types";

/**
 * Limiar de "velho" para um handoff, em dias.
 *
 * 30 dias = dois sprints de duas semanas. A escolha nao e estetica: um handoff
 * descreve o estado de um trabalho em andamento ("endpoint implementado, falta
 * teste de integracao"). Passados dois sprints, o codigo quase sempre andou e o
 * documento passa a afirmar coisas falsas — ele deixa de ser contexto e vira
 * desinformacao que ainda custa tokens para ser carregada. Abaixo de ~2 semanas
 * o alarme dispararia em todo handoff de trabalho pausado por ferias ou espera
 * de review, que e uso legitimo.
 */
const STALE_AFTER_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DATED_FILENAME = /^(\d{4})-(\d{2})-(\d{2})/;

export const handoffFreshness: Rule = {
  id: "handoff-freshness",
  description:
    "Verifica se existe handoff em .claude/handoffs/ e se o mais recente nao esta velho",
  check(context: ScanContext): Finding[] {
    if (context.handoffFiles.length === 0) {
      return [
        {
          ruleId: "handoff-freshness",
          severity: "low",
          message:
            "Nenhum handoff em .claude/handoffs/. Sem handoff, o estado de um trabalho em andamento morre no fim da sessao e a proxima recomeca do zero.",
          scoreImpact: -5,
        },
      ];
    }

    const newest = context.handoffFiles
      .map((filePath) => ({ filePath, date: effectiveDate(filePath) }))
      .reduce((latest, current) => (current.date > latest.date ? current : latest));

    const ageInDays = Math.floor((Date.now() - newest.date.getTime()) / MS_PER_DAY);

    if (ageInDays > STALE_AFTER_DAYS) {
      return [
        {
          ruleId: "handoff-freshness",
          severity: "medium",
          message: `O handoff mais recente (${path.basename(newest.filePath)}) tem ${ageInDays} dias, acima do limiar de ${STALE_AFTER_DAYS}. Confirme se ele ainda descreve o estado real do codigo ou arquive-o.`,
          scoreImpact: -10,
        },
      ];
    }

    return [];
  },
};

/**
 * Data efetiva de um handoff: o prefixo `YYYY-MM-DD` do nome do arquivo quando
 * existe, senao o mtime.
 *
 * A ordem importa e nao e detalhe. `fs.statSync().mtime` e o caminho obvio, mas
 * git nao versiona mtime: clone e checkout gravam a hora da operacao em todo
 * arquivo. Num runner de CI — justamente onde essa checagem roda — todo handoff
 * teria segundos de idade e a regra nunca acusaria nada. O prefixo de data no
 * nome e metadado autorado, sobrevive ao clone e e a convencao de nome usada
 * nos handoffs. mtime fica como fallback para handoffs sem data no nome.
 */
function effectiveDate(filePath: string): Date {
  const match = DATED_FILENAME.exec(path.basename(filePath));
  if (match) {
    const [, year, month, day] = match;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    // Rejeita datas sintaticamente validas mas inexistentes (ex: 2026-02-31,
    // que o Date.UTC "corrige" silenciosamente para marco).
    if (parsed.getUTCMonth() === Number(month) - 1 && parsed.getUTCDate() === Number(day)) {
      return parsed;
    }
  }
  return fs.statSync(filePath).mtime;
}

export const handoffRules: Rule[] = [handoffFreshness];
