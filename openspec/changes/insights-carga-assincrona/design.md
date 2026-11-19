# Design

## Context

Estado atual (ver `proposal.md` para a motivação e as medições):

- `GetInsightsDashboard.execute` roda `buildDashboard` **dentro da requisição**, atrás de `InsightsResultCache.getOrLoad`: cache em memória, por processo, com TTL de 5 min e janela "stale" de 30 min.
- `VibeInsightsDataSource` guarda leituras num `memo` em memória, também por processo: sessões por dia de Brasília (`sd:AAAA-MM-DD`, 30 min para dias antigos e 2 min para hoje/ontem) e chats por `chatId` (2 min).
- A fonte é montada por app em `make-insights-source-resolver.ts`, em memória, com o estado da chave (`key-health.ts`) também em memória.
- Já existe a infraestrutura de fila: `bullBaseOptions` (conexão + prefixo por ambiente), workers como processos próprios (`api/src/workers/*.worker.ts`), job repetível (`importsheet-scheduler.queue.ts`) e um Redis compartilhado.
- As chaves de aplicação no Redis **não têm prefixo de ambiente** (`redis-connection.ts`); só o BullMQ tem (`QUEUE_PREFIX`).
- O `buildToday` (aba **Agora**, a aba de abertura padrão do front) lê `OPEN_WINDOW_DAYS = 7` de sessões pela mesma fonte e sofre a mesma abertura fria. O painel de Desempenho só é pedido quando o usuário abre a segunda aba.
- O front envia `from`/`to` explícitos (período padrão calculado no cliente por `defaultPeriod`), mais `g`/`sg`; `dept`/`operator` vazios não vão na URL.

## Goals / Non-Goals

**Goals:**
- A requisição do painel responde em tempo curto sempre, com resultado ou `202`.
- Leituras de dias fechados sobrevivem a deploy e valem para todos os processos.
- O cálculo roda em processo próprio, sem competir com o tráfego da API.
- Dado faltando por `429` passa a ser visível.

**Non-Goals:**
- Acelerar a leitura em si (concorrência de chats, paginação em paralelo, pular chats do período anterior): fica para depois de medir o ganho do cache.
- Mudar as regras de cálculo ou o formato dos indicadores.
- Pré-aquecer períodos que não sejam o padrão.

## Decisions

### 1. Resultado do painel e estado do cálculo em Redis, não em memória

O resultado vai para uma chave por app + consulta (`insights:<ambiente>:<appId>:dashboard:<hash da consulta>`) com `computedAt` e o valor JSON; um segundo valor guarda o estado do cálculo (`computing` com `startedAt`, ou `failed`). A API lê o resultado; o worker grava. O prefixo de ambiente na chave é `queuePrefix` (já distingue staging de produção), mais a recomendação do `CLAUDE.md` de DB distinto no `REDIS_URL`.

- **Por quê:** a API e o worker são processos diferentes; o cache em memória não é visível ao worker, e perde tudo a cada deploy.
- **Alternativa — Prisma/MySQL:** sobrevive a tudo, mas é um schema novo para dado derivado e descartável; Redis já está no caminho e tem TTL nativo.
- **Alternativa — manter em memória e só mover o cálculo:** o worker não consegue entregar o resultado à API.

O `InsightsResultCache` em memória deixa de ser a fonte dos dois painéis (Desempenho e Agora) e é substituído por um cache em Redis com a mesma regra de validade e janela "stale" (`DASHBOARD_TTL_MS`, `TODAY_TTL_MS`, `STALE_MAX_MS`).

### 2. Cálculo em job BullMQ com `jobId` determinístico

Nova fila `insights-compute` e worker `worker:insights`, com um job por tipo de painel (`dashboard` e `today`). O `jobId` é `<tipo>-<appId>-<hash>` (sem `:`; o BullMQ recusa). O BullMQ colapsa `add` de mesmo id enquanto o job existe, o que dá o "um cálculo por consulta" mesmo entre várias instâncias da API. `removeOnComplete: true` **e `removeOnFail: true`**: o BullMQ ignora um `add` cujo id já existe em qualquer estado, então um job concluído ou falho retido bloquearia o próximo cálculo da mesma consulta (a tela esperaria o prazo por um job que não existe). O diagnóstico da falha fica no log do worker. `attempts: 1`: quem refaz é a próxima abertura; reexecutar sozinho multiplicaria 8 min de carga na Vibe API.

- **Alternativa — rodar em `setImmediate` no processo da API:** resolveria a quebra, mas o cálculo continua competindo com o tráfego e some no deploy no meio do cálculo.
- **Concorrência do worker:** 1. Um cálculo ocupa a cota de leitura da Vibe API; dois em paralelo reproduzem o `429`.

### 3. Contrato do endpoint: `200` com painel, ou `202` com `status`

Fluxo no `GetInsightsDashboard` e no `GetInsightsToday` (mesma lógica, parametrizada pelo tipo, TTL e função de cálculo):

