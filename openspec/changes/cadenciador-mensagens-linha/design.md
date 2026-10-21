# Design

## Context

A motivação está em proposal.md, seção Why. Os requisitos estão em `specs/thinkzap/cadencia-envio-mensagens/spec.md` e nos deltas de `configuracao-linha`, `limite-diario-mensagens`, `robo-envio-arquivos` e `idioma-avisos-servidor`.

O que existe hoje e molda a solução:

- **Fila de saída já existente (outbox).** Uma linha em `ThinkzapWidgetOutbox` (`core_thinkerszap_widget_outbox`) e um job `widget-send-<outboxId>` na fila `thinkzap-widget-outbound` (3 tentativas, worker com concorrência 5).
  - O dispatcher `dispatch-widget-outbox-message.ts` faz, nesta ordem:
    1. trava por destino (`destination-send-lock.ts`);
    2. `claimForSending`, que soma `attempts`;
    3. `sendWithinDailyQuota`;
    4. `markSent`;
    5. `afterDelivery`: persiste em `ThinkzapMessage`, cria o job de canal aberto e publica a timeline com guarda `timelineNotifiedAt`.
  - Quando o dispatcher devolve `locked`, o worker já adia o job sem gastar tentativa: `job.moveToDelayed(ts, token)` seguido de `throw new DelayedError()` (`thinkzap-widget-outbound.worker.ts:39-42`).
  - A outbox **não tem** coluna de origem nem tipo de mídia. Os tipos são TEXT, TEMPLATE e INTERACTIVE_BUTTON.
- **Origens síncronas de hoje** (todas na linha Z-API):
  - **Resposta do operador:** `workers/bitrix-received-message.processor.ts`. Laço por parte, com prefixo do nome do operador, citação de resposta, `sendWithinDailyQuota`, `persistOutboundMessage` e `setDelivered` (`imconnector.send.status.delivery`). Uma falha genérica relança o evento inteiro, mesmo com partes já enviadas.
  - **Fala do bot:** `workers/bitrix-bot-event.processor.ts` com `HybridBotSessionAdapter.say`. Envia ao contato e depois ecoa no canal aberto. Não persiste.
  - **Envio com anexo pelo widget:** `send-widget-message.use-case.ts` (`/send-widget-multipart`), uma chamada `ZApiClient` por parte.
  - **Robô "Enviar mensagem":** `bitrix-robot-webhook-handler.controller.ts`, laço por destinatário e por parte, com download do arquivo do Bitrix e comentário da timeline no fim.
- **Cota diária:** `redis-daily-send-quota.ts`, com reserva atômica por Lua e `lineKey = zApiInstanceId`, que já chega a todos os caminhos.
- **Settings da linha:** `ConnectorSettings` (zod não estrito, com `.catch` por campo) gravado no campo `ufCrm93Settings` do item da SPA 1146. O PATCH é validado por `assertDailyLimitPatch`, e o GET de settings embute o bloco `dailyLimit`.
- **Widget:** não mostra status de mensagem. Mostra só um texto fixo de "na fila". Não há endpoint de status da outbox nem socket de mensagens.
- **Espelhamento:** `mirror-z-api-sent-by-me-message.use-case.ts` (change ativo `espelhar-mensagens-whatsapp-web`) não toca a cota diária.
- **Avisos ao operador:** `postOpenChannelSystemNotice` (bot e fallback `im.message.add`), com catálogos `xxxNotices(locale)` e o teste de paridade `notices-catalog.test.ts`.

## Goals / Non-Goals

**Goals:**
- Um único caminho de envio por linha Z-API, a outbox. A cadência, a cota diária e a ordem ficam num ponto só, o dispatcher.
- Decisão de vaga atômica por linha, válida com vários workers e vários processos.
- FIFO estrito por linha, sem prioridade entre origens.
- A espera não consome tentativas e não tem prazo máximo.
- Rollout gradual do caminho unificado, com volta rápida ao caminho síncrono.

**Non-Goals:**
- Cadência na linha oficial. A `policy` devolve `null` fora de Z-API, como já acontece na cota diária.
- Fazer a mensagem espelhada contar no limite diário. O comportamento atual do limite diário não muda.
- Corrigir o possível uso de `event.chatId` (chat do Bitrix) como telefone no sender do bot (`make-outbound-sender-resolver.ts:32`). Isso deve ser verificado à parte, mas a migração do bot para a outbox precisa resolver o destino corretamente (tarefa 9.1).
- Histórico de janelas e métricas de volume por janela.

