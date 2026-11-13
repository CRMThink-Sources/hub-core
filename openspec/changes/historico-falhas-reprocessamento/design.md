# Design

## Context

Motivação em `proposal.md`; requisitos nas specs desta change. Estado atual relevante:

- **Saída.** O envio passa pela fila `thinkzap-widget-outbound` (4 tentativas, backoff de 10 s) e a falha final é gravada no próprio outbox (`ThinkzapWidgetOutbox`: `status`, `attempts`, `lastError`), dentro de `dispatch-widget-outbox-message.ts`. A tela `/admin/falhas-envio` e o reprocesso (`ReprocessOutboxFailures`, lote máximo de 50, confirmação de duplicidade para `UNKNOWN`) já existem. Cobrem todas as origens de envio (widget, robôs, SMS, operador, bot).
- **Entrada.** Os eventos recebidos (Z-API, HubMessage, status do HubMessage, Bitrix, bot do Bitrix) passam pela fila `thinkzap-inbound` (3 tentativas, backoff de 1 s, falhos mantidos 7 dias no Redis). O `worker.on('failed')` só loga: não distingue falha final e não persiste nada. O job traz `source`, `type`, `traceKey` e `body`, mas não traz `instanceId`/portal.
- **Agendamento.** O projeto não usa job repetível do BullMQ para rotinas de manutenção: usa `node-cron` com lock em Redis e dependências injetáveis (`shared/infra/scheduler/stripe-sync.job.ts`, que já faz limpeza por retenção). Detalhe: o job de cadência roda no processo do worker de saída; os demais rodam no `app.ts`.
- **Erros.** `jobFailureLogFields` produz `errorCode` (`UNCLASSIFIED` quando não classificado). Código novo exige entrada em `modules/thinkzap/errors/catalog.ts` e runbook em `mcp/kb/` (teste de cruzamento catálogo × runbooks; exige redeploy do MCP).

## Goals / Non-Goals

**Goals:**
- Gravar só falhas, com custo zero no caminho de sucesso.
- Reaproveitar a tela, a rota e o reprocesso de saída existentes; o recebimento segue o mesmo desenho.
- Nunca derrubar envio ou recebimento por causa do registro.

**Non-Goals:**
- Não mudar tentativas, backoff, cadência, limite diário nem a idempotência do envio.
- Não criar histórico de mensagens bem-sucedidas.
- Não reprocessar recebimento de origem cuja reentrega não tenha sido verificada como idempotente.
- Não arquivar nem exportar falhas expurgadas.

## Decisions

### 1. Duas tabelas novas, sem alterar a outbox

- `ThinkzapInboundFailure`: `id`, `jobId`, `source`, `type`, `traceKey`, `instanceId?`, `domainId?`, `domainName?`, `errorCode`, `errorMessage`, `attempts`, `payload` (JSON), `status` (`FAILED` | `REPROCESSED`), `reprocessCount`, `lastReprocessedAt/By`, `previousFailureId?`, `createdAt`. Índices: `[createdAt]`, `[domainId, createdAt]`, `[source, createdAt]`, `[jobId]`.
- `ThinkzapDeliveryAttempt`: `id`, `refKind` (`OUTBOX` | `INBOUND`), `refId`, `attempt`, `errorCode`, `message`, `indeterminate` (bool), `durationMs`, `createdAt`. Índices: `[refKind, refId]` e `[createdAt]`.

`refId` é o id do outbox (saída) e o `jobId` do BullMQ (entrada), **sem chave estrangeira**. Para o recebimento, a tentativa nasce antes da linha de falha, que só existe na tentativa final; amarrar por `jobId` evita criar a falha cedo demais. A consequência é que o expurgo precisa apagar as tentativas por `createdAt`, e não por cascata.

*Alternativas descartadas:* (a) colunas novas na outbox, que só guardariam a última tentativa e engordariam uma tabela grande; (b) uma tabela de tentativas por direção, que duplicaria repositório, expurgo e consulta sem ganho.

