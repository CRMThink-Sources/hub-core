# Tasks

## 1. Domínio e configuração da cadência

- [x] 1.1 Adicionar os campos abaixo em `domain/value-objects/connector-settings.ts`, `connector-settings.schema.ts` e no schema do cache do item (`cached-subscription-item.repository.ts`), com `.catch` por campo:
  - `cadenceEnabled` e `cadencePauseEnabled`, com default `false`;
  - `cadenceMaxMessages`, `cadenceWindowMinutes` e `cadencePauseMinutes`, como `number | null`.

  Verificar com teste do schema:
  - settings antigos leem a cadência desativada;
  - um valor estranho num campo cai no default só daquele campo;
  - o merge preserva os toggles e o limite diário.
- [x] 1.2 Criar `domain/send-cadence.ts` com os tipos `CadencePolicy` e `CadenceState`, `cadencePolicyOf`, que devolve `null` fora de Z-API, e `isValidCadenceConfig`. Verificar com testes unitários dos cenários "Valor inválido" e "Pausa ativada sem duração" e do mapeamento de provider.
- [x] 1.3 Implementar `assertCadencePatch` em `application/update-line-settings.ts` e aceitar os campos no zod estrito de `update-line-settings.controller.ts`. A validação roda sobre o resultado do merge e antes de qualquer escrita, e recusa com `thinkzap.line.cadence_invalid`:
  - linha que não é Z-API;
  - N ou D inválido com a cadência ligada;
  - P inválido com a pausa ligada.

  Verificar com testes do caso de uso e do controller:
  - ativar com N = 20 e D = 1 grava;
  - N = 0 é recusado e nada é gravado, nem o nome;
  - a linha oficial é recusada.
- [x] 1.4 Adicionar a flag `THINKZAP_UNIFIED_OUTBOX_DOMAINS` (lista de `memberId` ou `*`) com o helper `isUnifiedOutboxEnabled(memberId)`. Com a flag desligada para a instalação, o PATCH recusa ativar a cadência com `thinkzap.line.cadence_unavailable`. Verificar com testes do helper (lista, `*` e vazio) e do caso de uso.
- [x] 1.5 Adicionar os códigos `thinkzap.line.cadence_*` e `thinkzap.outbox.sequencer_stale_removed` em `errors/catalog.ts` e os guias em `mcp/kb/runbooks/hubcore/thinkzap/line/`. Verificar com o teste de cruzamento catálogo × runbooks.

## 2. Cadência e sequenciador em Redis

- [x] 2.1 Criar a porta `SendCadence` (`domain/ports/send-cadence.port.ts`) e o adapter `infra/queue/redis-send-cadence.ts`, com os scripts Lua exportados de `reserve`, `release`, `registerExternal` e `state`, sobre o hash `thinkzap:cadence:{lineKey}` com snapshot (design, decisão 2). Verificar com testes do adapter usando o Redis fake, no padrão de `redis-daily-send-quota.test.ts`:
  - a janela abre no primeiro envio;
  - a janela cheia nega com `retryAt = windowEnd`;
  - a pausa começa na N-ésima mensagem e substitui o restante da janela;
  - sem pausa, a janela seguinte abre no fim da anterior;
  - a cadência desligada sem janela aceita sem contar;
  - `release` só vale para o mesmo `windowId`.
- [x] 2.2 Cobrir "Mudança de configuração vale na próxima janela" no adapter. Verificar com testes:
  - reduzir N no meio da janela mantém o snapshot;
  - mudar P durante a pausa não altera o fim dela;
  - desativar durante a pausa só libera depois de `pauseUntil`.
- [x] 2.3 Implementar `registerExternal` para o espelhamento. Verificar com testes:
  - conta na janela aberta;
  - abre uma janela quando não há nenhuma;
  - dispara a pausa no N-ésimo envio;
  - é no-op durante a pausa ou com a janela cheia, sem estender nada.
- [x] 2.4 Implementar o sequenciador FIFO por linha: `INCR thinkzap:cadence-seq:{lineKey}`, ZSET `thinkzap:cadence-queue:{lineKey}` e checagem de cabeça dentro do `reserve`, com `ZADD NX` do próprio ticket (design, decisão 3). Verificar com testes:
  - só a cabeça recebe a vaga;
  - quem não é a cabeça recebe `not-head`;
  - um ticket removido e reinserido mantém a posição pelo `queueSeq`.