## Decisions

### 1. Configuração no `ConnectorSettings`
- **Decisão:**
  - Campos novos:
    - `cadenceEnabled` (default `false`);
    - `cadenceMaxMessages`, `cadenceWindowMinutes`, `cadencePauseMinutes` (`number | null`);
    - `cadencePauseEnabled` (default `false`).

    Cada campo tem `.catch` próprio no schema. O schema do cache do item exige os campos, então uma entrada antiga vira miss.
  - O controller de PATCH aceita os campos no zod estrito.
  - `assertCadencePatch` valida o resultado do merge antes de qualquer escrita e recusa com `thinkzap.line.cadence_invalid` nestes casos:
    - linha que não é Z-API;
    - N ou D sem inteiro maior ou igual a 1 com a cadência ligada;
    - P sem inteiro maior ou igual a 1 com a pausa ligada.
- **Por quê:** é o mesmo lugar, a mesma permissão (`connectors:update`) e a mesma leitura por cache do limite diário.
- **Alternativa descartada:** tabela no MySQL. Seria uma segunda fonte de configuração da linha.

### 2. Estado da cadência em Redis com snapshot da janela
- **Decisão:**
  - Um hash por linha, `thinkzap:cadence:{lineKey}`, com os campos:
    - `windowId` (o início em ms), `windowEnd`, `count`, `pauseUntil`;
    - o snapshot `snapN`, `snapD`, `snapP` e `snapPauseEnabled` da configuração com que a janela abriu.
  - TTL: `max(windowEnd, pauseUntil) − now` mais uma margem.
  - A porta `SendCadence` tem três operações:
    - `reserve(lineKey, cfg, now, ticket)` → `{ allowed: true, windowId } | { allowed: false, retryAt, reason: 'window-full' | 'paused' | 'not-head' }`;
    - `release(lineKey, windowId)` → DECR de `count` só se a janela ainda for a mesma;
    - `registerExternal(lineKey, cfg, now)` → usada pelo espelhamento, nunca nega;
    - mais `state(lineKey)`, para a tela.
  - O script Lua de `reserve`:
    1. Se `pauseUntil > now`, nega com `retryAt = pauseUntil`.
    2. Se há janela aberta (`now < windowEnd`) e `count < snapN`, faz INCR. Se `count == snapN` e `snapPauseEnabled`, grava `pauseUntil = now + snapP` e fecha a janela (`windowEnd = now`), porque a pausa substitui o restante. Aceita.
    3. Se a janela aberta está cheia, nega com `retryAt = windowEnd`.
    4. Sem janela aberta e com `cfg.enabled = false`, apaga o estado e aceita sem contar.
    5. Sem janela aberta e com a cadência ligada, abre a janela com o snapshot de `cfg` atual, `count = 1`, e aplica a regra de pausa do passo 2 quando N = 1. Aceita.
  - `registerExternal` segue os mesmos passos, mas nos casos de negar (pausa ou janela cheia) não faz nada e devolve sucesso.
- **Por quê:**
  - **O snapshot resolve "mudança só vale na próxima janela" sem estado extra.** `cfg` é lido a cada job (`get-line-settings`), mas só é usado quando uma janela nova abre. Desativar no meio cai no mesmo caminho: a janela ou pausa vigente segue o snapshot, e no fim o passo 4 libera.
  - **Janela ancorada no primeiro envio**, como o spec exige.
- **Alternativas descartadas:**
  - `limiter` do BullMQ: vale para a fila inteira, não por linha, e não tem pausa nem âncora no primeiro envio.
  - Janela deslizante (ZSET de timestamps): não reproduz a regra de pausa nem a âncora.