### 2. Captura da falha final do recebimento

No `worker.on('failed')` de `thinkzap-inbound.worker.ts`, a falha é final quando `job.attemptsMade >= job.opts.attempts` ou quando o erro é `UnrecoverableError`. Só nesse caso a linha de `ThinkzapInboundFailure` é criada. A tentativa que falha (final ou não) grava sempre o seu registro de tentativa. O tempo de cada tentativa é medido em volta do despacho, e não por `processedOn`, que marca só a primeira.

A gravação é envolvida em `try/catch` com log; nunca relança. O `instanceId`/`domainId` é extraído do `body` por origem, por uma função pura por `source`, que devolve `undefined` quando não conseguir. A extração por origem é a primeira tarefa da implementação (não foi mapeada).

### 3. Captura da tentativa de envio

O registro é gravado nos pontos de falha do `dispatch-widget-outbox-message.ts` (falha do provider, indeterminada, limite diário, template/botão incompleto, linha indisponível), ao lado do `markFailed`/`markUnknown`/`releaseToPending` que já existem, via uma porta `DeliveryAttemptRecorder` injetada. O caso de uso não importa infra. Um recorder que nunca lança é a única implementação usada no worker; o teste usa um mock tipado. Adiamento por `DelayedError` não passa por esses pontos e portanto não grava, como exige a spec.

O número da tentativa é `max(attempt) + 1` do item, para o reprocessamento continuar a numeração (`attempts` da outbox pode ser zerado ou reaproveitado no reprocesso e não é fonte confiável).

### 4. Reprocessar recebimento

Um `updateMany` atômico muda `FAILED` → `REPROCESSED` (e incrementa `reprocessCount`, grava quem e quando); só se `count === 1` o evento é recolocado em `thinkzap-inbound` com `jobId` novo (`reprocess-<failureId>-<n>`), para não colidir com o `jobId` do job falho que ainda está no Redis. Se o `add` falhar, a falha volta para `FAILED` (compensação) e a tela mostra "não foi possível agendar", espelhando o comportamento `schedule-failed` da saída. Falha do reprocessado gera nova linha com `previousFailureId`.

Reprocessável é uma lista de origens no código (`REPROCESSABLE_INBOUND_SOURCES`), que **começa vazia** e só ganha uma origem depois de a tarefa de verificação provar que o processor dela é idempotente na reentrega (`uq_msg_instance_provider`, `uq_msg_instance_bitrix` e equivalentes). *Alternativa descartada:* liberar tudo e confirmar com o operador, porque no recebimento o risco não é visível ao suporte (efeito colateral no CRM, não mensagem repetida).

### 5. Expurgo: `node-cron` + lock, em lotes

Segue `stripe-sync.job.ts`: `schedule`, `lock`, `cleanup` e `clock` injetáveis, `enabled` por env. Roda uma vez por dia de madrugada, no `app.ts`. Cada tabela é apagada em lotes (seleciona até N ids vencidos e apaga por `id IN`, repetindo até acabar ou até um teto de lotes por rodada), porque o `deleteMany` do Prisma não aceita `LIMIT`. A limpeza da outbox filtra `status IN (FAILED, UNKNOWN)` e `createdAt < corte`; nunca toca nas demais. Antes da implementação, checar se algo referencia o id da outbox (FK ou cascata) para garantir que o delete não derruba linhas de outras tabelas.

*Alternativa descartada:* job repetível do BullMQ, citado na conversa inicial. Exigiria worker e serviço de compose novos, e o projeto já tem o padrão `node-cron` + lock para exatamente este caso.

### 6. Configuração