- [x] 2.5 Verificar a atomicidade com um teste de duas reservas concorrentes na última vaga da janela: exatamente uma é aceita e a outra recebe `retryAt` (cenário "Envios simultâneos na última vaga da janela").
- [x] 2.6 Criar a varredura (node-cron, a cada 60 s, em `shared/infra/scheduler/`), que remove do ZSET ids sem linha na outbox ou em estado terminal e registra `thinkzap.outbox.sequencer_stale_removed`. Verificar com teste da varredura usando repositório e Redis fakes.
- [x] 2.7 Na varredura, recriar o job da **cabeça viva sem job**: a row está PENDING/SENDING, a mesma cabeça aparece em duas rodadas seguidas e não há job `widget-send-<id>` esperando, atrasado ou rodando. Registrar `thinkzap.outbox.sequencer_head_rescheduled`. A varredura passa a rodar no processo do worker de envio (`thinkzap-widget-outbound.worker.ts`), e não na API. Verificar com testes da varredura (duas rodadas, job vivo não é recriado, cabeça que mudou espera, falha de uma linha não para as outras) e do `ensureScheduled` (sem job, job falho, job atrasado).

## 3. Outbox: origem, mídia e grupo

- [x] 3.1 Escrever a migration Prisma em `ThinkzapWidgetOutbox` (design, decisão 5). Ela adiciona:
  - o enum `ThinkzapOutboxOrigin`, com default `WIDGET`;
  - `kind` `MEDIA`, com `mediaType`, `mediaSource`, `fileName` e `caption`;
  - `dispatchGroupId` e `partIndex`;
  - `bitrixMessageId`, `bitrixChatId`, `connectorChatId` e `referencedMessageId`;
  - `queueSeq` e `cadenceWaitUntil`;
  - os índices `(dispatchGroupId)` e `(instanceId, status)`.

  Verificar que `prisma migrate dev` aplica sem erro e que as linhas existentes leem `origin = WIDGET`.
- [x] 3.2 Estender `prisma-widget-outbox.repository.ts` com:
  - a criação em lote de partes de um grupo;
  - `markWaiting(id, waitUntil)`;
  - `countWaitingByInstance`;
  - `groupOutcome(dispatchGroupId)`;
  - `claimGroupTimelineNotification`, um `UPDATE` condicional na primeira linha do grupo.

  Verificar com testes do repositório, incluindo dois `claimGroupTimelineNotification` concorrentes em que só um vence.
- [x] 3.3 Gravar `queueSeq` e fazer o `ZADD` no sequenciador em todos os pontos que criam linhas da outbox de linha Z-API: `enqueue-widget-message`, `enqueue-widget-button`, `enqueue-widget-template`, `enqueue-template-send.service` e `enqueue-interactive-button-send.service`. Verificar com testes dos enfileiramentos: a sequência é crescente por linha e a linha oficial não toca o sequenciador.

## 4. Cadência no dispatcher e no worker

- [x] 4.1 Incluir `cadence.reserve` em `dispatch-widget-outbox-message.ts`, depois da trava por destino e antes de `claimForSending`. Na negativa, devolve `{ status: 'deferred', retryAt }` e grava `cadenceWaitUntil`. Verificar com testes do dispatcher:
  - a negativa não faz claim nem soma `attempts`;
  - a concessão segue para o envio;
  - a linha oficial não consulta a cadência.
- [x] 4.2 Tratar `deferred` em `thinkzap-widget-outbound.worker.ts` e `thinkzap-widget-send.processor.ts` com `moveToDelayed(retryAt, token)` e `DelayedError`. Verificar com teste do worker no cenário "Espera não consome tentativas": três adiamentos seguidos de erro do provider ainda têm as 3 tentativas.
- [x] 4.3 Devolver a vaga de cadência nestes casos, mantê-la na falha indeterminada e fazer `ZREM` do ticket no `finally` em todo desfecho terminal:
  - falha respondida do provider;
  - recusa da cota diária depois da vaga concedida.

  Verificar com testes do dispatcher:
  - "Erro do provider não conta";
  - "Limite diário atingido durante a espera", que falha com `daily_limit_reached`;
  - o ticket sai do ZSET em SENT, FAILED, UNKNOWN e skipped.
- [x] 4.4 Teste de integração do dispatcher com Redis fake no cenário "Ritmo sem pausa" (50 mensagens, N = 20, D = 1, relógio controlado): 20 saem em cada janela, sem recusa, e na ordem de `queueSeq`.

## 5. API de estado da cadência e status da outbox

