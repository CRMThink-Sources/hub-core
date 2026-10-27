# Design

## Context

O motivo está em proposal.md, na seção Why. O estado atual relevante é este:

- `processWidgetSendJob` (`api/src/workers/thinkzap-widget-send.processor.ts`) chama `resolveLineTarget` antes de qualquer outra coisa.
  - `resolveLineTarget` monta o contexto com `makeGetAplicationContext().execute(...)` e procura o item com `findItemInContext`.
  - **Qualquer** exceção vira `null` e cai no ramo `markFailed(row.id, 'Linha não encontrada na instalação')` + `notifyOutcomeFor(row, 'failed')`.
  - Esse ramo roda antes do `claimForSending`, então a row ainda está `PENDING` quando a exceção acontece.
- `findItemInContext` (`modules/thinkzap/application/helpers/resolve-line-by-subscription-item.ts`) já lança `LineNotFoundError` quando o item não está no contexto. Esse é o único caso que é de fato "linha não existe".
- A fila `thinkzap-widget-outbound` usa `attempts: 3` e `backoff: exponential 1000`, o que dá esperas de 1 s e 2 s.
  - O worker calcula `isLastAttempt` e o repassa ao processor.
  - Adiamentos por cadência ou por destino ocupado usam `DelayedError` e não gastam tentativa.
- `makeGetAplicationContext` monta quatro decorators de cache no Redis: `CachedProductRepository`, `CachedPlanRepository`, `CachedSubscriptionRepository` e `CachedSubscriptionItemRepository`.
  - Todos têm TTL de 5 minutos.
  - O padrão em todos é: ler o Redis; se não achar, ler o Bitrix e gravar.
  - As chaves ficam em `infra/cache/keys.ts`, com versão por família e padrões de `SCAN` usados pelo webhook de saída das SPAs para invalidar.
- `BullMqWidgetSendQueue.ensureScheduled(outboxId)` já recria o job de uma intenção. Ele remove antes o job terminado, porque o `jobId` é determinístico (`widget-send-<id>`).
- O portal admin é composto por:
  - páginas em `front/app/(admin)/admin/*`, com `AdminAuthGuard` e `AdminShell`;
  - API em `api/src/modules/portal/routes.ts`, com `portalAuthMiddleware` e `req.portalUserId`;
  - modelo de tela com lista paginada e filtros: `admin-jobs-page.tsx` com `front/lib/subscription-expiration-runs.ts`.
- `ThinkzapWidgetOutbox` já tem o índice `@@index([status, createdAt])`.

## Goals / Non-Goals

**Goals:**
- Uma instabilidade do Bitrix interno não pode mais virar perda silenciosa de mensagem.
- Operar sem acesso a servidor: ver e reprocessar falhas pelo portal admin.

**Non-Goals:**
- Reprocessar automaticamente as falhas antigas. A decisão é humana, pela tela.
- Alterar o fluxo da fila do canal aberto (`bitrix-received-message.processor.ts`). Ele resolve o contexto pelo mesmo caso de uso e ganha a cópia de reserva de graça, mas a lógica dele não muda.
- Tela de falhas para o cliente dentro do Bitrix. A tela é só do portal admin da CRMThink.
- Alertas e notificações proativas de falha.

## Decisions

### 1. Separar `LineNotFoundError` de falha temporária em `resolveLineTarget`

`resolveLineTarget` passa a devolver um resultado com três casos: `{ kind: 'found', line }`, `{ kind: 'not-found' }` ou `{ kind: 'unavailable', error }`.

| Situação | O que acontece |
|---|---|
| Item ausente: `LineNotFoundError`, ou provider `NONE` | `not-found`, falha definitiva como hoje |
| Qualquer outra exceção, sem ser a última tentativa | O processor **relança** a exceção. O BullMQ retenta com backoff e a row continua `PENDING`, sem `claim` |
| Qualquer outra exceção na última tentativa (`isLastAttempt`) | `markFailed(row.id, 'Falha temporária ao consultar a linha: <erro resumido>')` + `notifyOutcomeFor(row, 'failed')`. Nunca fica `PENDING` órfã |

Alternativa considerada: adiar com `DelayedError`/`deferUntil`, sem gastar tentativa e com contador próprio na row. Foi descartada porque exige estado novo para limitar as tentativas, e o mecanismo de tentativas do BullMQ já faz exatamente isso.

### 2. Backoff: `attempts: 4`, `exponential` com 10 s

As esperas ficam em 10 s, 20 s e 40 s, somando cerca de 70 s até a última tentativa. Isso cobre o requisito de pelo menos 60 s.