`FAILURE_RETENTION_DAYS` (inteiro ≥ 1, padrão 7; inválido derruba a subida) e `FAILURE_PURGE_ENABLED` (padrão `false`, ligado explicitamente no `.env` do servidor, já que os compose usam `env_file`, e em um ambiente só quando staging e produção dividem o banco: ver `DEPLOY.md`). Ambos em `config/env.ts` e `api/.env.example`, com comentário. O teto do período da lista (hoje `MAX_FAILURE_RANGE_DAYS = 90`) passa a ser o prazo de retenção, e o padrão também. O desligado por padrão protege ambientes locais que apontem para um banco compartilhado.

### 7. Visão por cliente

Um filtro `domainId` exato é acrescentado às duas listas (saída e entrada); o filtro `domain` por trecho do nome continua para a tela geral. A seção na página do cliente reaproveita o cliente HTTP de `front/lib/outbox-failures.ts` (estendido) e o componente de status. Reprocesso e confirmação de duplicidade são os mesmos da tela geral, extraídos para um componente compartilhado em vez de copiados.

### 8. Front

A tela de falhas ganha abas (componente `tabs` já existe em `components/ui`): "Envio" (comportamento atual, intacto) e "Recebimento". O detalhe de envio e o de recebimento mostram a lista de tentativas. O detalhe de recebimento exibe uma lista fixa de campos seguros do `payload`, nunca o JSON inteiro.

### 9. Código de erro novo

`thinkzap.inbound.event_failed` (falha final de recebimento), logado na captura, com runbook em `mcp/kb/runbooks/hubcore/thinkzap/inbound/`. O `errorCode` gravado em cada tentativa é o que `jobFailureLogFields` já devolve; o catálogo não cresce por tentativa.

## Risks / Trade-offs

- **Payload com dado pessoal no banco** → guarda só em falha final, expurgo em 7 dias, detalhe com lista de campos seguros, e nunca vai para log.
- **Gravar tentativa sobrecarrega o banco numa instabilidade em massa** (ex.: Bitrix fora do ar gera falha em centenas de jobs) → gravação best-effort, uma linha enxuta por tentativa, sem leitura no caminho quente; se o banco estiver lento o `catch` descarta o registro.
- **Apagar linhas da outbox em `FAILED`/`UNKNOWN`** é a única operação destrutiva sobre dado existente → só esses dois status, só após o prazo, lote limitado, job desligado por padrão e ligado primeiro em staging. Reenvio com o mesmo `clientMessageId` depois de 7 dias deixa de ser reconhecido como o mesmo envio; aceito, por ser fora do uso real.
- **`refId` sem chave estrangeira** → tentativas órfãs possíveis; o expurgo por `createdAt` as remove no mesmo prazo.
- **Lista de origens reprocessáveis vazia no início** → a aba mostra a falha mas o botão fica indisponível para elas até a verificação de idempotência; a entrega em duas etapas é aceita para não arriscar efeito duplicado no CRM.
- **Reprocesso na fila errada:** o `thinkzapInboundQueue.add` do reprocesso usa o `QUEUE_PREFIX` do ambiente; staging que divide Redis/DB sem prefixo próprio poderia reenfileirar na fila de produção → mesma regra do `CLAUDE.md`; revisar com o `auditor-ambientes`.

- **Tentativas de envio expurgam pela própria data**, não pela da outbox: uma mensagem criada há 10 dias, reprocessada e que falhou de novo há 1 dia fica visível, mas as tentativas antigas dela (com mais de 7 dias) já saíram, e o detalhe mostra só as novas. Aceito: o histórico é de 7 dias por tentativa, e a numeração continua pelo `max + 1` das que restam.
- **Janela residual do reprocesso do HubMessage:** a guarda por `_id` roda antes de entregar ao canal aberto e o espelho só é gravado depois. Se o processamento falhar depois de o Bitrix aceitar e antes de gravar (ex.: erro na leitura do id da mensagem), reprocessar entregaria de novo. É o mesmo risco que as retentativas automáticas da fila já têm hoje, então o reprocesso não cria uma classe nova de risco; o detalhe da falha mostra o erro de cada tentativa para o suporte conferir o canal aberto antes de reprocessar.
- **`refId` de recebimento é o `jobId` do BullMQ**, que se repete se o Redis for zerado: tentativas antigas se misturariam com as novas por até 7 dias. Aceito, por ser raro e de efeito só visual.

