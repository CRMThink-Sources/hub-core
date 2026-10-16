# Proposal

## Why

O job de expiração (`expirar-assinaturas-por-fim-de-periodo`) muda o status de assinaturas na SPA 1142 toda hora, mas ninguém consegue ver o que ele fez. Ele roda no `node-cron`, então não aparece no Bull Board. O resumo de cada rodada é descartado. Os logs vão para o Loki sem domínio, e as telas de Logs só mostram o domínio de um cliente. O time do backoffice precisa ver o que venceu, quando e se alguma gravação falhou, e precisa poder rodar a varredura na hora depois de corrigir algo no CRM.

## What Changes

- Toda rodada do job, inclusive a que não altera nada, passa a ficar gravada no banco com:
  - início e fim;
  - gatilho (agendado ou manual) e quem disparou;
  - resultado (`running`, `success`, `failed`, `skipped`) e a mensagem de erro;
  - contadores: verificadas, trials expirados, manuais vencidas, falhas e se o Bitrix pausou.
- Cada assinatura alterada, ou que falhou ao gravar, vira um registro ligado à rodada: id da assinatura, status anterior → novo, fim do período e o erro, quando houver.
- Rodadas com mais de 90 dias são apagadas pelo próprio job.
- API do portal, com a autenticação do backoffice:
  - `GET /api/portal/subscription-expiration/runs`: lista paginada, com filtro por gatilho e por "só com alterações";
  - `GET /api/portal/subscription-expiration/runs/:id`: detalhe com as assinaturas;
  - `POST /api/portal/subscription-expiration/runs`: "Rodar agora", que respeita o lock do Redis e a flag do ambiente.
- Nova página `/admin/jobs` no menu do backoffice. Ela lista as rodadas com os contadores, abre o detalhe com as assinaturas e tem o botão "Rodar agora" com confirmação.
- A tela deixa claro que o job **não cancela** assinaturas: ele só grava "Teste expirado" e "Vencido".

## Capabilities

### New Capabilities
- `pagamentos/historico-expiracao-assinatura`: registro das rodadas da varredura de expiração e a consulta e o disparo delas pelo backoffice.

### Modified Capabilities
<!-- Nenhuma: os requisitos de pagamentos/expiracao-assinatura (ainda no change expirar-assinaturas-por-fim-de-periodo) não mudam; o registro é aditivo. -->

## Impact

- `api/prisma/schema.prisma` e uma nova migration: modelos `SubscriptionExpirationRun` e `SubscriptionExpirationChange`.
- `api/src/modules/application`:
  - `ExpireSubscriptions` passa a devolver, além dos contadores, a lista do que mudou ou falhou;
  - novo serviço que registra a rodada em volta do caso de uso;
  - repositório Prisma das rodadas.
- `api/src/shared/infra/scheduler/subscription-expiration.job.ts`: usa o serviço que registra, extrai o lock para reaproveitá-lo no disparo manual e faz a limpeza dos 90 dias.
- `api/src/modules/portal`: três rotas novas com factories e controllers no padrão de "listar usuários".
- `front`:
  - página `app/(admin)/admin/jobs`;
  - componentes em `components/layouts/admin/`;
  - item novo no `admin-shell.tsx`;
  - mensagens `admin/jobs` em pt, en e es.
- Depende de `expirar-assinaturas-por-fim-de-periodo` estar no código (já implementado, ainda não arquivado).