- [x] 5.1 Incluir o bloco `cadence` na resposta de `GET /lines/:itemId/settings`, via `get-line-settings.ts` e `line-settings.mapper.ts`, com estes campos:
  - `enabled` e a configuração gravada;
  - `available`;
  - `state`: `phase`, `count`, `max`, `windowEndsAt` e `pauseUntil`;
  - `waiting`;
  - `nextWindowChanges`.

  O bloco é omitido na linha oficial e vem `null` se o Redis falhar. Verificar com testes do mapper e do caso de uso nos cenários "Janela em andamento" e "Linha em pausa com fila".
- [x] 5.2 Criar `GET /api/thinkzap/messages/outbox-status?ids=`, restrito à instalação autenticada, que devolve `status` (`queued | waiting | sent | failed | unknown`) e `waitUntil` por `clientMessageId`. Verificar com testes do controller:
  - mapeamento de cada status;
  - `waiting` só quando `cadenceWaitUntil > now` e a linha está PENDING;
  - ids de outra instalação são ignorados.

## 6. Envio com anexo pelo widget via outbox

- [x] 6.1 Reescrever `send-widget-message.use-case.ts` (`/send-widget-multipart`) para enfileirar as partes (`origin = WIDGET_ATTACHMENT`, `kind = MEDIA`, mesmo `dispatchGroupId`) com as regras atuais de legenda e ordem, e responder 202 com os `clientMessageId`s. A pré-checagem do limite diário recusa o envio inteiro. Verificar com testes:
  - partes e legenda gravadas na ordem;
  - limite já atingido recusa sem enfileirar nada.
- [x] 6.2 Implementar no dispatcher o envio `kind = MEDIA` (Z-API por `mediaType`, com link obtido de `mediaSource` no envio) e o `afterDelivery` de WIDGET_ATTACHMENT, que publica um único comentário agregado na timeline com os anexos não enviados por limite diário. Verificar com testes nos cenários "Limite acaba no meio do envio com anexos" e "Texto com anexos conta cada parte", este último somando 3 na janela.

## 7. Robô "Enviar mensagem" via outbox

- [x] 7.1 Reescrever `bitrix-robot-webhook-handler.controller.ts` para:
  - resolver destinatários e arquivos;
  - descartar na hora os arquivos ilegíveis ou acima de 30 MB, registrando-os no grupo;
  - enfileirar as partes por destinatário (`origin = ROBOT_MESSAGE`, `mediaSource` com o id do arquivo no Bitrix);
  - responder ao Bitrix sem esperar os envios.

  Verificar com testes do controller:
  - partes por destinatário em ordem;
  - legenda no primeiro arquivo e texto separado quando o primeiro é áudio;
  - disparo sem conteúdo continua com o comentário atual.
- [x] 7.2 Implementar o `afterDelivery` agregado de ROBOT_MESSAGE: um comentário único quando todas as partes do grupo terminam, com os arquivos enviados, os não enviados com motivo e os destinatários não atendidos por limite diário. Verificar com testes nos cenários "Comentário depois da espera por cadência", "Robô 'Enviar mensagem' além do limite" e "Limite atingido no meio", este último de `robo-envio-arquivos`.

## 8. Resposta do operador via outbox e aviso de espera

- [x] 8.1 Em `bitrix-received-message.processor.ts`, trocar o envio direto (texto, mídia e botões) pela criação das partes na outbox (`origin = OPERATOR`, `clientMessageId = op:{bitrixMessageId}:{partIndex}`). O prefixo, a citação, a validação de botões e o guard de cópia espelhada continuam onde estão, e o job de inbound termina com sucesso. Verificar com testes do processor:
  - nenhum sender é chamado;
  - reprocessar o mesmo evento não duplica linhas;
  - a mensagem espelhada continua descartada.
- [x] 8.2 Implementar o `afterDelivery` de OPERATOR (persistência em `ThinkzapMessage` BITRIX e `setDelivered`) e os desfechos por origem: `daily-limit` chama `notifyOperatorDailyLimitReached` sem retentativa. Verificar com testes do dispatcher nos cenários "Operador responde com o limite atingido" e "Limite atingido enquanto a resposta do operador espera a cadência".
- [x] 8.3 Criar `domain/notices/cadence-notices.ts` com `operatorWaiting(retryAt)` em pt, en e es (HH:mm em `America/Sao_Paulo`) e registrá-lo no `CATALOGS` de `notices-catalog.test.ts`. Verificar com o teste de paridade e o cenário "Aviso de espera da cadência em inglês".
- [x] 8.4 Implementar o aviso de espera no `deferred` de OPERATOR: `SET NX` em `thinkzap:cadence-notice:{lineKey}:{bitrixChatId}:{waitKey}` e `postOpenChannelSystemNotice`; a falha ao postar só gera log `cadence_notify_failed`. Verificar com testes nos cenários "Operador responde durante a pausa" e "Várias respostas na mesma pausa" (um aviso só), e com a falha de postagem sem mudar o desfecho.

