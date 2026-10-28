# Design

## Context

A motivação está em `proposal.md` (seção Why). Estado atual que molda a abordagem:

- **Tema.** `front/app/globals.css` define o tema neutro do shadcn em `:root` e, logo abaixo, a classe `.theme-thinkhub`, que é a paleta da marca usada pela LP (`app/(marketing)/page.tsx`). O admin importa `components/layouts/admin/admin-theme.css`, que declara `--admin-accent`/`--admin-*`, mas nenhum componente usa esses tokens. Só `.admin-card` e `.admin-login-bg` são usados. A fonte global é Inter (`--font-sans`) e Geist Mono já está carregada.
- **Shell.** `admin-shell.tsx` usa uma barra no topo (`max-w-6xl`) com os 6 itens sem ícone. Abaixo de `sm`, a navegação recebe `hidden` e não tem substituto. `components/ui` já tem `sheet`, `dropdown-menu`, `separator` e `button` (Base UI + shadcn). Os ícones vêm de `lucide-react`.
- **Home.** `admin-home-content.tsx` é estática.
- **Jobs.** `admin-jobs-page.tsx` concentra listagem, filtros, polling da rodada manual e o diálogo "Rodar agora", tudo sobre `lib/subscription-expiration-runs.ts` (`/portal/subscription-expiration/runs`). O badge de status (`ExpirationRunStatusBadge`) usa `bg-green-100`/`bg-red-100` crus.
- **Dados para o resumo.**
  - Clientes: `PortalDomainReadRepository.listAll()` em `core_domains`.
  - Assinaturas: a SPA 1142 é lida por `BitrixClient.listCrmItems`, cuja resposta traz `total`. Os ids de status estão em `BITRIX_ID_BY_STATUS` (`application/infra/bitrix/mappers/subscription.mapper.ts`).
  - Redis: disponível via `redisConnection`, e os repositórios de SPA já usam cache com TTL nele.
- **Falhas de envio.** `GET /portal/thinkzap/outbox-failures` devolve `total`.

## Goals / Non-Goals

**Goals:**
- Uma base visual (tokens, shell e componentes de página) que as próximas telas do admin reaproveitem sem redesenhar o chrome.
- Um catálogo de jobs que receba os jobs dos changes B (`verificacao-completa-assinaturas`) e C (`sincronizacao-status-stripe`) só com uma entrada nova de registro e uma página de detalhe.
- Nenhuma mudança no comportamento da varredura de expiração nem na API de rodadas.

**Non-Goals:**
- Modo escuro no admin. Os tokens ficam prontos para isso, mas o portal continua só claro.
- Redesenhar Clientes, Usuários, Usuários MCP, Falhas de envio e login. Essas telas herdam shell e tokens e ficam para os próximos changes.
- Uma API de catálogo de jobs (`GET /portal/jobs`). O catálogo é declarado no front (ver D4).
- Indicadores que dependem da data "vencido em", MRR e Stripe.
- Busca global, ⌘K, notificações.

## Decisions

### D1. O admin herda `.theme-thinkhub` e ganha só tokens de status próprios

O wrapper do `app/(admin)/layout.tsx` recebe `theme-thinkhub admin-theme`. `admin-theme.css` perde os `--admin-*` órfãos e passa a declarar só o que a paleta da marca não tem:

- `--canvas`: fundo da área de trabalho, levemente tingido no matiz 265, para os cards brancos se destacarem;
- os pares `--status-{success,warning,danger,info,neutral}` e `-foreground`, em oklch no mesmo esquema de luminosidade dos tokens existentes.

Esses tokens são expostos ao Tailwind via `@theme inline` (`bg-status-success`, `text-status-success-foreground`), do mesmo jeito que `--canvas` já é exposto em `globals.css`.

- *Alternativa:* uma paleta nova só para o admin. Rejeitada porque a marca já foi definida na LP, e duas paletas da mesma empresa competiriam.
- *Alternativa:* cores Tailwind cruas nos badges, como hoje. Rejeitada porque não muda com o tema e espalha decisão de cor pelos componentes.

### D2. Shell com sidebar fixa no desktop e `Sheet` no celular

