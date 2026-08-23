import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  claudeMdDuplicateLines,
  claudeMdExists,
  claudeMdSize,
} from "../src/rules/claude-md-rules";
import { handoffFreshness } from "../src/rules/handoff-rules";
import { skillCoverage } from "../src/rules/skill-coverage-rules";
import { tokenBudget } from "../src/rules/token-budget-rules";
import { runRules } from "../src/rules";
import type { Finding, Rule, ScanContext } from "../src/types";
import {
  isoDaysAgo,
  makeContext,
  makeSkill,
  makeTempRepo,
  removeTempRepo,
  repeatText,
} from "./helpers";

/**
 * As regras sincronas nunca devolvem Promise, mas o contrato permite as duas
 * formas; o helper normaliza para poder assertar direto.
 */
async function check(rule: Rule, context: ScanContext): Promise<Finding[]> {
  return rule.check(context);
}

describe("claude-md-exists", () => {
  it("acusa critico quando nao ha CLAUDE.md", async () => {
    const findings = await check(claudeMdExists, makeContext());
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "critical");
    assert.equal(findings[0].scoreImpact, -30);
  });

  it("nao acusa nada quando o CLAUDE.md existe", async () => {
    const findings = await check(
      claudeMdExists,
      makeContext({ claudeMdPath: "/repo/CLAUDE.md", claudeMdContent: "# CLAUDE.md" }),
    );
    assert.deepEqual(findings, []);
  });
});

describe("claude-md-size", () => {
  it("acusa medio acima de 8000 caracteres e reporta os tokens estimados", async () => {
    const content = repeatText("linha de contexto do dominio academico. ", 8_400);
    const findings = await check(claudeMdSize, makeContext({ claudeMdContent: content }));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "medium");
    assert.equal(findings[0].scoreImpact, -10);
    assert.match(findings[0].message, /~2100 tokens/);
  });

  it("nao acusa nada num CLAUDE.md enxuto", async () => {
    const findings = await check(
      claudeMdSize,
      makeContext({ claudeMdContent: "# CLAUDE.md\n\n- Rode os testes." }),
    );
    assert.deepEqual(findings, []);
  });
});

describe("claude-md-duplicate-lines", () => {
  it("acusa alto quando a mesma instrucao aparece duas vezes", async () => {
    const line = "Sempre rode os testes antes de fazer commit para nao quebrar nada.";
    const findings = await check(
      claudeMdDuplicateLines,
      makeContext({ claudeMdContent: `# Regras\n${line}\n## Outra secao\n${line}\n` }),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "high");
    assert.equal(findings[0].scoreImpact, -15);
  });

  it("ignora headers e linhas curtas, que dariam falso positivo", async () => {
    const findings = await check(
      claudeMdDuplicateLines,
      makeContext({ claudeMdContent: "# Regras\n- ok\n## Regras\n- ok\n" }),
    );
    assert.deepEqual(findings, []);
  });
});

describe("skill-coverage", () => {
  it("nao acusa nada quando as tres skills essenciais existem", async () => {
    const findings = await check(
      skillCoverage,
      makeContext({
        skillFiles: [
          makeSkill("code-review", { name: "code-review" }),
          makeSkill("security-review", { name: "security-review" }),
          makeSkill("guia-testes", { name: "guia-testes" }),
        ],
      }),
    );
    assert.deepEqual(findings, []);
  });

  it("acusa uma por skill ausente, citando qual falta", async () => {
    const findings = await check(
      skillCoverage,
      makeContext({ skillFiles: [makeSkill("code-review", { name: "code-review" })] }),
    );
    assert.equal(findings.length, 2);
    assert.ok(findings.every((finding) => finding.severity === "medium"));
    assert.ok(findings.every((finding) => finding.scoreImpact === -8));
    assert.match(findings[0].message, /security-review/);
    assert.match(findings[1].message, /testes/);
  });

  it("acusa as tres quando o repositorio nao tem skill nenhuma", async () => {
    const findings = await check(skillCoverage, makeContext());
    assert.equal(findings.length, 3);
  });

  it("usa o nome do diretorio quando o frontmatter nao tem name", async () => {
    const findings = await check(
      skillCoverage,
      makeContext({
        skillFiles: [
          makeSkill("code-review"),
          makeSkill("security-review"),
          makeSkill("testing-strategy"),
        ],
      }),
    );
    assert.deepEqual(findings, []);
  });

  it("nao aceita a description como prova de cobertura", async () => {
    // Regressao: casar description faria esta unica skill satisfazer as tres
    // checagens de uma vez, sem que exista skill de seguranca nem de teste.
    const findings = await check(
      skillCoverage,
      makeContext({
        skillFiles: [
          makeSkill("code-review", {
            name: "code-review",
            description: "Revisa riscos de seguranca e cobertura de testes no diff.",
          }),
        ],
      }),
    );
    assert.equal(findings.length, 2);
  });
});