## 9. Fala do bot via outbox

- [x] 9.1 Fazer `HybridBotSessionAdapter.say` (e `comEntregaAoContato` em `bitrix-bot-event.processor.ts`) enfileirar a fala (`origin = BOT`) com o destino resolvido para o telefone do contato a partir do contexto. Não usar o `chatId` do Bitrix, e conferir o uso atual em `make-outbound-sender-resolver.ts:32`. Verificar com testes do adapter: a fala vira uma linha da outbox com o destino correto e `say` não chama o provider.
- [x] 9.2 Mover o eco no canal aberto para o `afterDelivery` de BOT e registrar no log a recusa por limite diário. Verificar com testes do dispatcher nos cenários "Bot espera a janela" e "Ordem por destinatário entre origens" (bot antes do operador para o mesmo contato).

## 10. Espelhamento conta na janela

- [x] 10.1 Depois do merge de `espelhar-mensagens-whatsapp-web`, chamar `cadence.registerExternal` em `mirror-z-api-sent-by-me-message.use-case.ts` uma vez por mensagem espelhada nova, depois da checagem de duplicidade e mesmo que a postagem falhe. Verificar com testes do use case nos cenários "Espelhada conta e dispara a pausa" e "Espelhada durante a pausa", e confirmar que edição, remoção e duplicata não contam.

## 11. Front: aba Limites de envio

- [x] 11.1 Em `conexoes/[subscriptionItemId]/configuracoes/page.tsx`, fazer o seguinte:
  - adicionar `limites` a `TabId`;
  - incluir a aba na ordem Conexão, Grupos, Ajustes, Limites de envio, Campanha de SMS, só na linha Z-API;
  - estender a guarda de alterações pendentes às duas abas.

  Verificar com teste de componente nos cenários de "Abas da configuração por tipo de linha" e "Trocar de aba com cadência pendente".
- [x] 11.2 Criar `limites-envio-tab.tsx` com o `LimiteDiarioCard` movido de `ajustes-tab.tsx`, sem mudar o comportamento, e a barra de salvamento própria com diff em `limites-alteracoes.ts`. Remover o card e os campos do limite da aba Ajustes. Verificar com testes de `limites-alteracoes.ts` e `ajustes-alteracoes.ts` nos cenários "Limite diário conta como alteração" e "Cadência e limite salvos juntos", e que Ajustes não conta mais o limite.
- [x] 11.3 Criar `cadenciador-card.tsx`, com:
  - os toggles e campos de N, D e P, com validação de valor inválido;
  - o estado atual (`phase`, contagem, horários e `waiting`);
  - o aviso de que as mudanças valem na próxima janela;
  - o estado de recurso indisponível quando `available = false`;
  - os campos desabilitados com a linha bloqueada.

  Atualizar os tipos em `use-line-api.ts`. Verificar com teste de componente nos cenários "Cadência inválida" e "Valor inválido impede salvar".
- [x] 11.4 Adicionar os textos da aba e dos cards em `front/messages/{pt,en,es}/thinkzap/configuracoes/` (`page.json` para o nome da aba e arquivo novo `limites.json`). Verificar que as três línguas têm as mesmas chaves.

## 12. Front: status de espera no widget

- [x] 12.1 Em `front/app/(widgets)/layouts/conversation-view.tsx`:
  - guardar os `clientMessageId`s enviados na sessão, inclusive os do multipart, agora assíncrono;
  - consultar `outbox-status` a cada 5 s enquanto algum id não estiver em estado final;
  - mostrar "aguardando janela de envio · sai às HH:mm", enviado ou falha, no lugar do texto fixo de fila.

  Incluir i18n pt, en e es. Verificar com teste de componente nos cenários "Mensagem do widget durante a pausa" e "Timeline não registra espera", e que a consulta para quando todos os ids estão em estado final.

## 13. Integração e rollout

- [x] 13.1 Ligar as origens síncronas ao caminho unificado só quando `isUnifiedOutboxEnabled(memberId)`, mantendo o código atual com a flag desligada. Verificar com testes de cada ponto de entrada (operador, bot, multipart e robô) nos dois estados da flag.
- [ ] 13.2 Validar em staging (`crmthinkers`) com a flag ligada:
  - linha com N = 5, D = 1 e P = 2, e um robô disparando 12 mensagens;
  - o operador responde durante a pausa e vê o aviso;
  - o widget mostra a espera;
  - uma mensagem é espelhada do celular;
  - p95 de evento → envio do operador sem cadência.

  Registrar os resultados nesta task.

  _Pendente: exige staging com Redis e banco reais (não disponíveis no ambiente de implementação). Validar também a migration e os scripts Lua, que aqui só foram verificados por `prisma migrate diff` e por parser de Lua._
