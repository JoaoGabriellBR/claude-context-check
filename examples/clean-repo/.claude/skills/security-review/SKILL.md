---
name: security-review
description: Audita o diff em busca de injection, falha de authz, cripto fraca e segredo versionado.
---

# Security Review

Percorra o diff procurando entrada de usuario que chega ao banco sem parametro
vinculado, endpoint sem checagem de permissao, hash de senha sem salt e chave
ou token comitado.
