import chalk from "chalk";
import type { Finding, Severity } from "./types";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "CRITICO",
  high: "ALTO",
  medium: "MEDIO",
  low: "BAIXO",
};

const SEVERITY_STYLE: Record<Severity, (text: string) => string> = {
  critical: (text) => chalk.bgRed.white.bold(text),
  high: (text) => chalk.red.bold(text),
  medium: (text) => chalk.yellow.bold(text),
  low: (text) => chalk.gray(text),
};

export function printReport(repoPath: string, findings: Finding[], score: number): void {
  console.log();
  console.log(chalk.bold(`Context Health Check — ${repoPath}`));
  console.log(chalk.dim("-".repeat(60)));

  if (findings.length === 0) {
    console.log(chalk.green("Nenhum problema encontrado. Contexto saudavel."));
  } else {
    for (const severity of SEVERITY_ORDER) {
      const group = findings.filter((finding) => finding.severity === severity);
      for (const finding of group) {
        const tag = SEVERITY_STYLE[severity](` ${SEVERITY_LABEL[severity]} `);
        console.log(`${tag} ${finding.message}`);
      }
    }
  }

  console.log(chalk.dim("-".repeat(60)));
  console.log(`${chalk.bold("Score:")} ${formatScore(score)}`);
  console.log();
}

function formatScore(score: number): string {
  const text = `${score}/100`;
  if (score >= 80) return chalk.green.bold(text);
  if (score >= 50) return chalk.yellow.bold(text);
  return chalk.red.bold(text);
}
