# Handoff — skill-coverage, handoff-freshness e token-budget

Data: 2026-08-23

## O que foi feito

As tres regras do roadmap, uma por commit, mais o refactor que a terceira
exigiu e a suite de testes.

| Commit | Conteudo |
|---|---|
| `chore: bootstrap repository baseline` | O repositorio nao era um repo git. Primeiro commit versiona o estado que ja existia. |
| `feat(rules): add skill-coverage rule` | `src/rules/skill-coverage-rules.ts` + skills `security-review` e `guia-testes` em `examples/clean-repo`. |
| `feat(rules): add handoff-freshness rule` | `src/rules/handoff-rules.ts` + handoff datado de 2026-04-12 em `examples/sample-repo`. |
| `refactor(rules): allow rule checks to be async` | `Rule.check` alargada e `runRules()` introduzida. |
| `feat(rules): add token-budget rule using count_tokens` | `src/rules/token-budget-rules.ts` + `src/tokens.ts`. |
| `test: cover existing and new rules with node:test` | `tests/` com 27 casos. |
| `docs: document the three new rules in the README` | Roadmap e tabela de regras. |

Estado verificado no fim: `npm run build` sem erro nem warning, `npm test` com
27/27 passando, `npm run scan:sample` em 44/100 com os findings novos,
`npm run scan:clean` em 100/100.

## Decisoes de projeto que vale registrar

**Por que 30 dias em `handoff-freshness`.** Dois sprints de duas semanas. Um
handoff descreve trabalho em andamento; passados dois sprints o codigo quase
sempre andou e o documento passa a afirmar coisas falsas — deixa de ser
contexto e vira desinformacao que ainda e paga em tokens a cada sessao. Abaixo
de ~2 semanas o alarme dispararia em trabalho legitimamente pausado por ferias
ou espera de review, que e uso normal.

**Por que a data do nome do arquivo vence o `mtime`.** `fs.statSync().mtime` e
o caminho obvio e foi o sugerido, mas git nao versiona mtime: clone e checkout
gravam a hora da operacao em todo arquivo. Num runner de CI — justamente onde
essa checagem mais importa — todo handoff teria segundos de idade e a regra
nunca acusaria nada. O prefixo `YYYY-MM-DD` e metadado autorado, sobrevive ao
clone e ja e a convencao de nome usada nos handoffs. mtime ficou como fallback
para arquivo sem data no nome.

**Por que `node:test` e nao Jest.** Ja vem no runtime: zero dependencia nova,
zero arquivo de configuracao, nenhum transform para manter. O unico custo e um
`--require ts-node/register`, e `ts-node` ja era devDependency. Jest se pagaria
com mocking pesado, snapshot ou cobertura instrumentada, nada disso necessario
aqui.

**Por que `Rule.check` mudou de assinatura.** `token-budget` consulta
`POST /v1/messages/count_tokens`, que e I/O de rede. Mantendo a assinatura
sincrona sobrariam duas saidas ruins: bloquear o event loop com requisicao
sincrona, ou desistir da contagem oficial de tokens. A mudanca foi para a uniao
`Finding[] | Promise<Finding[]>`, e nao para `Promise<Finding[]>` puro, porque a
uniao e retrocompativel: as cinco regras sincronas continuam validas sem uma
linha alterada e seus testes nao precisam de await.

**Por que `skill-coverage` ignora a `description`.** Casar o texto da descricao
faria uma unica skill de code-review cuja descricao menciona "seguranca" e
"testes" satisfazer as tres checagens sozinha. O casamento e contra a
identidade: frontmatter `name`, ou o nome do diretorio como fallback. Ha teste
de regressao para isso.

**Pesos de score.** Cada skill ausente vale -8 e nao -10 (o peso de um Medium
em `claude-md-size`) porque o finding e por skill: tres ausencias somariam -30,
o mesmo peso de um CLAUDE.md inexistente, que e problema de outra ordem.

## Pendencias e riscos conhecidos

1. **O caminho de sucesso de `count_tokens` nao foi validado contra a API
   real.** Nao havia `ANTHROPIC_API_KEY` no ambiente. O que foi verificado: com
   chave invalida a requisicao chega ao servidor e volta `401
   authentication_error` — ou seja, o formato do corpo e aceito (corpo
   malformado voltaria `400 invalid_request_error`) — e o fallback com o
   marcador de estimativa aproximada funciona. Falta rodar uma vez com chave
   valida e conferir o valor de `input_tokens`.

2. **`token-budget` nao dispara em nenhum dos dois fixtures.** Os dois tem
   CLAUDE.md enxuto (`sample-repo` fica em ~275 tokens, muito abaixo do limiar
   de 4000). Os limiares nao foram baixados para caber no fixture, porque um
   cold start de 275 tokens e saudavel e acusa-lo seria mentir. Os dois ramos
   estao cobertos nos testes. Quem quiser ver a regra disparando no terminal:
   gere um CLAUDE.md acima de ~16 mil caracteres e escaneie.

3. **`examples/clean-repo` envelhece sozinho.** O handoff dele tem data fixa no
   nome (2026-08-20), entao a partir de 2026-09-19 `scan:clean` deixa de fechar
   em 100/100 e passa a acusar `handoff-freshness`. Renomear o arquivo com a
   data atual resolve. Os testes nao dependem disso: a garantia de "repo limpo
   = 100/100" roda contra um repositorio temporario com datas relativas.

4. **Ambiente.** A versao de node ativa na maquina era a 10.24.1, que nao roda
   `typescript@5` nem `node:test`. O build e os testes foram rodados com a
   v22.22.0 do nvm. `engines.node` foi fixado em `>=18` para o proximo nao cair
   nessa armadilha.

## Proximos passos naturais

- Rodar `token-budget` uma vez com credencial valida (item 1).
- Os dois itens que sobraram do roadmap: publicar como pacote npm e a GitHub
  Action para rodar em pull request. A Action e o encaixe obvio de
  `--fail-under`, que ja existe na CLI.