describe("handoff-freshness", () => {
  const created: string[] = [];
  after(() => created.forEach(removeTempRepo));

  it("acusa baixo quando nao existe handoff", async () => {
    const findings = await check(handoffFreshness, makeContext());
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "low");
    assert.equal(findings[0].scoreImpact, -5);
  });

  it("nao acusa nada quando o handoff mais recente esta dentro do limiar", async () => {
    const findings = await check(
      handoffFreshness,
      makeContext({ handoffFiles: [`/repo/.claude/handoffs/${isoDaysAgo(29)}-x.md`] }),
    );
    assert.deepEqual(findings, []);
  });

  it("acusa medio quando o handoff mais recente passou de 30 dias", async () => {
    const findings = await check(
      handoffFreshness,
      makeContext({ handoffFiles: [`/repo/.claude/handoffs/${isoDaysAgo(31)}-x.md`] }),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "medium");
    assert.equal(findings[0].scoreImpact, -10);
    assert.match(findings[0].message, /limiar de 30/);
  });

  it("olha o handoff mais recente, nao o mais antigo", async () => {
    const findings = await check(
      handoffFreshness,
      makeContext({
        handoffFiles: [
          `/repo/.claude/handoffs/${isoDaysAgo(400)}-antigo.md`,
          `/repo/.claude/handoffs/${isoDaysAgo(2)}-novo.md`,
        ],
      }),
    );
    assert.deepEqual(findings, []);
  });

  it("cai no mtime quando o nome do arquivo nao tem data", async () => {
    const root = makeTempRepo({
      ".claude/handoffs/sem-data.md": "# Handoff sem data no nome\n",
    });
    created.push(root);
    const findings = await check(
      handoffFreshness,
      makeContext({ handoffFiles: [path.join(root, ".claude", "handoffs", "sem-data.md")] }),
    );
    // Arquivo acabou de ser escrito, logo o mtime e de agora e esta fresco.
    assert.deepEqual(findings, []);
  });

  it("ignora data sintaticamente valida mas inexistente e cai no mtime", async () => {
    const root = makeTempRepo({ ".claude/handoffs/2026-02-31-impossivel.md": "# x\n" });
    created.push(root);
    const findings = await check(
      handoffFreshness,
      makeContext({
        handoffFiles: [path.join(root, ".claude", "handoffs", "2026-02-31-impossivel.md")],
      }),
    );
    assert.deepEqual(findings, []);
  });
});

describe("token-budget", () => {
  // Os testes assertam o caminho de fallback, entao a credencial sai do
  // ambiente: teste que depende de rede nao e teste.
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

  it("nao acusa nada quando nao ha CLAUDE.md nem skill", async () => {
    const findings = await check(tokenBudget, makeContext());
    assert.deepEqual(findings, []);
  });

  it("nao acusa nada num cold start abaixo do limiar", async () => {
    const findings = await check(
      tokenBudget,
      makeContext({ claudeMdContent: "# CLAUDE.md\n\n- Rode os testes.\n" }),
    );
    assert.deepEqual(findings, []);
  });

  it("acusa baixo acima de 4000 tokens e marca a estimativa como aproximada", async () => {
    const findings = await check(
      tokenBudget,
      makeContext({ claudeMdContent: repeatText("regra de contexto do dominio. ", 20_000) }),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "low");
    assert.equal(findings[0].scoreImpact, -5);
    assert.match(findings[0].message, /ESTIMATIVA APROXIMADA/);
    assert.match(findings[0].message, /ANTHROPIC_API_KEY/);
  });

  it("acusa medio acima de 10000 tokens", async () => {
    const findings = await check(
      tokenBudget,
      makeContext({ claudeMdContent: repeatText("regra de contexto do dominio. ", 48_000) }),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "medium");
    assert.equal(findings[0].scoreImpact, -10);
  });

  it("conta o indice de skills, nao so o CLAUDE.md", async () => {
    const description = repeatText("descricao longa de skill. ", 6_000);
    const findings = await check(
      tokenBudget,
      makeContext({
        claudeMdContent: "# CLAUDE.md\n",
        skillFiles: [
          makeSkill("a", { name: "a", description }),
          makeSkill("b", { name: "b", description }),
          makeSkill("c", { name: "c", description }),
        ],
      }),
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /indice de 3 skill\(s\)/);
  });
});

describe("runRules", () => {
  it("mistura regra sincrona e assincrona preservando a ordem do registro", async () => {
    const slowAsync: Rule = {
      id: "slow-async",
      description: "regra assincrona lenta",
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return [{ ruleId: "slow-async", severity: "low", message: "A", scoreImpact: -1 }];
      },
    };
    const fastSync: Rule = {
      id: "fast-sync",
      description: "regra sincrona",
      check: () => [{ ruleId: "fast-sync", severity: "low", message: "B", scoreImpact: -2 }],
    };

    const findings = await runRules(makeContext(), [slowAsync, fastSync]);
    assert.deepEqual(
      findings.map((finding) => finding.message),
      ["A", "B"],
    );
  });
});