1. Lê o resultado em Redis. Válido → `200`. Vencido há menos de `STALE_MAX_MS` → `200` com `stale: true` e enfileira recálculo. Senão → segue.
2. Lê o estado: `failed` → `502` (e limpa o estado, para a abertura seguinte recalcular); `computing` há mais que o prazo máximo (15 min) → trata como `failed`; `computing` dentro do prazo → `202`.
3. Sem estado: marca `computing`, enfileira o job e responde `202`.

Corpo do `202`: `{ status: 'computing', startedAt }`. Sem `Retry-After` obrigatório; o front usa um intervalo fixo.

- **Por quê `202` e não `200` com corpo de status:** deixa claro para o cliente (e para o proxy) que não há resultado, sem o front ter de inspecionar o corpo para saber.
- **Risco de compatibilidade:** front antigo trata `202` como resultado. Ver Migração.

### 4. Cache de sessões por dia em Redis, com o mesmo formato de hoje

A entrada `sd:AAAA-MM-DD` do `VibeInsightsDataSource` passa a ser lida e gravada em Redis, por app (`insights:<ambiente>:<appId>:sd:<dia>`), com as sessões **já enriquecidas** (`...toMessageFields`). O `memo` em memória fica só como deduplicação de promessas em voo dentro do processo. TTL: dias anteriores a ontem, 24 h; hoje e ontem, 2 min (como hoje). Dia com sessão incompleta (Decisão 6): 2 min.

- Dias fechados mudam pouco (só fechamento tardio de sessões); a validade longa é o ganho principal e é onde a primeira carga de 8 min deixa de se repetir.
- O cache de chats (`chat:<id>`) **não vai para Redis**: ele existe para reaproveitar a leitura dentro de uma mesma carga, e as sessões enriquecidas já capturam o resultado. Guardar mensagens cruas em Redis é volume e dado pessoal sem ganho.
- **Idêntico ao atual:** o que se guarda é a saída da mesma `enrich`; a leitura de dia fechado devolve os mesmos objetos que a leitura direta devolveria.
- **Alternativa — TTL longo também para hoje/ontem:** economizaria leitura, mas deixaria o painel "hoje" velho. Mantém 2 min.

### 5. Invalidação por geração em Redis

`invalidate(appId)` incrementa `insights:<ambiente>:<appId>:gen` e apaga as chaves do app. O worker lê a geração ao **começar** e confere antes de gravar o resultado e cada dia; se mudou, descarta (é a regra de hoje, `InsightsResultCache.generation`, só que visível entre processos). Isso cobre "configuração salva durante um cálculo".

### 6. 429 na leitura de chat: nova tentativa maior e sessão marcada como incompleta

No `VibecodeClient`, `429` já é retentável com backoff de 400 ms / 1,2 s. Para a leitura de chats do Insights, o backoff passa a respeitar `Retry-After` (já respeitado, com teto de 5 s) e a ter uma tentativa extra com espera maior (ordem de 5 s, a calibrar). Persistindo, a sessão ganha `incomplete: true` em vez de ficar só com os campos zerados (hoje `toMessageFields({})`, que é indistinguível de "sem mensagens"). `buildDashboard` conta as incompletas e devolve `incompleteSessions` no painel; a tela avisa.

- `incomplete` só marca a sessão; **não** muda `summarize` nem outras regras (resultado idêntico para as sessões completas).
- Dia com alguma sessão incompleta é guardado com TTL curto (Decisão 4).
- **Alternativa — falhar o painel inteiro no 429:** pior que o estado atual para o usuário. Rejeitada.

### 7. Estado da chave Vibecode em Redis

`key-health.ts` é em memória por processo. Com o cálculo no worker, `markKeyRevoked` rodaria no worker e a API (`get-insights-status`) nunca saberia. O estado (`revoked` / `unreadable`) passa a ser uma chave Redis por app, sem TTL, limpa ao regravar/remover a chave (como hoje). A mesma interface (`mark*`, `clear`, `get`) fica, só assíncrona.

- Alternativa — deixar em memória: o aviso ao admin sumiria em silêncio. Rejeitada.

### 8. Pré-aquecimento por job repetível e registro de uso

- **Registro:** cada abertura do painel faz `SET insights:<ambiente>:<appId>:lastOpen <data>` com TTL de 7 dias. Fica no caminho do `GET /insights/dashboard`, depois da resposta.
- **Agendamento:** job repetível `insights-prewarm` (padrão de `importsheet-scheduler.queue.ts`, `ensureSchedulerTick` no boot do worker), a cada 10 min. Lista as chaves `lastOpen` (SCAN, nunca KEYS) e enfileira o cálculo do "Agora" e do Desempenho padrão para cada app com resultado vencido ou ausente, **um app por vez** (concorrência 1 do worker garante a ordem).
- **A chave da consulta tem de coincidir com a da abertura real.** O front envia `from`/`to` explícitos (os 7 dias terminando hoje, em horário do cliente), `g=total` e `sg=day`. O pré-aquecimento monta a mesma consulta com os 7 dias terminando hoje em Brasília. Como o dia do cliente pode diferir do de Brasília perto da meia-noite, a chave do resultado **normaliza** a consulta no servidor (`from`/`to` já vêm só como `AAAA-MM-DD`; filtros vazios são descartados, como hoje em `insightsCacheKey`). Se o cliente estiver num dia diferente de Brasília, a abertura simplesmente não acerta o pré-aquecimento e cai no cálculo normal, que já é barato com os dias em cache.
- **Alternativa — pré-aquecer todos os apps com chave:** daria carga na Vibe API por portal que nunca abre. Rejeitada.