- [ ] 13.3 Rodar `yarn test` na `api` e no `front` e `openspec validate cadenciador-mensagens-linha --strict`, todos sem falhas.

  _Estado atual: api 4097/4097 testes, lint e `tsc` limpos; `openspec validate --strict` ok. Front: `tsc` e lint limpos; 1 falha **anterior a esta change** em `bots/issue-text.test.ts` (catálogo de códigos do editor de fluxo, sem relação com a cadência)._

## 14. Lista das mensagens aguardando

- [x] 14.1 Criar `GET /api/thinkzap/lines/:itemId/cadence/queue` (`connectors:read`): os 50 primeiros tickets da fila da linha (ZSET, em ordem) cruzados com as rows da outbox, mais o total (`ZCARD`). Cada item traz posição, origem, destinatário, trecho do conteúdo, entrada na fila e `cadenceWaitUntil`. Linha oficial devolve lista vazia; ticket sem row é ignorado. Verificar com testes do caso de uso: ordem da fila, limite de 50 com `total`, trecho de mídia sem legenda e linha oficial.
- [x] 14.2 No card Cadenciador, mostrar a tabela das mensagens aguardando, com botão "Atualizar" que relê a lista e o estado. Ela é lida ao abrir a aba, some com a fila vazia e indica quantas ficaram além das 50. Incluir textos pt, en e es. Verificar com testes da lógica pura (rótulo de origem, trecho e "mais N") e com `tsc` e lint do front.

## 15. Ajustes do teste em staging

- [x] 15.1 Na lista das mensagens aguardando, trazer o nome do operador da resposta do operador (`operatorBitrixUserId` resolvido pelo mesmo adaptador do prefixo de nome, uma leitura por operador por chamada; falha cai só na origem) e mostrar "Operador · Nome". Verificar com teste do caso de uso (nome resolvido, falha sem nome, outras origens sem leitura) e com `tsc` e lint do front.
- [x] 15.2 Criar a opção `cadenceCountDeviceMessages` (default `false`) em `ConnectorSettings`, schema, cache, PATCH, mapper e no card Cadenciador. No espelhamento, só chamar `registerExternal` com a opção ligada; a opção vale a partir da próxima mensagem do aparelho. Verificar com testes do schema, do caso de uso de espelhamento (desligada não conta, ligada conta) e de `limites-alteracoes`.

## 16. Nome da aba e zerar uso de hoje

- [x] 16.1 Renomear a aba "Ajustes" para "Configurações" (pt), "Settings" (en) e "Configuración" (es), só no rótulo de `page.json`. O id da aba e os componentes ficam como estão. Verificar que as três línguas têm as mesmas chaves e com `tsc` do front.
- [x] 16.2 Criar `POST /api/thinkzap/lines/:itemId/daily-limit/reset` (`connectors:update`). Ele apaga a contagem e os extras do dia em `DailySendQuota.resetDay`, recusa linha oficial (`daily_limit_invalid`) e linha bloqueada, registra no log o que foi apagado e devolve o bloco `dailyLimit` atualizado. Verificar com testes do adapter (apaga só as chaves do dia), do caso de uso (zera com limite atingido, não muda a configuração, oficial recusada) e do controller.
- [x] 16.3 No card Limite diário, criar o botão "Zerar uso de hoje", com confirmação e atualização do uso exibido, fora da barra de salvamento e desabilitado com a linha bloqueada. Incluir textos pt, en e es. Verificar com `tsc`, lint e as mesmas chaves nas três línguas.

## 17. Paginação da lista das mensagens aguardando

- [x] 17.1 Na rota `GET /lines/:itemId/cadence/queue`, aceitar `offset` (default 0) e `limit` (default 10, máximo 50), ler só o trecho pedido da fila (`ZRANGE offset offset+limit-1`), devolver `offset` e `limit` junto com o total e numerar a posição na fila inteira. Verificar com testes do caso de uso (segunda página, posição absoluta, limite máximo) e do controller (parâmetros inválidos dão 400).
- [x] 17.2 Na tabela do card Cadenciador, paginar de 10 em 10, com "Anterior" e "Próxima" e o intervalo "11–20 de 23". "Atualizar" mantém a página e volta para a última que existe se a fila encolheu. Incluir textos pt, en e es. Verificar com testes da lógica pura (intervalo, última página, botões) e com `tsc` e lint do front.