```
  >= lg                                     < lg
  +----------+----------------------------+  +-------------------------------+
  | (H) Hub  |  [titulo da pagina]  (JV)v |  | [=] (H) Hub              (JV)v|
  |          +----------------------------+  +-------------------------------+
  | Inicio   |                            |  |                               |
  | Clientes |   conteudo (max-w-6xl)     |  |   conteudo                    |
  | Usuarios |                            |  |                               |
  | MCP      |                            |  |  [=] abre Sheet lateral com   |
  | OPERACAO |                            |  |      a mesma lista de itens   |
  | Jobs     |                            |  |                               |
  | Falhas   |                            |  |                               |
  +----------+----------------------------+  +-------------------------------+
```

- Os itens de navegação viram um array tipado com `{ href, labelKey, icon, exact, group }`, e ele é a única fonte para a sidebar e o `Sheet`. O ativo usa `aria-current="page"`. A regra `exact` de hoje continua.
- No desktop não há barra superior: o menu do usuário (`dropdown-menu`, com nome, e-mail e "Sair") fica no pé da sidebar, e a folha branca fica afastada 8px do topo, da direita e da base. Uma barra vazia só para o avatar seria chrome sem conteúdo. No celular, a barra de 48px tem o botão de menu, a marca e o avatar. O título fica no cabeçalho da própria página (D3), não no shell, para cada página controlar suas ações.
- A marca é o ícone do app (`app/icon.png`, servido em `/icon.png`) com o nome do portal.
- A sidebar tem largura fixa (`w-60`) e não recolhe. Recolher é polimento que pode vir depois sem mudar spec.

### D3. Componentes de página compartilhados em `components/layouts/admin/ui/`

Os padrões vão ser reaproveitados pelas próximas telas, então ficam fora das páginas:

- `AdminPageHeader`: título, descrição, slot de ações e breadcrumb opcional (usado no detalhe do job).
- `AdminStatCard` dentro de `AdminStatGroup`: os indicadores ficam num único container dividido por linhas de 1px (4 colunas no desktop, 2×2 no celular), e não num card por número. Cada célula tem rótulo, valor (`tabular-nums`), linha auxiliar e link opcionais, e os estados `loading` (bloco cinza do mesmo tamanho) e `unavailable`.
- `AdminJobRunStrip` (em `admin-jobs-health.tsx`): as últimas 24 rodadas de um job lado a lado, da mais antiga para a mais recente, coloridas pelo resultado; vagas sem rodada ficam como trilho vazio. Aparece no catálogo, no detalhe e na home, e é o elemento próprio do portal (um dia inteiro de um job horário).
- `AdminStatusBadge`: recebe um `tone` (`success|warning|danger|info|neutral`) e um texto. Substitui `ExpirationRunStatusBadge` por dentro, que mantém o mapeamento status → tone/texto, e o `admin-outbox-status-badge.tsx`.
- `AdminPanel`: o antigo `.admin-card`, como componente com cabeçalho opcional.
- `AdminEmptyState`: ícone, título, descrição e ação.

### D4. Catálogo de jobs declarado no front, com a saúde calculada no cliente

`front/lib/admin-jobs.ts` exporta o registro:

```ts
type AdminJobDefinition = {
  id: 'expiracao-assinaturas'          // vira union quando B/C entrarem
  nameKey: string; descriptionKey: string; scheduleKey: string
  intervalMs: number                   // 1h hoje; usado para "atrasado"
  fetchLatestRun: () => Promise<JobRunSummary | null>
}
type JobRunSummary = {
  status: 'running' | 'success' | 'failed'
  abandoned: boolean; paused: boolean; itemFailures: number; startedAt: string
}
```

Junto vem a função pura `deriveJobHealth(run, intervalMs, now)`, que implementa a tabela de precedência da spec `portal-admin/catalogo-jobs` e é coberta por teste unitário. O `fetchLatestRun` da varredura chama `listExpirationRuns({ page: 1, limit: 1 })` e adapta o resultado.

A rota `app/(admin)/admin/jobs/[job]/page.tsx` resolve o `id` no registro e renderiza o componente de detalhe registrado: `expiracao-assinaturas` → o atual `AdminJobsPage`, renomeado para `AdminExpirationJobPage`. Id desconhecido mostra "job não encontrado" (não usa `notFound()`, para manter o shell).

- *Alternativa:* `GET /portal/jobs` na API, devolvendo catálogo, flag de ambiente e última rodada. É mais correto a longo prazo (o servidor saberia se o job está desligado em homolog), mas acopla este change à API de jobs que B e C ainda vão moldar. Fica como evolução possível em B ou C, e o registro do front já isola o ponto de troca (`fetchLatestRun`).

### D5. `GET /portal/dashboard/summary` no módulo `portal`

