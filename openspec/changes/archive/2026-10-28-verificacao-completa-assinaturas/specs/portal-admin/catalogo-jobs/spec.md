# Spec Delta

## MODIFIED Requirements

### Requirement: Catálogo lista os jobs do portal
`/admin/jobs` SHALL listar todos os jobs que o portal acompanha, cada um com:
- nome;
- descrição curta;
- periodicidade (ex.: "a cada hora");
- saúde;
- início e resultado da última rodada.

Cada job SHALL ter um identificador estável em kebab-case. Escolher um job SHALL levar para `/admin/jobs/<identificador>`. Hoje o catálogo tem um job, a verificação de assinaturas, com identificador `expiracao-assinaturas`. O identificador continua o da antiga varredura de expiração para não quebrar links.

#### Scenario: Abrir o catálogo
- **WHEN** um usuário logado abre `/admin/jobs`
- **THEN** aparece o card "Verificação de assinaturas", com periodicidade ("a cada hora, reconciliação diária"), saúde e última rodada

#### Scenario: Ir para o detalhe
- **WHEN** o usuário escolhe "Verificação de assinaturas" no catálogo
- **THEN** o portal vai para `/admin/jobs/expiracao-assinaturas`
