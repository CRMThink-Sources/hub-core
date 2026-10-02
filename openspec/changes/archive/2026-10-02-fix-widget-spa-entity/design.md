# Design

## Context

Motivação em proposal.md. Estado atual relevante:

- **Widget** (`front/app/(widgets)/layouts/conversation-view.tsx`): `PLACEMENT_TO_ENTITY` é um mapa estático com 4 chaves. Para `CRM_DYNAMIC_1060_DETAIL_TAB` o lookup dá `undefined`; o `payloadBase` (e os payloads de template e botões, montados à parte) carregam `entity: undefined`, que o JSON omite.
- **API**: os quatro controllers validam `entity: z.string().min(1)`. Por isso a mensagem de erro vem do zod, crua.
- **SPA já é suportada em outros pontos**:
  - `related-destinations.resolver.ts` reconhece `CRM_DYNAMIC_(\d+)_DETAIL_TAB` para listar destinos — é por isso que a lista de telefones aparece no SPA.
  - `parseBizprocDocumentId` (robôs) produz `entity = "DYNAMIC_183"` para itens de SPA, e esse valor já segue para `crm.timeline.comment.add` com `ENTITY_TYPE: entity.toUpperCase()` e funciona em produção.
- **Nome do contato** (`get-crm-contact-name.ts`): chama `crm.${entity.toLowerCase()}.get`. Com `DYNAMIC_1060` viraria `crm.dynamic_1060.get`, que não existe; o erro é capturado em `resolveDisplayName` e cai no telefone — não quebra, mas loga `thinkzap.bitrix.contact_read_failed` em todo envio de SPA.

## Goals / Non-Goals

**Goals:**
- Um único ponto no widget converte placement → `{ entity, entityId }`, usado pelos quatro envios.
- Mesmo formato de `entity` para SPA no widget e nos robôs (`DYNAMIC_<id>`), para o resto do pipeline (outbox, worker, timeline, notificação de falha) não precisar de ramo novo.

**Non-Goals:**
- Mudar o contrato das rotas (`entity` continua string obrigatória).
- Mudar a resolução de destinos (já funciona em SPA).
- Suportar placements fora do CRM (listas universais, etc.).
- Ajustar `bizprocEntityToPlacement`, que não trata SPA nos robôs — é outro fluxo e não faz parte deste bug.

## Decisions

### 1. `entity` de SPA = `DYNAMIC_<entityTypeId>` (maiúsculo)
Alternativas: `dynamic_1060` (minúsculo, como as padrão) ou enviar `entityTypeId` numérico em campo novo.
- Escolhido o formato dos robôs porque já é o que o outbox/timeline recebem hoje via Bizproc e `crm.timeline.comment.add` aceita (o `toUpperCase()` existente cobre ambos os casos). Campo novo exigiria mudar 4 schemas, outbox e worker para um bug de mapeamento.

### 2. Helper puro `resolveWidgetEntity(placement, options)` no front
Arquivo novo ao lado do `conversation-view.tsx` (padrão de `send-widget-message.client.ts`), retornando `{ entity, entityId } | null`. Mapa estático primeiro, depois regex `^CRM_DYNAMIC_(\d+)_DETAIL_TAB$`. Testável com vitest como os vizinhos (`*.test.ts`).
- Alternativa: só adicionar o regex inline no `handleSend`. Rejeitada: o lookup é usado em quatro payloads e merece teste isolado.

### 3. Guarda no widget quando o resultado é `null`
Antes de qualquer `post`, se `resolveWidgetEntity` retornar `null`, mostra `setErrorFeedback('Não foi possível identificar a ficha do CRM em que o widget está aberto.')` e retorna sem limpar o rascunho. Evita o erro de zod cru na tela.

### 4. Nome do contato para SPA via `crm.item.get`
Em `makeGetCrmContactName`, se `entity` casar `^DYNAMIC_(\d+)$` (case-insensitive), chamar `crm.item.get` com `{ entityTypeId, id }` e ler `result.item.title`. Demais entidades seguem `crm.<entity>.get` como hoje. Usa `callMethod` (já é a dependência injetada), mantendo o `Pick<BitrixClient, 'callMethod'>`.
- Alternativa: deixar como está (cai no telefone). Rejeitada: gera log de erro falso a cada envio de SPA e piora a UX do canal aberto.

## Risks / Trade-offs

- [Outbox/worker com regras que assumem `entity` em minúsculo] → Verificado: os consumidores (`send-bitrix-notificatio.service.ts`, `notify-widget-send-outcome.ts`, `ensure-widget-open-channel-conversation.ts`) normalizam caixa ou só repassam. A tarefa de testes cobre o comentário de timeline com `DYNAMIC_1060`.
- [Formato de resposta de `crm.item.get` via `callMethod`] → O retorno é `{ result: { item: { title } } }` (mesmo shape de `ICrmItemResponse`); cobrir com teste unitário mockando `callMethod`.
- [Item de SPA sem título] → cai no telefone, igual a hoje.

## Migration Plan

Deploy normal de front e API, sem dados a migrar. Os dois lados são independentes: o front sozinho já corrige o 400; a API sozinha só melhora o nome da conversa. Rollback = reverter o commit.