### 3. Ordem FIFO por linha com sequenciador em Redis
- **Decisão:**
  - Ao enfileirar, cada linha da outbox de uma linha Z-API recebe um número de sequência (`INCR thinkzap:cadence-seq:{lineKey}`, gravado em `queueSeq`). Ela também entra no ZSET `thinkzap:cadence-queue:{lineKey}` com esse score.
  - O `reserve` só aceita o **ticket da cabeça** do ZSET (`ZRANGE 0 0`). Um job que não é a cabeça recebe `not-head`, com `retryAt = now + 500ms + jitter`, ou com o `retryAt` da janela quando a janela está cheia ou em pausa.
  - Quando o dispatcher chega a um desfecho terminal (SENT, FAILED, UNKNOWN ou skipped), faz `ZREM` no `finally`. A remoção também acontece quando a vaga é concedida, para a cabeça seguinte poder pedir a vaga sem esperar o envio terminar. A ordem por destinatário continua garantida pela trava por destino.
  - **Varredura** por cron (node-cron, a cada minuto): remove do ZSET os ids cuja linha da outbox não existe ou já está em estado terminal. Isso evita que uma cabeça órfã bloqueie a linha.
  - A cabeça travada pela trava de destino espera, e a fila espera com ela. Esse é o FIFO estrito pedido.
- **Por quê:** com concorrência 5 e reagendamentos independentes, os jobs do BullMQ não preservam a ordem na abertura da janela. O ZSET dá uma ordem única por linha, que vale para todas as origens.
- **Alternativas descartadas:**
  - Concorrência 1 no worker: serializaria todas as linhas de todos os clientes.
  - Fila BullMQ por linha: centenas de filas dinâmicas e workers.
  - BullMQ Pro Groups: dependência paga.

### 4. Integração no dispatcher e no worker
- **Decisão:**
  - O dispatcher ganha o passo `cadence.reserve` **depois** da trava por destino e **antes** de `claimForSending`. Quando a vaga é negada:
    - devolve `{ status: 'deferred', retryAt, reason }`;
    - grava `cadenceWaitUntil` na linha da outbox, para o widget;
    - nas mensagens de operador, dispara o aviso de espera (decisão 8).

    O worker trata `deferred` como trata `locked`: `moveToDelayed(retryAt, token)` e `DelayedError`. Nada de `attempts` é gasto, porque o `claim` não acontece.
  - **Ordem dos portões:** a cadência vem antes da cota diária. A cota é reservada dentro do `send`, como hoje. Se a cota recusa depois da vaga de cadência concedida, a vaga é devolvida (`release`).
  - A falha respondida pelo provider devolve as duas vagas. A falha indeterminada mantém as duas, na mesma regra da cota diária.
  - **Retentativa:** a vaga é por linha da outbox. Uma nova tentativa da mesma linha depois de uma falha respondida pede vaga de novo, porque a anterior foi devolvida, e não conta duas vezes.
  - **Linha sem condição de envio** (sem `line`, linha bloqueada): segue o `markFailed` atual. O `finally` tira a linha do ZSET.
- **Por quê:** reaproveita o padrão de adiamento já usado sem gastar tentativas. Um único ponto de decisão vale para todas as origens.

### 5. Outbox com origem, mídia e grupo de envio
- **Decisão:** uma migration em `core_thinkerszap_widget_outbox` adiciona:
  - `origin` (enum `ThinkzapOutboxOrigin`: `WIDGET`, `WIDGET_ATTACHMENT`, `ROBOT_MESSAGE`, `ROBOT_BUTTONS`, `ROBOT_TEMPLATE`, `SMS_CAMPAIGN`, `OPERATOR`, `BOT`), com default `WIDGET` para as linhas existentes;
  - `kind` ganha `MEDIA`, com `mediaType` (image, video, audio, document), `mediaSource` (Json: referência para obter o arquivo no envio, ver decisão 6), `fileName` e `caption`;
  - `dispatchGroupId` e `partIndex`, para agrupar as partes de um envio com anexo ou de um disparo de robô;
  - o contexto do canal aberto: `bitrixMessageId`, `bitrixChatId`, `connectorChatId` e `referencedMessageId`;
  - `queueSeq` e `cadenceWaitUntil`;
  - índices `(dispatchGroupId)` e `(instanceId, status)`, este último para a contagem de mensagens aguardando.
- O `afterDelivery` passa a escolher a estratégia pela `origin`:
  - **WIDGET, ROBOT_BUTTONS, ROBOT_TEMPLATE e SMS_CAMPAIGN:** como hoje.
  - **OPERATOR:** persiste em `ThinkzapMessage` (BITRIX, com `bitrixMessageId`) e chama `setDelivered`. Não publica na timeline.
  - **BOT:** faz o eco no canal aberto, como o `HybridBotSessionAdapter` faz hoje. Não persiste.
  - **WIDGET_ATTACHMENT e ROBOT_MESSAGE:** marca a parte. Quando **todas** as partes do `dispatchGroupId` estão em estado terminal, publica **um** comentário agregado na timeline. A guarda é um `UPDATE ... WHERE timelineNotifiedAt IS NULL` na primeira linha do grupo, para o comentário não sair duas vezes.
