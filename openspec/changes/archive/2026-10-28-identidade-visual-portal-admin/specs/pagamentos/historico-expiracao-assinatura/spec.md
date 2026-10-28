# Spec Delta

## MODIFIED Requirements

### Requirement: Backoffice lista e detalha as rodadas
O backoffice SHALL ter a página `/admin/jobs/expiracao-assinaturas`, acessível pelo catálogo de jobs (`/admin/jobs`) e só com sessão do portal. A API SHALL recusar sem sessão do portal (`401`).

A página SHALL:
- mostrar o nome do job, a periodicidade e a saúde atual, com um link de volta para o catálogo;
- listar as rodadas da mais recente para a mais antiga, paginadas, com início, duração, gatilho, quem disparou, resultado e contadores;
- permitir filtrar "só rodadas com alterações ou falhas" e filtrar por gatilho;
- abrir o detalhe de uma rodada com a lista de assinaturas registradas: id, status anterior → novo em texto legível ("Ativo → Vencido", "Em teste → Teste expirado"), fim do período, sucesso ou erro, e link para o item na SPA 1142 do CRM;
- informar que a varredura não cancela assinaturas, só grava `Teste expirado` e `Vencido`;
- mostrar como "abandonada" uma rodada `running` iniciada há mais de 1 hora.

#### Scenario: Ver o que venceu hoje
- **WHEN** o time abre `/admin/jobs/expiracao-assinaturas` e liga "só com alterações"
- **THEN** aparecem só as rodadas que alteraram ou falharam, e ao abrir uma delas aparecem as assinaturas com status anterior e novo

#### Scenario: Chegar pelo catálogo
- **WHEN** o time abre `/admin/jobs` e escolhe a varredura de expiração
- **THEN** a página de rodadas da varredura é exibida

#### Scenario: Sem sessão
- **WHEN** alguém chama a API de rodadas sem token do portal
- **THEN** a resposta é `401`

#### Scenario: Rodada inexistente
- **WHEN** o detalhe de um id de rodada que não existe é pedido
- **THEN** a resposta é `404`
