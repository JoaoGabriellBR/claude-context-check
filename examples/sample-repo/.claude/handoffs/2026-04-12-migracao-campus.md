# Handoff — Migracao da tabela de campus

## Estado atual
Migracao escrita e aplicada em homologacao. A coluna `instituicao_id` ainda
aceita nulo porque os registros legados nao tem vinculo.

## Proximo passo
Fazer o backfill dos legados e depois trocar a coluna para NOT NULL.

## Risco
Rodar o NOT NULL antes do backfill derruba a subida.