- **Idempotência:** `clientMessageId` é determinístico por origem, por exemplo `op:{bitrixMessageId}:{partIndex}` e `robot:{workflowId}:{destination}:{partIndex}`. O unique `(instanceId, clientMessageId)` faz o reprocessamento de um evento não duplicar mensagens.
- **Por quê:** estender a outbox reaproveita o claim, o retry, o UNKNOWN e o notify, que já estão testados.
- **Alternativa descartada:** uma outbox nova só para operador e bot. Duplicaria o ciclo de envio e o sequenciador teria de juntar duas tabelas.

### 6. Origens migradas para a outbox
- **Operador** (`bitrix-received-message.processor.ts`):
  - O processor continua resolvendo, na hora do evento, o contexto, o OAuth, a citação (`referencedMessageId`), o prefixo do operador e a validação de botões.
  - Em vez de enviar, cria uma linha da outbox por parte (`origin = OPERATOR`) e enfileira. O job de inbound termina com sucesso quando as linhas estão persistidas.
  - A recusa por limite diário e o aviso de janela de 24h saem do processor e vão para o dispatcher, por origem: `notifyOperatorDailyLimitReached` é chamado no desfecho `daily-limit` de OPERATOR.
  - O guard de cópia espelhada (`findMirroredCopy`) continua antes do enfileiramento.
- **Bot:** `HybridBotSessionAdapter.say` passa a enfileirar a fala (`origin = BOT`, destino = telefone do contato, resolvido do contexto) e retorna sem esperar o envio. O eco no canal aberto vai para o `afterDelivery`. Assim o histórico só mostra falas que de fato saíram. O lock de chat do bot continua valendo para o turno.
- **Envio com anexo pelo widget:** `/send-widget-multipart` valida e enfileira as partes com o mesmo `dispatchGroupId` e responde 202 com os `clientMessageId`s. Continuam valendo:
  - a pré-checagem do limite diário (`assertDailyLimitNotReached`), que recusa o envio inteiro;
  - as regras de legenda e de ordem das partes.
- **Robô "Enviar mensagem":** o controller resolve destinatários e arquivos e já descarta, na hora, os arquivos ilegíveis ou acima de 30 MB, que vão para a lista de não enviados do grupo. Depois enfileira as partes por destinatário com o mesmo `dispatchGroupId` e responde ao Bitrix. A resposta deixa de trazer `refusedByDailyLimit`, que passa a constar só na timeline.
- **Arquivos (`mediaSource`):** guarda a referência estável do arquivo, e não a URL de download temporária:
  - id do arquivo no Bitrix e o documento de origem, no robô;
  - id do arquivo do disco e do chat, no operador;
  - URL hospedada, no upload do widget.

  O worker obtém um link novo no envio. Isso importa porque a espera não tem prazo.
- **Rollout:** a flag `THINKZAP_UNIFIED_OUTBOX_DOMAINS` (lista de `memberId` ou `*`) liga o caminho unificado por instalação.
  - Com a flag desligada, as origens síncronas usam o código atual, e a cadência só fica disponível para a instalação quando a flag estiver ligada.
  - O card Cadenciador mostra que o recurso não está disponível, e o PATCH recusa ativar a cadência com `cadence_unavailable`.
  - O código síncrono antigo fica até a flag virar `*` em produção.

### 7. Espelhamento conta na janela
- **Decisão:** `mirror-z-api-sent-by-me-message.use-case.ts` chama `cadence.registerExternal` uma vez por mensagem espelhada nova, depois da checagem de duplicidade (`findByProviderMessageId`). A chamada acontece mesmo que a postagem no canal aberto falhe, porque a mensagem já saiu do aparelho. Edição e remoção não contam.
- **Por quê:** `registerExternal` nunca nega e nunca estende a pausa, como o spec exige.
- **Dependência:** o change `espelhar-mensagens-whatsapp-web` precisa estar mergeado. Esta tarefa entra depois dele.

