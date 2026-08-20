---
category: integration
audience: dev
stub: true
summary: Alteração feita à mão no CRM interno demora a aparecer no aplicativo.
---
# payments.spa_cache_nao_invalida

## Direção (dev)

Sintoma: alguém edita um item nas SPAs de billing do portal interno (aplicação 1060,
produto 1134, plano 1138, assinatura 1142, item 1146) e a API continua servindo o
valor antigo por até 5 minutos — que é o TTL do cache. O webhook de saída
`POST /api/webhooks/spa` existe para encurtar isso para a leitura seguinte. Se o
tempo voltou a ser o TTL, o webhook parou de chegar ou parou de agir.

Ordem de investigação, da causa mais comum para a menos:

### 1. Handler desativado no Bitrix

O Bitrix desativa um webhook de saída que erra em sequência — inclusive 404, que é o
que acontece se o webhook foi ativado antes de a API subir com a rota.

- No portal interno: **Aplicações > Webhooks de saída**, abrir o webhook das SPAs e
  conferir se está ativo e se a URL aponta para a API do ambiente certo.
- Sinal indireto: **nenhuma** linha de log `Cache da SPA invalidado` no período, nem
  `warn` de token — silêncio total significa que a requisição não chegou.

### 2. Token divergente

`BITRIX_SPA_WEBHOOK_TOKEN` tem que ser o application token que aparece na tela do
webhook de saída. Divergência responde 401 e não invalida nada.

- Log: `Webhook da SPA com application token inválido` (nível `warn`, `app: payments`).
- Se a env estiver vazia, o log é
  `BITRIX_SPA_WEBHOOK_TOKEN não configurado — webhook da SPA desabilitado` e a resposta
  é 503. Rotacionar o token no Bitrix exige atualizar a env e reiniciar a API.

### 3. Evento não vinculado à SPA certa

O webhook precisa estar vinculado aos eventos de item dinâmico das cinco SPAs. Se só
uma delas foi vinculada, as outras seguem com o comportamento antigo.

- Log: `SPA fora do escopo de billing — nada a invalidar` (nível `debug`) indica
  evento chegando de uma SPA que não é de billing — vínculo apontando para a SPA
  errada.
- `Webhook da SPA sem entityTypeId reconhecível — ignorando` (`warn`) indica evento
  que não é de item dinâmico.

### 4. Redis indisponível ou leitura do Bitrix falhando

Nenhum dos dois derruba a resposta (o Bitrix recebe 200 assim mesmo), então só o log
denuncia:

- `Invalidação de cache da SPA falhou — ignorando` (`warn`): Redis recusou o comando.
  O cache continua velho até o TTL; a próxima edição tenta de novo.
- `Leitura do pai no Bitrix falhou — caindo para varredura` (`warn`): a API não
  descobriu a aplicação/assinatura dona e apagou as listagens por pai em bloco. O
  resultado ainda é correto, só apaga mais cache do que precisava.

### 5. Confirmação de que funcionou

`Cache da SPA invalidado` (nível `info`, `app: payments`) traz `family` e
`deletedKeys`. `deletedKeys: 0` num item que existe é normal quando nada daquela
família estava em cache no momento.

## Ordem de ativação (para não recriar o problema)

1. Publicar a API com a rota `/api/webhooks/spa` e a env do token preenchida.
2. Só depois criar/ativar o webhook de saída no portal interno.

Invertido, o Bitrix recebe 404 nos primeiros eventos e desativa o handler — que é a
causa nº 1 desta lista, com o agravante de não haver log nenhum do lado da API para
apontar para ela.