## Migration Plan

1. Migration aditiva (duas tabelas, índices); nenhuma migration existente é alterada. O CI aplica com `prisma migrate deploy`.
2. Deploy da API/workers com `FAILURE_PURGE_ENABLED=false`: as falhas e tentativas passam a ser gravadas, nada é apagado.
3. Em staging, ligar o expurgo, conferir os logs de quantidade apagada e a tela; só depois ligar em produção.
4. Rollback: desligar a flag do expurgo e reverter a imagem. As tabelas novas ficam sem uso e podem permanecer; não há mudança destrutiva a desfazer além das linhas já expurgadas.

## Levantamento (grupo 1 das tarefas)

**Onde está o portal/instância no `body`, por origem** (tarefa 1.1). Só o Bitrix traz o nome do portal; Z-API e HubMessage trazem um id do provider que precisa de lookup. A captura resolve `domainId` em melhor esforço e deixa `null` quando não conseguir:

| `source` | Campo no `body` | Como chega ao `domainId` |
|---|---|---|
| `z-api` | `instanceId` (id da instância na Z-API, não o id interno) | instância por `zApiInstanceId` → `domainId` |
| `hubmessage` | `channel_id` | `getInstanceByChannelId` → `domainId` |
| `hubmessage-status` | `channel_id` (envelope `message`) | idem `hubmessage` |
| `bitrix` | `auth.domain` (e `data.LINE`) | domínio por nome |
| `bitrix-bot` | `domain` | domínio por nome |

A tabela de falhas de recebimento guarda também `domainName` (texto) quando o `body` o traz, para a lista mostrar o portal mesmo quando o lookup do `domainId` falha.

**Origens reprocessáveis** (tarefa 1.2). Critério: a reentrega do mesmo evento não pode repetir efeito externo.

| `source` | Reprocessável | Motivo |
|---|---|---|
| `hubmessage` | **sim** | guarda por `_id` (`findByProviderMessageId`) antes de entregar ao canal aberto; o código documenta que é para reentrega de webhook |
| `z-api` | não | não há guarda de duplicidade antes de entregar ao Bitrix; o espelho só é gravado depois (upsert por `uq_msg_instance_provider`), então reentregar pode duplicar a mensagem no canal aberto |
| `hubmessage-status` | não | pode repetir o aviso ao operador e o status da campanha; idempotência não provada |
| `bitrix` (resposta do operador, edição, exclusão) | não | reenviaria, editaria ou apagaria no WhatsApp do contato |
| `bitrix-bot` | não | executa o fluxo do bot, com efeitos no CRM e mensagens ao contato |

`REPROCESSABLE_INBOUND_SOURCES` começa, portanto, com `['hubmessage']`. As demais aparecem na lista como "não reprocessável". Incluir mais uma origem exige provar a idempotência dela e acrescentar um teste.

**Outbox e expurgo** (tarefa 1.3). Nada referencia a linha de `core_thinkerszap_widget_outbox` por chave estrangeira (só a relação inversa em `Instance`), então apagar linhas vencidas não cascateia para outras tabelas. O `[id]` de `/admin/clientes/<id>` já é o `domainId` (a página o passa direto para `/portal/domains/<id>`), então o filtro por cliente usa esse valor sem tradução.

**`removeOnFail` da fila de saída** (tarefa 1.4). Não estava definido, e o BullMQ guarda o job falho para sempre. Definido em 7 dias (`WIDGET_OUTBOUND_REMOVE_ON_FAIL`), igual à fila de entrada, com teste. Como o `jobId` é determinístico (`widget-send-<outboxId>`), isso também deixa de prender a chave de um job falho antigo.

## Open Questions

- Nenhuma que mude as specs ou a quebra de tarefas.