### 8. Avisos de espera
- **Operador:** no `deferred` de OPERATOR, o dispatcher faz `SET NX thinkzap:cadence-notice:{lineKey}:{bitrixChatId}:{waitKey}`, em que `waitKey` é o `windowId` da janela cheia ou o `pauseUntil` da pausa. A chave expira depois do `retryAt`.
  - Se o SET passou, posta `cadenceNotices(locale).operatorWaiting(retryAt)` por `postOpenChannelSystemNotice`.
  - Uma falha ao postar é só logada (`thinkzap.line.cadence_notify_failed`) e não muda o desfecho.
  - O horário sai no fuso `America/Sao_Paulo`, no formato HH:mm.
- **Widget:**
  - Endpoint novo `GET /api/thinkzap/messages/outbox-status?ids=...`, que recebe `clientMessageId`s da mesma linha e da instalação autenticada.
  - Devolve `status` (`queued | waiting | sent | failed | unknown`) e `waitUntil`. O status `waiting` vale quando `cadenceWaitUntil > now` e a linha ainda está PENDING.
  - O widget guarda os ids que enviou na sessão e consulta o endpoint a cada 5 segundos enquanto algum não estiver em estado final. Mostra "aguardando janela de envio · sai às HH:mm" e troca o texto fixo de "na fila" pelo status real.
- **Por quê:** a consulta periódica é simples e limitada às mensagens da própria sessão. Socket de mensagens seria infraestrutura nova para um ganho pequeno.

### 9. API de estado e tela
- **Decisão:**
  - O GET de settings da linha Z-API passa a trazer o bloco `cadence`:
    - `enabled` e a configuração gravada;
    - `available`, conforme a flag;
    - `state`: `phase` (`idle | window | paused`), `count`, `max`, `windowEndsAt` e `pauseUntil`;
    - `waiting`, a contagem de linhas PENDING da outbox da instância;
    - `nextWindowChanges`, verdadeiro quando o snapshot difere da configuração gravada.

    O bloco vem `null` se o Redis falhar (`thinkzap.line.cadence_state_read_failed`).
  - Front:
    - `TabId` ganha `limites`;
    - novo `limites-envio-tab.tsx`, com `LimiteDiarioCard` movido de `ajustes-tab.tsx` e o novo `cadenciador-card.tsx`;
    - barra de salvamento própria, com diff em `limites-alteracoes.ts`;
    - a guarda de alterações pendentes da página passa a considerar as duas abas.
- **Por quê:** mantém o padrão do limite diário: a regra fica no back e o front só exibe.

### 10. Erros catalogados
Cada código tem guia em `mcp/kb/runbooks/hubcore/thinkzap/line/`, como o teste do catálogo exige.

| Código | Tipo | HTTP | Quando |
|---|---|---|---|
| `thinkzap.line.cadence_invalid` | `validation` | 400 | Configuração de cadência inválida |
| `thinkzap.line.cadence_unavailable` | `validation` | 409 | Cadência sem a flag ligada |
| `thinkzap.line.cadence_state_read_failed` | | | Falha ao ler o estado da cadência |
| `thinkzap.line.cadence_notify_failed` | | | Falha ao avisar o operador |
| `thinkzap.outbox.sequencer_stale_removed` | log de varredura | | Cabeça órfã removida do sequenciador |

## Risks / Trade-offs

- **[Cabeça órfã trava a linha inteira (FIFO estrito)]** → `ZREM` no `finally`, varredura a cada minuto e log do código. No pior caso a linha atrasa até 1 minuto.
- **[Atraso perceptível na resposta do operador mesmo sem cadência]** → É um salto a mais pelo Redis e pelo BullMQ. Medir p95 de "evento recebido → enviado" por origem antes de ampliar a flag. Rollback pela flag.
- **[Perda ou flush do Redis zera a janela e o sequenciador]** → A linha pode mandar até N a mais. Jobs sem entrada no ZSET se reinserem com o `queueSeq` gravado na linha da outbox (o reserve faz `ZADD NX` do próprio ticket antes de checar a cabeça).
- **[Espera longa com links de arquivo]** → A decisão 6 guarda a referência estável e obtém um link novo no envio. Se o arquivo foi apagado no Bitrix, a parte falha com o motivo na timeline.
- **[Robô "Enviar mensagem" deixa de devolver `refusedByDailyLimit` ao Bitrix]** → Quebra quem lia esse retorno no fluxo. Documentar na nota de versão. A informação continua na timeline.
- **[Bot assíncrono]** → A fala pode sair depois de o fluxo do bot avançar. O FIFO por linha mantém a ordem para o contato, e o eco no canal aberto só acontece no envio.
- **[Varredura de polling no widget]** → Limitada aos ids da sessão e parada quando todos chegam ao estado final.

