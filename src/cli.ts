#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { scanRepo } from "./scanner";
import { allRules } from "./rules";
import { computeScore } from "./scoring";
import { printReport } from "./reporter";
import type { Finding } from "./types";

const program = new Command();

program
  .name("chc")
  .description("Analisa a saude do contexto agentico de um repositorio Claude Code")
  .version("0.1.0");

program
  .command("scan")
  .description("Escaneia um repositorio e gera o relatorio de saude de contexto")
  .argument("[path]", "Caminho do repositorio", ".")
  .option("--json", "Gera saida em JSON (util para CI)")
  .option("--fail-under <score>", "Sai com codigo de erro se o score ficar abaixo do valor", "0")
  .action(async (targetPath: string, options: { json?: boolean; failUnder: string }) => {
    const repoPath = path.resolve(targetPath);

    try {
      const context = await scanRepo(repoPath);
      const findings: Finding[] = allRules.flatMap((rule) => rule.check(context));
      const score = computeScore(findings);

      if (options.json) {
        console.log(JSON.stringify({ repoPath, score, findings }, null, 2));
      } else {
        printReport(repoPath, findings, score);
      }

      const threshold = Number(options.failUnder);
      if (!Number.isNaN(threshold) && score < threshold) {
        process.exitCode = 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Erro: ${message}`);
      process.exitCode = 1;
    }
  });

program.parse();