A mudança vale para todas as falhas que relançam na fila de saída, inclusive o erro do provider antes do envio (`releaseToPending`). Mais uma tentativa com espera maior também é bom para o provider. O custo é que uma mensagem com falha segura a fila FIFO da linha por mais tempo; isso está em Risks.

Alternativa considerada: um backoff só para a falha de consulta da linha. Foi descartada porque o BullMQ não permite backoff por tipo de erro sem uma estratégia customizada, e o ganho não compensa.

### 3. Cópia de reserva (stale-if-error) nos quatro decorators

Um helper compartilhado em `infra/cache/stale-if-error.ts` concentra a lógica:

```ts
readThrough({ redis, freshKey, staleKey, schema, freshTtl, staleTtl, load, log })
```

Ele segue esta ordem:

1. Se houver hit fresco válido, devolve.
2. Senão, executa `load()`.
   - Se der certo, grava `freshKey` com TTL de 5 min e `staleKey` com TTL de 24 h, e devolve.
   - Se der erro, lê `staleKey` e valida pelo mesmo schema.
     - Se existir, faz `warn` com `{ key, err }` e devolve.
     - Se não existir, relança o erro original.

Decisões sobre as chaves:
- As chaves de reserva ficam em um **namespace separado**, com prefixo próprio em `keys.ts`, por exemplo `payments-stale:` mais a chave fresca. Assim os padrões de `SCAN` do webhook de invalidação **não** casam com elas.
- A invalidação continua apagando só as chaves frescas. Uma reserva desatualizada só é usada com o Bitrix fora do ar, e é sobrescrita na próxima leitura bem-sucedida.
- Cada chave de reserva usa a **mesma versão** da família (`*_CACHE_VERSION`). Uma mudança de shape invalida as duas.
- O ambiente do gateway entra na chave de plano e de assinatura, como já acontece nas chaves frescas.

Os métodos de escrita (`refresh`, `create`, `update`, `reparent`) também gravam a reserva da chave individual, já que regravam a fresca.

Alternativas consideradas:
- **TTL fresco maior**, por exemplo 30 min. Descartada porque atrasaria cancelamentos e mudanças de configuração da linha com o Bitrix funcionando.
- **Cache em memória no worker.** Descartada porque não sobrevive a restart e não é compartilhado entre API e workers.

### 4. Reprocessamento

**Repositório.** Um novo método `requeueForReprocess(id, { portalUserId, allowUnknown })` faz um `updateMany` condicional:

```
WHERE id = ?
  AND providerMessageId IS NULL
  AND status IN ('FAILED')            -- ou ('FAILED', 'UNKNOWN') quando allowUnknown
SET status = 'PENDING',
    reprocessCount = reprocessCount + 1,
    lastReprocessedAt = now(),
    lastReprocessedBy = portalUserId,
    cadenceWaitUntil = NULL,
    timelineNotifiedAt = NULL
```

- Com `count = 0`, o resultado é conflito. Isso garante a atomicidade entre pedidos simultâneos.
- `lastError` é **mantido**, para guardar a causa original. A próxima falha o sobrescreve.
- `attempts` não é zerado. É um histórico da intenção, e o `claim` incrementa.

**Reagendamento.** Depois do update, o caso de uso chama `BullMqWidgetSendQueue.ensureScheduled(id)`. O job antigo terminado é removido e um novo é criado com o mesmo `jobId`, e o worker segue o fluxo normal: limite diário, cadência, lock por destino, avisos e `onDelivered`.

**`timelineNotifiedAt = NULL`.** O carimbo existe para que o aviso de resultado de uma intenção saia uma vez só. Depois de reprocessar, o resultado novo precisa ser avisado; sem limpar o carimbo, o sucesso do reenvio não apareceria na timeline nem no canal aberto.

**Ordem na fila da linha.** O reprocessamento zera o `queueSeq`. A posição antiga já saiu, ou vai sair pela varredura, da fila FIFO da linha no Redis, e um `seq` que não está mais na fila nunca chegaria à vez. Com `queueSeq = NULL`, o despacho põe a row no **fim** da fila da linha (`reserveCadenceSlot`), e ela entra na janela como qualquer outra mensagem nova.

**Migration.** Aditiva em `core_thinkerszap_widget_outbox`:

| Coluna | Tipo |
|---|---|
| `reprocess_count` | `INT NOT NULL DEFAULT 0` |
| `last_reprocessed_at` | `DATETIME NULL` |
| `last_reprocessed_by` | `VARCHAR NULL`, id do usuário do portal |

