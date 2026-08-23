# claude-context-check

CLI que analisa a saude do "contexto agentico" de um repositorio Claude Code
— clareza do `CLAUDE.md`, cobertura de skills, uso de handoffs — e devolve um
score de 0 a 100 com recomendacoes de correcao.

## Por que

Repositorios que usam Claude Code de forma intensa acumulam `CLAUDE.md`
gigantes, instrucoes duplicadas e handoffs abandonados. Isso desperdica
tokens e degrada a qualidade das respostas do agente. Esta ferramenta
automatiza a deteccao desses problemas, do mesmo jeito que um linter
automatiza a deteccao de problemas de estilo de codigo.

## Instalacao

```bash
npm install
npm run build
```

## Uso

```bash
node dist/cli.js scan caminho/do/seu/repositorio

# ou, apos npm link:
chc scan caminho/do/seu/repositorio

# saida em JSON, util pra CI:
chc scan . --json

# falha (exit code 1) se o score ficar abaixo de 70 — util em pipelines:
chc scan . --fail-under 70
```

## Testando com os exemplos incluidos

```bash
npm run scan:sample   # repo com CLAUDE.md bagunçado (score baixo)
npm run scan:clean    # repo com CLAUDE.md organizado (score alto)
```

## Arquitetura

```
Scanner  -> Parser (frontmatter/markdown) -> Rules Engine -> Scoring -> Reporter
```

- `src/scanner.ts` — encontra e le CLAUDE.md, skills (`.claude/skills/**/SKILL.md`),
  handoffs (`.claude/handoffs/**/*.md`) e `CURRENT_TASK.md`.
- `src/rules/` — cada regra recebe o `ScanContext` e devolve uma lista de
  `Finding` (severidade + mensagem + impacto no score). Para adicionar uma
  regra nova, crie um arquivo em `src/rules/` e registre em `src/rules/index.ts`.
- `src/scoring.ts` — agrega os findings num score de 0 a 100.
- `src/reporter.ts` — formata a saida no terminal (ou JSON, via `--json`).

## Regras implementadas

| Regra | Severidade | O que verifica |
|---|---|---|
| `claude-md-exists` | Critico | CLAUDE.md existe na raiz? |
| `claude-md-size` | Medio | CLAUDE.md esta acima do tamanho recomendado? |
| `claude-md-duplicate-lines` | Alto | Ha instrucoes duplicadas no CLAUDE.md? |

## Roadmap

- [ ] Regra de cobertura de skills (code-review, security-review, testes)
- [ ] Regra de "freshness" dos handoffs (ultima atualizacao vs. idade do branch)
- [ ] Estimativa real de tokens via `POST /v1/messages/count_tokens`
      (com fallback heuristico quando `ANTHROPIC_API_KEY` nao estiver definida)
- [ ] Publicar como pacote npm (`npx claude-context-check`)
- [ ] GitHub Action para rodar em pull requests