```
  GET /portal/dashboard/summary  (portalAuthMiddleware)
        |
        v
  GetDashboardSummary.execute()
        |-- clients: PortalDomainReadRepository.countAll()   (Prisma count)
        +-- subscriptions: SubscriptionStatusCounter.count()  --try/catch--> null
                 |
                 v
          CachedSubscriptionStatusCounter (Redis, TTL 60s, key dashboard:subscription-status-counts)
                 |
                 v
          BitrixSubscriptionStatusCounter
            3x crm.item.list { entityTypeId: SPA 1142, filter: { ufCrm91Status: <id> },
                              select: ['id'] }  --> usa só `total`
```

- **`countAll()`** é um método novo no repositório de leitura de domínios, porque `listAll()` hidrata títulos da SPA 1060 e seria caro só para contar.
- **Contagem via `total`** do `crm.item.list`, com uma chamada por status (ativo, vencido, em teste). As três vão em paralelo. Não pagina, porque `total` já é a contagem do filtro.
- **Cache de 60 s, sem invalidação por webhook.** Um indicador de painel tolera um minuto de atraso, e ligar isso ao `invalidate-spa-cache` aumentaria o raio de mudança. O `generatedAt` vem do momento do cálculo e fica no valor cacheado.
- **A falha da contagem é capturada no caso de uso.** Ela é registrada em log como `warn` e devolve `subscriptions: null`. Não se grava cache de falha.
- A porta `SubscriptionStatusCounter` fica em `application/domain/repositories`, junto das outras leituras da SPA 1142. O módulo `portal` só a consome, como já faz com `AplicationTitleReader`.

### D6. A home compõe três fontes independentes

`AdminHomeContent` dispara em paralelo, cada um com o próprio estado de loading e erro:

1. o resumo (D5);
2. o `fetchLatestRun` de cada job do registro (D4);
3. `listOutboxFailures({ page: 1, limit: 1 })`, usando só o `total`.

Uma fonte que falha só degrada o próprio bloco. "Precisa de atenção" é derivado das fontes 2 e 3 no cliente. A saudação continua, agora junto com a data por extenso no idioma do portal.

### D7. Hierarquia visual

- A tipografia fica em Inter, com escala curta: título de página `text-2xl font-semibold tracking-tight`, título de bloco `text-sm font-medium`, valor de KPI `text-3xl font-semibold tabular-nums`.
- A superfície é `bg-canvas` no fundo, com painéis `bg-card`, borda `border-border` e sombra mínima. O azul da marca (`--primary`) aparece só na ação primária e no ícone do item ativo; o item ativo em si é um pill neutro (`--admin-active`). Nunca é fundo de bloco.
- A tabela de rodadas mantém as 9 colunas, com cabeçalho `text-xs text-muted-foreground` sem caixa alta e números alinhados à direita. Por isso a rolagem horizontal continua no celular.

## Risks / Trade-offs

- **Link salvo para `/admin/jobs` cai no catálogo e não no histórico** → Mitigação: o catálogo tem um job só e leva ao histórico com um clique. Não vale um redirect, porque o catálogo é o destino certo daqui para frente.
- **O catálogo no front pode divergir dos jobs reais da API** (ex.: job desligado em homolog aparece como "atrasado") → Mitigação: a regra é documentada na spec. A evolução para `GET /portal/jobs` (D4) resolve isso quando B ou C precisarem.
- **Três chamadas ao Bitrix a cada minuto em que alguém olha a home** → Mitigação: o cache de 60 s compartilhado entre usuários e o `select: ['id']`. O volume é desprezível perto da varredura horária.
- **Os outros admins herdam o shell novo com conteúdo antigo** → Mitigação: os tokens de `.theme-thinkhub` são compatíveis com as classes shadcn que essas telas já usam (`bg-background`, `text-muted-foreground`, `admin-card`). Por isso `.admin-card` é mantido como alias até o redesenho delas.
- **`.theme-thinkhub` no wrapper do admin também vale para os portais de `Dialog`/`Sheet`**, que renderizam fora da árvore → Mitigação: aplicar as classes também no `body` via layout do grupo, ou garantir que o container dos portais herde. Isso precisa ser verificado na task de tema, abrindo o diálogo "Rodar agora".

## Migration Plan

O deploy é só de código, sem migração de dados. A API e o front podem subir em qualquer ordem: o front antigo não chama `/dashboard/summary`, e o front novo trata a falha do resumo como indisponível. Rollback = reverter o deploy.
