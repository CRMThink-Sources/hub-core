# Proposal

## Why

O Insights do ThinkZap leva minutos para abrir com o cache frio e a requisição quebra. Medido em staging (abertura fria, período padrão de 7 dias, Vibe API): o painel levou **495 s**, dos quais ~90% na leitura de chats (`vibe.enrich`: 136 chats / 358 páginas num período e 392 chats / 595 páginas no outro, ~5 s por página). Listar sessões custa 25–37 s, negócios 5,6 s e o diretório quase nada. A API respondeu depois de 8 min, sem corte nos logs dela; quem derruba a requisição é o proxy, o front ou o Bitrix.

O cache de hoje (em memória, por processo) some a cada deploy e só protege quem abre depois de alguém ter esperado a carga inteira. Um 429 da Vibe API na leitura de um chat também deixa a sessão sem métricas de mensagem, sem nenhum aviso ao usuário.

## What Changes

- **Cache persistente (Redis) das sessões enriquecidas por dia de Brasília.** Dias fechados passam a sobreviver a deploy e a ser compartilhados entre processos; só hoje e ontem são relidos. O cálculo do painel não muda.
- **Painéis calculados fora da requisição.** `GET /insights/dashboard` (Desempenho) e `GET /insights/today` (Agora, a aba de abertura padrão, que também lê 7 dias de sessões) devolvem o resultado quando ele existe e, quando não existe, enfileira o cálculo num job BullMQ e responde `202` com `status: "computing"`. O front consulta de novo até receber o resultado.
- **Resultado dos painéis em Redis**, compartilhado entre a API e o worker, com a regra atual de 5 min de validade e de servir o resultado vencido enquanto recalcula (até 30 min).
- **Pré-aquecimento** do Agora e do Desempenho padrão dos apps que abriram o Insights recentemente, por job agendado, para a abertura quase sempre encontrar resultado pronto.
- **Tratamento do 429 da Vibe API na leitura de chats:** nova tentativa com espera maior; se ainda assim falhar, a sessão é marcada como incompleta e o painel informa quantas ficaram assim, em vez de calcular com dado faltando em silêncio.
- **Novo worker** `worker:insights` (processo próprio, como os demais) e entrada nos `docker-compose` de produção e homologação.
- **Front:** o `useRemote` (usado por `useInsightsDashboard` e `useInsightsToday`) trata o `202` (consulta periódica, estado "calculando") e mostra o aviso de sessões incompletas.

Não muda: as regras do painel (`summarize`, `fa`, `takeover`...), a concorrência de leitura de chats (5, por causa do 429) e a leitura de chats do período anterior (`initiatedBy` e `acceptedAt` vêm das mensagens e alteram as medianas). O resultado numérico do painel deve ser idêntico ao atual.

## Capabilities

### New Capabilities
- `thinkzap/insights-carga`: como o Insights carrega e entrega o painel — cache por dia, cálculo em segundo plano com resposta `202`, pré-aquecimento e sessões incompletas. Não existe spec de Insights em `openspec/specs/` hoje; esta capability cobre só o contrato de carga, não as regras de cálculo do painel.

### Modified Capabilities
<!-- Nenhuma: não há spec de Insights existente. -->

## Impact

- **API** (`api/src/modules/thinkzap`): `application/insights` (`get-insights-dashboard`, `insights-result-cache`), `infra/insights/vibe-insights-data-source.ts` (cache por dia em Redis, 429), `infra/clients/vibecode.client.ts` (espera do 429), controller do dashboard (`202`), novo módulo de fila/worker em `api/src/queue` e `api/src/workers`, scripts em `package.json`, `config/env.ts` e `.env.example`.
- **Front** (`front/app/hooks/use-insights.ts` e a página `thinkzap/insights`): contrato novo de resposta e mensagens (`front/messages`, i18n).
- **Infra:** `docker-compose.production.yml` e `docker-compose.staging.yml` ganham o container do worker; CI/deploy precisa subir a imagem com o novo comando. Redis: chaves de aplicação **não têm prefixo de ambiente** (ver `redis-connection.ts`), então o cache novo precisa incluir o ambiente na chave ou usar DB distinto.
- **Dados:** nenhuma migration. Dados do cache são derivados e descartáveis.
- **Observabilidade:** reaproveita a instrumentação `insightsTiming` já escrita (ainda sem commit na branch `task/thinkzap-insights`), que passa a valer também no worker.
- **Risco:** mudança de contrato do endpoint (de sempre `200` para `200` ou `202`); API e front precisam subir juntos ou o front antigo trataria `202` como resultado.
