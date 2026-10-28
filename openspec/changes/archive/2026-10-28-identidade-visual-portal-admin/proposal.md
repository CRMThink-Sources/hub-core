# Proposal

## Why

O portal admin (`/admin`) não tem identidade visual própria. Ele usa o tema neutro padrão do shadcn, ignora a paleta da marca que a LP já usa (`.theme-thinkhub`) e não tem navegação no celular. A home é um placeholder com um atalho e um card "em breve". A página de Jobs foi feita sob medida para um único job (a varredura de expiração), mas o portal vai ganhar mais jobs: a verificação completa de assinaturas (change B) e a sincronização com o Stripe (change C). Este change abre a reforma visual do portal começando pela home e pelos Jobs, e prepara a estrutura que os próximos jobs vão ocupar.

## What Changes

- O portal admin passa a usar a paleta da marca Think Hub (a mesma da LP). O token órfão `--admin-accent` é removido, e o portal ganha tokens semânticos de status (sucesso, atenção, falha, em andamento), usados pelos badges no lugar de cores cruas.
- Novo shell do portal:
  - sidebar com os itens agrupados: geral (Início, Clientes, Usuários, Usuários MCP) e Operação (Jobs, Falhas de envio);
  - navegação no celular, que hoje some abaixo de `sm`;
  - menu do usuário com o nome e o "Sair".
- Nova home:
  - fileira de indicadores (Clientes, Assinaturas ativas, Vencidas, Em teste);
  - painel "Saúde dos jobs";
  - painel "Precisa de atenção", com falhas de envio pendentes e jobs cuja última rodada falhou.
- Novo endpoint `GET /portal/dashboard/summary`, só leitura e só com sessão do portal. Devolve a contagem de clientes e a contagem de assinaturas da SPA 1142 por status, com cache curto.
- **BREAKING (URL do backoffice)**: `/admin/jobs` vira um catálogo de jobs, com status, última rodada e periodicidade de cada um. O histórico da varredura de expiração passa para `/admin/jobs/expiracao-assinaturas`, com o mesmo comportamento de hoje (filtros, detalhe da rodada, "Rodar agora", acompanhamento da rodada manual).
- As outras telas do admin (Clientes, Usuários, Usuários MCP, Falhas de envio, login) só herdam o shell e os tokens. O redesenho delas vem em changes seguintes.

## Capabilities

### New Capabilities
- `portal-admin/navegacao-portal-admin`: o shell do portal admin, ou seja, a navegação agrupada, a navegação no celular, o menu do usuário, a marca e o estado ativo da página atual.
- `portal-admin/painel-inicial`: a home do portal, com os indicadores de negócio, a saúde dos jobs, o "precisa de atenção" e o endpoint de resumo que a alimenta.
- `portal-admin/catalogo-jobs`: o catálogo de jobs em `/admin/jobs`, a saúde de cada job e a rota de detalhe por job.

### Modified Capabilities
- `pagamentos/historico-expiracao-assinatura`: o requisito "Backoffice lista e detalha as rodadas" muda de endereço. A listagem sai de `/admin/jobs` e vai para `/admin/jobs/expiracao-assinaturas`, que é alcançada pelo catálogo.

## Impact

- **Front** (`front/`):
  - `app/(admin)/layout.tsx`;
  - `components/layouts/admin/admin-shell.tsx`, `admin-home-content.tsx`, `admin-jobs-page.tsx`, `admin-expiration-runs-table.tsx`, `admin-outbox-status-badge.tsx`, `admin-theme.css`;
  - nova rota `app/(admin)/admin/jobs/[job]/page.tsx`;
  - novos `lib/portal-dashboard.ts` e registro de jobs;
  - i18n `messages/{pt,en,es}/admin/home.json` e `admin/jobs.json`.
- **API** (`api/`): nova rota em `modules/portal/routes.ts`, com caso de uso, factory e controller do resumo. Ganha também uma leitura de contagem por status da SPA 1142 (via `crm.item.list`, usando só o `total`) e uma chave de cache Redis com TTL curto.
- **Sem efeito** em cobrança, provider ou dados do CRM: tudo é leitura.
- **Links salvos** para `/admin/jobs` continuam funcionando, mas agora caem no catálogo, e não mais direto no histórico.
