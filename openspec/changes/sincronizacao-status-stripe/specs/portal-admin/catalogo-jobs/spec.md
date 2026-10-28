# Spec Delta

## MODIFIED Requirements

### Requirement: Catálogo lista os jobs do portal
`/admin/jobs` SHALL listar todos os jobs que o portal acompanha, cada um com:
- nome;
- descrição curta;
- periodicidade (ex.: "a cada hora");
- saúde;
- início e resultado da última rodada.

Cada job SHALL ter um identificador estável em kebab-case. Escolher um job SHALL levar para `/admin/jobs/<identificador>`. Hoje o catálogo tem dois jobs, nesta ordem:
- a verificação de assinaturas, com identificador `expiracao-assinaturas`. O identificador continua o da antiga varredura de expiração para não quebrar links;
- a sincronização Stripe, com identificador `sincronizacao-stripe`.

#### Scenario: Abrir o catálogo
- **WHEN** um usuário logado abre `/admin/jobs`
- **THEN** aparecem "Verificação de assinaturas" e "Sincronização Stripe", cada um com periodicidade, saúde e última rodada

#### Scenario: Ir para o detalhe
- **WHEN** o usuário escolhe "Verificação de assinaturas" no catálogo
- **THEN** o portal vai para `/admin/jobs/expiracao-assinaturas`

#### Scenario: Ir para o detalhe da sincronização Stripe
- **WHEN** o usuário escolhe "Sincronização Stripe" no catálogo
- **THEN** o portal vai para `/admin/jobs/sincronizacao-stripe`