### 9. `/insights/today` segue o mesmo caminho do Desempenho

O `today` lê 7 dias de sessões pelas mesmas entradas `sd:<dia>` e é a aba aberta por padrão; mantê-lo síncrono deixaria a primeira tela com a mesma quebra. Ele ganha o mesmo contrato (`200`/`202`/`502`), o mesmo job (`today`) e o TTL de 1 min. Como lê um subconjunto das mesmas sessões, o cache por dia (Decisão 4) aquece os dois. A única parte exclusiva dele é `operators()` (status ao vivo, 60 s, chamada única), que roda no worker.

### 10. Front: consulta periódica no `useRemote`

`useRemote` é compartilhado por Desempenho, Agora, configuração e status, então o tratamento do `202` entra uma vez e vale para `useInsightsDashboard` e `useInsightsToday`. O hook ganha tratamento do `202`: mantém `loading` e repete o GET a cada 3 s, com cancelamento ao trocar a consulta (`stale` já existe) e limite de tentativas coerente com o prazo máximo do servidor. Resultado com `stale: true` é exibido normalmente; a tela recarrega uma vez quando o recálculo termina (a próxima consulta). `incompleteSessions > 0` mostra um aviso fixo.

### 11. Worker e deploy

Novo `api/src/workers/insights.worker.ts` (+ processor), script `worker:insights`, serviço em `docker-compose.production.yml` e `docker-compose.staging.yml` com nome de container `hubthink-worker-insights[-staging]` (o prefixo `hubthink-worker` é o que o Promtail usa). O worker resolve a fonte **por job**, sem mapa de processo: o resolver atual guarda a fonte do app em memória e a invalidação da API não alcançaria o worker.

## Risks / Trade-offs

- **[Front antigo recebe `202`]** → API e front sobem juntos; ver Migração. O front novo continua funcionando com a API antiga (só recebe `200`).
- **[Redis lento ou fora do ar prende a requisição]** → a conexão compartilhada com o BullMQ não tem teto de tentativas (`maxRetriesPerRequest: null`); o adaptador `RedisInsightsKv` limita cada comando a 10 s e devolve erro, em vez de pendurar até o timeout do proxy.
- **[Cálculo antigo marca estado novo]** → o worker compara a geração do app antes de marcar falha ou chave revogada; se mudou durante o cálculo, não marca (a falha é de uma configuração que não vale mais).
- **[Worker parado → painel fica em `computing` até o prazo e vira `502`]** → prazo máximo de 15 min para não prender a tela; alerta no `bull-board` e checagem do container; é o mesmo risco já documentado no `CLAUDE.md` para os outros workers.
- **[Dado de dia fechado desatualizado por fechamento tardio]** → TTL de 24 h para dias fechados (hoje a janela é 30 min); fechamentos tardios aparecem em até 24 h. Se isso for inaceitável, baixar o TTL; a decisão é só de configuração.
- **[Redis compartilhado entre staging e produção sem DB distinto]** → o prefixo `queuePrefix` na chave evita colisão; documentado em `.env.example`. A invalidação de staging só apaga chaves do próprio prefixo.
- **[Volume no Redis]** → 400 sessões × ~1 KB por dia por app; mesmo com muitos apps é pequeno, e tudo tem TTL.
- **[Pré-aquecimento gerando carga]** → um app por vez, só apps usados nos últimos 7 dias, e a concorrência de chats não muda.
- **[Resultado diferente do atual]** → cobertura por teste de equivalência: o mesmo dado de sessão produz o mesmo painel pelo caminho direto e pelo caminho cacheado (Tarefas, seção de testes).
- **[`incomplete` mexe no tipo `InsightsSession`]** → campo opcional; só `buildDashboard` o lê para contar.

## Migration Plan

1. Subir a API e o worker com o código novo em **homologação** (`develop`), mais o front. Conferir `insightsTiming`: segunda abertura deve ser rápida, e depois de um deploy da API os dias fechados não devem ser relidos.
2. Antes de produção: criar o serviço do worker no compose de produção. Sem o worker, o painel fica em `computing` e vira `502`.
3. Deploy em produção com API, worker e front na mesma janela.
4. **Rollback:** reverter a API e o front para a versão anterior. O Redis só guarda dado derivado com TTL; nada a migrar. O worker novo pode ficar parado.
5. O contrato `202` só é consumido pelo front novo; o front novo aceita `200` da API antiga.

## Open Questions

- Valor de espera da última tentativa do `429` (≈5 s) e TTL dos dias fechados (24 h): calibrar com os logs de homologação; são só configuração, não mudam spec nem tarefas.
- Trocar `g`/`sg` na tela muda a chave e recalcula o Desempenho inteiro. Com os dias em cache isso deve ser rápido; se não for, separar o cálculo de `team`/`series` do resto depois de medir.
