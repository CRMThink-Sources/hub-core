# pagamentos/historico-expiracao-assinatura Specification

## Purpose

Define como as rodadas da varredura de expiração de assinaturas ficam registradas e como o backoffice as consulta e dispara, para o time ver o que venceu, quando e o que falhou.

## Requirements

### Requirement: Toda rodada da varredura é registrada
O sistema SHALL registrar toda rodada da varredura de expiração, agendada ou manual, mesmo quando nada é alterado.

O registro SHALL ser criado no início da rodada com o resultado `running` e guardar:
- o horário de início;
- o gatilho: `scheduled` (agendada) ou `manual`;
- no caso manual, o usuário do backoffice que disparou.

Ao terminar, o registro SHALL ganhar:
- o horário de fim;
- os contadores: verificadas, trials expirados, manuais vencidas, falhas e se o Bitrix pausou a rodada;
- o resultado: `success` quando a rodada chegou ao fim, mesmo com falhas por assinatura ou pausa do Bitrix, e `failed` quando a rodada inteira falhou, com a mensagem de erro.

Uma rodada agendada que não pega o lock porque outro processo está varrendo SHALL NOT ser registrada.

#### Scenario: Rodada sem alterações
- **WHEN** a rodada agendada roda e nenhuma assinatura venceu
- **THEN** existe um registro `success`, gatilho `scheduled` e todos os contadores de alteração em zero

#### Scenario: Rodada com alterações
- **WHEN** a rodada passa um trial para `Teste expirado` e uma manual para `Vencido`
- **THEN** o registro tem `trialExpired = 1`, `pastDue = 1` e resultado `success`

#### Scenario: Falha geral
- **WHEN** a listagem da SPA falha com um erro que não é pausa do Bitrix
- **THEN** o registro termina como `failed` com a mensagem de erro

#### Scenario: Processo morre no meio
- **WHEN** o processo é encerrado durante uma rodada
- **THEN** o registro continua `running`, e a tela o mostra como em andamento até ser considerado abandonado (ver o requisito de consulta)

### Requirement: Cada assinatura alterada ou com falha é registrada na rodada
Para cada assinatura que a rodada alterou, ou tentou alterar e falhou, o sistema SHALL registrar, ligado à rodada:
- o id da assinatura na SPA 1142;
- o status anterior;
- o status novo (`trial_expired` ou `past_due`);
- o fim do período;
- se deu certo;
- a mensagem de erro, quando falhou.

Assinaturas que foram verificadas mas não mudaram SHALL NOT gerar registro.

#### Scenario: Assinatura alterada
- **WHEN** a rodada passa a assinatura `501` de `Ativo` para `Vencido`
- **THEN** a rodada tem o registro `501`, `active` → `past_due`, com sucesso

#### Scenario: Falha ao gravar
- **WHEN** a gravação do status da assinatura `502` falha no Bitrix
- **THEN** a rodada tem o registro `502` com falha e a mensagem de erro, e o contador de falhas é `1`

### Requirement: Histórico guardado por 90 dias
O sistema SHALL apagar as rodadas iniciadas há mais de 90 dias, junto com os registros de assinatura delas.

#### Scenario: Rodada antiga
- **WHEN** existe uma rodada iniciada há 91 dias e o job roda
- **THEN** essa rodada e as assinaturas dela deixam de existir

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

### Requirement: Rodar agora pelo backoffice
O backoffice SHALL ter um botão "Rodar agora", que pede confirmação antes de disparar. O disparo SHALL:
- executar a mesma varredura, com a mesma regra e a mesma carência;
- usar o mesmo lock da rodada agendada;
- ser registrado com gatilho `manual` e o usuário que disparou.

A API SHALL responder:
- logo depois de iniciar, sem esperar a rodada terminar, devolvendo o id da rodada;
- `409` quando outra rodada está em andamento (lock ocupado);
- `409` quando a varredura está desligada no ambiente (`SUBSCRIPTION_EXPIRATION_ENABLED`). Assim homolog nunca grava status no portal compartilhado.

#### Scenario: Disparo manual
- **WHEN** um usuário do backoffice clica em "Rodar agora" e confirma
- **THEN** uma rodada `manual` com o usuário dele aparece na lista como em andamento e, ao terminar, mostra os contadores

#### Scenario: Cancelar a confirmação
- **WHEN** o usuário clica em "Rodar agora" e cancela na confirmação
- **THEN** nada é disparado

#### Scenario: Rodada já em andamento
- **WHEN** "Rodar agora" é confirmado enquanto a rodada agendada está varrendo
- **THEN** a API responde `409`, a tela avisa que já há uma rodada em andamento, e nenhuma rodada nova é registrada

#### Scenario: Ambiente desligado
- **WHEN** "Rodar agora" é confirmado em homolog com a varredura desligada
- **THEN** a API responde `409`, a tela avisa que a varredura está desligada neste ambiente, e nada é gravado na SPA