### 5. API do portal admin

Todas as rotas ficam atrás de `portalAuthMiddleware`, no padrão de `subscription-expiration-runs-controller.ts`:

| Rota | Resposta |
|---|---|
| `GET /portal/thinkzap/outbox-failures` | `{ items, total, page, limit }` |
| `GET /portal/thinkzap/outbox-failures/:id` | Detalhe, ou 404. Também 404 se a row não estiver em `FAILED` ou `UNKNOWN` e nunca tiver sido reprocessada |
| `POST /portal/thinkzap/outbox-failures/:id/reprocess` | 202 se aceito, 409 em conflito, 422 em `UNKNOWN` sem confirmação |
| `POST /portal/thinkzap/outbox-failures/reprocess` | 200 com `{ results: [{ id, status: 'requeued' \| 'conflict' \| 'needs-confirmation' }] }` |

Parâmetros:
- **Listagem:** `page`, `limit` (máximo 100), `status` (`FAILED` \| `UNKNOWN`, opcional), `domain` (busca por nome), `origin`, `from` e `to` (padrão: últimos 7 dias; máximo: 90 dias).
- **Reprocessar um:** corpo `{ acknowledgeDuplicateRisk?: boolean }`.
- **Reprocessar em lote:** corpo `{ ids: string[] (1..50), acknowledgeDuplicateRisk?: boolean }`.

A listagem faz join com `Domain` para mostrar o nome do portal. O texto é truncado em 200 caracteres na lista e vai completo no detalhe.

### 6. Front

- Página `front/app/(admin)/admin/falhas-envio/page.tsx` com o componente `admin-outbox-failures-page.tsx`, no padrão de `admin-jobs-page.tsx`: filtros no topo, tabela paginada, seleção múltipla e um painel ou modal de detalhe.
- A confirmação de `UNKNOWN` usa um diálogo do design system. Nada de `window.confirm`.
- Cliente em `front/lib/outbox-failures.ts`, com `axiosPortal`.
- Item `navOutboxFailures` no `admin-shell.tsx`.
- Namespace de tradução `admin/outbox-failures` em pt, en e es.

## Risks / Trade-offs

- **[Risco] Cópia de reserva enviando por uma linha cancelada durante uma queda do Bitrix.** → Só acontece com o Bitrix falhando e dura no máximo 24 h. Perder a mensagem do cliente pagante é pior. O uso fica logado e pode ser auditado.
- **[Risco] A fila FIFO da linha fica parada por até cerca de 70 s enquanto a mensagem da frente retenta.** → É o mesmo comportamento de hoje, só com espera maior. Durante uma queda do Bitrix as mensagens de trás falhariam igual, e quando a espera é por erro do provider ela também protege contra rajada.
- **[Risco] Reprocessar uma mensagem horas depois, fora do contexto da conversa.** → A data de criação aparece na lista e a ação é manual. Não existe reprocessamento automático.
- **[Risco] Reprocessar mídia cujo arquivo já foi liberado (`releaseMedia`) depois da falha.** → O envio falha de novo com o erro de mídia, que fica visível no detalhe. Não há perda nem duplicidade. Se isso for frequente, avaliar guardar a mídia das rows `FAILED` por mais tempo, fora desta change.
- **[Risco] Mais memória no Redis por causa das cópias de 24 h.** → São as mesmas entidades já cacheadas, com volume na casa de centenas de chaves. Impacto desprezível.
- **[Trade-off] O `attempts: 4` vale para todas as falhas que relançam na fila de saída**, e não só para a consulta da linha. É aceito pela simplicidade (ver a decisão 2).

## Migration Plan

1. Aplicar a migration aditiva. Ela é compatível com o código atual.
2. Fazer o deploy da API e dos workers juntos: o processor e a fila mudam em conjunto.
3. As cópias de reserva se formam sozinhas nas leituras seguintes. Até lá, sem reserva, vale a retentativa.
4. As 8 falhas de 27/10 do querobombinhas podem ser reprocessadas pela tela nova, se o operador ainda quiser. A decisão é do suporte.

**Rollback:** reverter o deploy. As colunas novas ficam sem uso e são inofensivas. As chaves de reserva expiram sozinhas em 24 h.

## Open Questions

Nenhuma. Decisão registrada: `last_reprocessed_by` guarda o id do usuário do portal. O detalhe mostra o e-mail desse usuário, resolvido na leitura; se o usuário tiver sido removido, mostra o id.
