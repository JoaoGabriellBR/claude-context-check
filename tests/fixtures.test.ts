import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { runRules } from "../src/rules";
import { scanRepo } from "../src/scanner";
import { computeScore } from "../src/scoring";
import type { Finding } from "../src/types";
import { isoDaysAgo, makeTempRepo, removeTempRepo } from "./helpers";

const EXAMPLES = path.resolve(__dirname, "..", "examples");

/**
 * Nenhum teste pode sair para a rede: com credencial no ambiente, token-budget
 * chamaria /v1/messages/count_tokens de verdade e o resultado passaria a
 * depender de rede e de saldo. O caminho de fallback e o que se assere aqui.
 */
const saved = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  authToken: process.env.ANTHROPIC_AUTH_TOKEN,
};

before(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});

after(() => {
  if (saved.apiKey !== undefined) process.env.ANTHROPIC_API_KEY = saved.apiKey;
  if (saved.authToken !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = saved.authToken;
});

async function scan(repoPath: string): Promise<{ findings: Finding[]; score: number }> {
  const findings = await runRules(await scanRepo(repoPath));
  return { findings, score: computeScore(findings) };
}

function ruleIds(findings: Finding[]): string[] {
  return [...new Set(findings.map((finding) => finding.ruleId))].sort();
}

describe("examples/sample-repo", () => {
  it("acusa duplicacao, skills essenciais ausentes e handoff velho", async () => {
    const { findings, score } = await scan(path.join(EXAMPLES, "sample-repo"));

    assert.deepEqual(ruleIds(findings), [
      "claude-md-duplicate-lines",
      "handoff-freshness",
      "skill-coverage",
    ]);

    const missingSkills = findings.filter((finding) => finding.ruleId === "skill-coverage");
    assert.equal(missingSkills.length, 2);
    assert.ok(missingSkills.some((finding) => finding.message.includes("security-review")));
    assert.ok(missingSkills.some((finding) => finding.message.includes("testes")));

    // O CLAUDE.md do fixture e pequeno, entao nem claude-md-size nem
    // token-budget cruzam seus limiares. Os dois tem cobertura propria em
    // tests/rules.test.ts.
    assert.ok(score < 100, `esperado score abaixo de 100, veio ${score}`);
  });
});

describe("examples/clean-repo", () => {
  it("nao acusa nada fora de handoff-freshness", async () => {
    const { findings } = await scan(path.join(EXAMPLES, "clean-repo"));

    // handoff-freshness fica de fora da asserção porque o fixture carrega uma
    // data fixa no nome do arquivo (2026-08-20): passados 30 dias dessa data o
    // proprio fixture envelhece. A garantia permanente de "repo limpo = 100"
    // esta no teste do repositorio temporario abaixo.
    const relevant = findings.filter((finding) => finding.ruleId !== "handoff-freshness");
    assert.deepEqual(relevant, []);
  });
});

describe("repositorio limpo gerado na hora", () => {
  const created: string[] = [];
  after(() => created.forEach(removeTempRepo));

  it("fecha em 100/100", async () => {
    const root = makeTempRepo({
      "CLAUDE.md": [
        "# CLAUDE.md",
        "",
        "## Regras gerais",
        "- Rode os testes antes de cada commit.",
        "- Siga Conventional Commits.",
        "",
      ].join("\n"),
      ".claude/skills/code-review/SKILL.md":
        "---\nname: code-review\ndescription: Audita o diff antes do merge.\n---\n",
      ".claude/skills/security-review/SKILL.md":
        "---\nname: security-review\ndescription: Audita injection, authz e segredos.\n---\n",
      ".claude/skills/guia-testes/SKILL.md":
        "---\nname: guia-testes\ndescription: Guia de testes reproduzivel para QA.\n---\n",
      [`.claude/handoffs/${isoDaysAgo(3)}-endpoint-licencas.md`]:
        "# Handoff\n\nEndpoint implementado, falta teste de integracao.\n",
    });
    created.push(root);

    const { findings, score } = await scan(root);
    assert.deepEqual(findings, []);
    assert.equal(score, 100);
  });
});

describe("computeScore", () => {
  it("nunca passa de 100 nem cai abaixo de 0", () => {
    assert.equal(computeScore([]), 100);
    assert.equal(
      computeScore([
        { ruleId: "x", severity: "critical", message: "", scoreImpact: -30 },
        { ruleId: "y", severity: "critical", message: "", scoreImpact: -200 },
      ]),
      0,
    );
  });
});
