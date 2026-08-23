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

Requer Node >= 18 (os testes usam o runner nativo `node:test`).

### Contagem de tokens (opcional)

A regra `token-budget` usa a API oficial de contagem de tokens da Anthropic
(`POST /v1/messages/count_tokens`). Com `ANTHROPIC_API_KEY` (ou
`ANTHROPIC_AUTH_TOKEN`) definida, o numero e exato para o modelo consultado.
Sem credencial — ou se a chamada falhar — cai na heuristica de ~4
caracteres/token e a mensagem sai marcada com `[ESTIMATIVA APROXIMADA]`.

`tiktoken` e `gpt-tokenizer` ficam de fora de proposito: sao tokenizers da
OpenAI e subestimam tokens do Claude em 15-20% em texto comum, mais que isso
em codigo.

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
npm run scan:clean    # repo com CLAUDE.md organizado (100/100)
```

## Testes

```bash
npm test
```

Runner nativo `node:test` (nenhuma dependencia de teste nova), com `ts-node`
como loader. Os testes cobrem os dois ramos de cada regra e usam os fixtures de
`examples/` como base.

Nota sobre `examples/clean-repo`: o handoff dele tem data fixa no nome
(`2026-08-20-...`), entao passados 30 dias dessa data o proprio fixture
envelhece e `scan:clean` deixa de fechar em 100/100. Para renovar, basta
renomear o arquivo com a data atual. A garantia permanente de "repo limpo =
100/100" esta no teste que gera um repositorio temporario com datas relativas.

## Arquitetura

```
Scanner  -> Parser (frontmatter/markdown) -> Rules Engine -> Scoring -> Reporter
```

- `src/scanner.ts` — encontra e le CLAUDE.md, skills (`.claude/skills/**/SKILL.md`),
  handoffs (`.claude/handoffs/**/*.md`) e `CURRENT_TASK.md`.
- `src/rules/` — cada regra recebe o `ScanContext` e devolve uma lista de
  `Finding` (severidade + mensagem + impacto no score), de forma sincrona ou
  assincrona (`Finding[] | Promise<Finding[]>` — `token-budget` precisa de I/O
  de rede). `runRules()` roda tudo em paralelo e concatena os findings na ordem
  do registro, para a saida ser deterministica. Para adicionar uma regra nova,
  crie um arquivo em `src/rules/` e registre em `src/rules/index.ts`.
- `src/tokens.ts` — heuristica de ~4 caracteres/token, compartilhada por
  `claude-md-size` e pelo fallback de `token-budget`.
- `src/scoring.ts` — agrega os findings num score de 0 a 100.
- `src/reporter.ts` — formata a saida no terminal (ou JSON, via `--json`).

## Regras implementadas

| Regra | Severidade | O que verifica |
|---|---|---|
| `claude-md-exists` | Critico | CLAUDE.md existe na raiz? |
| `claude-md-size` | Medio | CLAUDE.md esta acima do tamanho recomendado? |
| `claude-md-duplicate-lines` | Alto | Ha instrucoes duplicadas no CLAUDE.md? |
| `skill-coverage` | Medio (por skill) | Existem as skills essenciais — code-review, security-review e alguma de testes? |
| `handoff-freshness` | Baixo / Medio | Existe handoff em `.claude/handoffs/`? Baixo se nao houver nenhum; Medio se o mais recente passar de 30 dias. |
| `token-budget` | Baixo / Medio | Quantos tokens custa o cold start (CLAUDE.md + indice de skills)? Baixo acima de 4000; Medio acima de 10000. |

### Decisoes de projeto das regras novas

- **`skill-coverage` casa a identidade da skill** (frontmatter `name`, ou o nome
  do diretorio), nunca a `description`. Casar description quebra na primeira
  skill de code-review que mencionar "seguranca" e "testes" no texto: ela
  satisfaria as tres checagens sozinha.
- **`handoff-freshness` usa 30 dias** = dois sprints de duas semanas. Passado
  isso o codigo quase sempre andou e o handoff passa a afirmar coisas falsas —
  deixa de ser contexto e vira desinformacao que ainda e paga em tokens.
- **`handoff-freshness` prefere a data no nome do arquivo ao `mtime`.** git nao
  versiona mtime: clone e checkout gravam a hora da operacao em todo arquivo,
  entao num runner de CI — onde a checagem mais importa — todo handoff teria
  segundos de idade. mtime fica como fallback para nome sem data.
- **`token-budget` conta apenas nome e descricao das skills**, nao o corpo: o
  corpo so e lido quando a skill e invocada, e cobra-lo aqui superestimaria o
  custo fixo da sessao.

## Roadmap

- [x] Regra de cobertura de skills (code-review, security-review, testes)
- [x] Regra de "freshness" dos handoffs (ultima atualizacao vs. idade do branch)
- [x] Estimativa real de tokens via `POST /v1/messages/count_tokens`
      (com fallback heuristico quando `ANTHROPIC_API_KEY` nao estiver definida)
- [x] Testes automatizados das regras (`npm test`)
- [ ] Publicar como pacote npm (`npx claude-context-check`)
- [ ] GitHub Action para rodar em pull requests