## Migration Plan

1. Deploy da migration (colunas nullable, `origin` com default `WIDGET`) e da cadência no dispatcher. As origens que já usam a outbox ganham cadência e FIFO de imediato, mas a cadência só é ativável com a flag.
2. Deploy das origens migradas atrás de `THINKZAP_UNIFIED_OUTBOX_DOMAINS`. Ligar primeiro em staging (`crmthinkers`), depois em algumas instalações, depois `*`.
3. Depois de um ciclo estável com `*`, remover o caminho síncrono antigo num change de limpeza.
4. **Rollback:** tirar a instalação da flag. As mensagens já enfileiradas continuam sendo enviadas pelo dispatcher. A migration é aditiva e não precisa ser revertida.

## Open Questions

- Intervalo exato da consulta do widget (5 s proposto) e da varredura (60 s). Não muda o comportamento especificado.

## Ajustes feitos na implementação

Divergências deste design, decididas durante a implementação:

- **Anexos em bucket R2 privado (decisão 6).** Os arquivos dos anexos do widget, do robô "Enviar mensagem" e da resposta do operador vão para um bucket R2 **próprio e sem domínio público** (`R2_OUTBOUND_MEDIA_BUCKET`), com regra de ciclo de vida de 30 dias. No R2 o acesso público vale para o bucket inteiro, então um prefixo no bucket das imagens de cabeçalho deixaria o anexo legível por URL.
  - O worker lê o arquivo na hora do envio e o entrega à Z-API como data URL. Depois do desfecho, o arquivo é apagado; no grupo, só quando todas as partes terminam.
  - O arquivo do robô é guardado uma vez e compartilhado por todos os destinatários. O do operador é baixado do Bitrix ao enfileirar.
  - Sem o bucket configurado, o envio com anexo e o robô continuam no caminho síncrono, mesmo com a flag. O operador cai para o link do Bitrix.
- **Contexto do canal aberto em JSON (decisão 5).** No lugar das colunas `connectorChatId` e `referencedMessageId`, a outbox ganhou `originContext` (JSON), com o que cada origem precisa na entrega, e `dispatchMeta` (JSON), com os dados do grupo para a timeline. `bitrixMessageId` e `bitrixChatId` continuam como colunas.
- **Mensagens aguardando (decisão 9).** A contagem vem do tamanho da fila da linha no Redis (`ZCARD`), e não do banco: a outbox guarda o `Instance.id`, e a tela tem o id da Z-API. O índice `(instanceId, status)` saiu da migration.
- **Destino da fala do bot.** A fala ia para o chat do Bitrix como se fosse telefone. Agora usa `connectorChatIdFromDialog` (o `entity_id` do diálogo) nos dois caminhos, com a flag ligada ou desligada.
- **Status no widget.** O widget não tem i18n por desenho, então os textos de espera saem só em português, como o resto da tela.
- **Testes de front.** O front não tem infraestrutura de teste de componente (vitest em ambiente node, só `.test.ts`). As abas foram verificadas por tipos, lint e testes da lógica pura (`limites-alteracoes`, `outbox-status.client`).
- **Mensagens espelhadas contam mesmo sem cópia no canal aberto.** O envio saiu do aparelho de qualquer jeito, então é volume real da linha.
- **Cabeça viva sem job (correção vinda do teste em staging).** Uma row PENDING na cabeça da fila sem job no BullMQ (job esgotado por erro antes do envio, ou enfileiramento que falhou) não seria acordada por ninguém e travaria a linha. Ela também não era órfã para a varredura. A varredura agora recria o job dessa cabeça quando ela aparece em duas rodadas seguidas (`WidgetSendScheduler.ensureScheduled`, código `thinkzap.outbox.sequencer_head_rescheduled`) e roda no processo do worker de envio, para existir sempre que houver quem consuma a fila.
