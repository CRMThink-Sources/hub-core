# Spec Delta

## MODIFIED Requirements

### Requirement: Toda rodada da varredura é registrada
O sistema SHALL registrar toda rodada da verificação de assinaturas, agendada ou manual, mesmo quando nada é alterado.

O registro SHALL ser criado no início da rodada com o resultado `running` e guardar:
- o horário de início;
- o gatilho: `scheduled` (agendada) ou `manual`;
- no caso manual, o usuário do backoffice que disparou.

Ao terminar, o registro SHALL ganhar:
- o horário de fim;
- os contadores:
  - verificadas;
  - trials expirados;
  - manuais vencidas;
  - linhas desassinadas por vencimento;
  - assinaturas canceladas por vencimento;
  - linhas verificadas na reconciliação;
  - linhas assinadas pela reconciliação;
  - falhas;
- se a rodada incluiu a reconciliação;
- se as etapas de provider foram puladas por estarem desligadas no ambiente;
- se o Bitrix pausou a rodada;
- o resultado: `success` quando a rodada chegou ao fim, mesmo com falhas por item ou pausa do Bitrix, e `failed` quando a rodada inteira falhou, com a mensagem de erro.

Uma rodada agendada que não pega o lock porque outro processo está verificando SHALL NOT ser registrada. As rodadas registradas antes deste requisito SHALL continuar legíveis, com os contadores novos em zero.

#### Scenario: Rodada sem alterações
- **WHEN** a rodada agendada roda e nenhuma assinatura venceu, nenhuma linha foi desassinada e não é a hora da reconciliação
- **THEN** existe um registro `success`, gatilho `scheduled`, todos os contadores de alteração em zero e reconciliação `false`

#### Scenario: Rodada com alterações
- **WHEN** a rodada passa um trial para `Teste expirado`, uma manual para `Vencido`, desassina duas linhas e cancela uma assinatura
- **THEN** o registro tem `trialExpired = 1`, `pastDue = 1`, `linesUnsubscribed = 2`, `cancelled = 1` e resultado `success`

#### Scenario: Rodada com reconciliação
- **WHEN** a rodada das 03:00 verifica 40 linhas e assina uma que estava sem assinatura
- **THEN** o registro tem reconciliação `true`, `linesChecked = 40` e `linesSubscribed = 1`

#### Scenario: Falha geral
- **WHEN** a listagem da SPA falha com um erro que não é pausa do Bitrix
- **THEN** o registro termina como `failed` com a mensagem de erro

#### Scenario: Processo morre no meio
- **WHEN** o processo é encerrado durante uma rodada
- **THEN** o registro continua `running`, e a tela o mostra como em andamento até ser considerado abandonado (ver o requisito de consulta)

### Requirement: Cada assinatura alterada ou com falha é registrada na rodada
Para cada ação que a rodada fez, ou tentou fazer e falhou, o sistema SHALL registrar, ligado à rodada:
- o tipo da ação: mudança de status, linha desassinada ou linha assinada;
- o id da assinatura na SPA 1142;
- na mudança de status: o status anterior e o novo (`trial_expired`, `past_due` ou `cancelled`);
- nas ações de linha: o id do item na SPA 1146 e o provider (Z-API ou HubMessage);
- o fim do período da assinatura;
- se deu certo;
- a mensagem de erro, quando falhou.

Assinaturas verificadas sem mudança SHALL NOT gerar registro. Linhas que a reconciliação encontrou já assinadas SHALL NOT gerar registro. A gravação só da data "Vencido em", sem mudança de status, SHALL NOT gerar registro.

#### Scenario: Assinatura alterada
- **WHEN** a rodada passa a assinatura `501` de `Ativo` para `Vencido`
- **THEN** a rodada tem o registro de mudança de status `501`, `active` → `past_due`, com sucesso

#### Scenario: Linha desassinada no quinto dia
- **WHEN** a rodada desassina o item `9001` (Z-API) da assinatura `501`
- **THEN** a rodada tem o registro de linha desassinada `501` / `9001` / Z-API, com sucesso

#### Scenario: Falha ao gravar
- **WHEN** a gravação do status da assinatura `502` falha no Bitrix
- **THEN** a rodada tem o registro `502` com falha e a mensagem de erro, e o contador de falhas é `1`

### Requirement: Backoffice lista e detalha as rodadas
O backoffice SHALL ter a página `/admin/jobs/expiracao-assinaturas`, acessível pelo catálogo de jobs (`/admin/jobs`) e só com sessão do portal. A API SHALL recusar sem sessão do portal (`401`).

A página SHALL:
- mostrar o nome do job ("Verificação de assinaturas"), a periodicidade e a saúde atual, com um link de volta para o catálogo;
- listar as rodadas da mais recente para a mais antiga, paginadas, com:
  - início, duração, gatilho, quem disparou e resultado;
  - os contadores de status (trials expirados, vencidas, canceladas);
  - os de linha (desassinadas, assinadas pela reconciliação);
  - as falhas;
  - uma indicação de que a rodada incluiu a reconciliação;
- permitir filtrar "só rodadas com alterações ou falhas" e filtrar por gatilho;
- abrir o detalhe de uma rodada com as ações registradas, agrupadas por tipo:
  - mudanças de status em texto legível ("Ativo → Vencido", "Vencido → Cancelado"), com fim do período;
  - linhas desassinadas e linhas assinadas, com item e provider;
  - em todas, sucesso ou erro e link para o item na SPA do CRM;
- informar o que a verificação faz com as manuais vencidas: desassina as linhas no quinto dia e cancela no décimo;
- informar quando as etapas de provider de uma rodada foram puladas pelo ambiente;
- mostrar como "abandonada" uma rodada `running` iniciada há mais de 1 hora.

#### Scenario: Ver o que venceu hoje
- **WHEN** o time abre `/admin/jobs/expiracao-assinaturas` e liga "só com alterações"
- **THEN** aparecem só as rodadas que alteraram ou falharam, e ao abrir uma delas aparecem as ações com status anterior e novo, e as linhas tocadas

#### Scenario: Chegar pelo catálogo
- **WHEN** o time abre `/admin/jobs` e escolhe a verificação de assinaturas
- **THEN** a página de rodadas da verificação é exibida

#### Scenario: Ver linhas desassinadas
- **WHEN** o time abre uma rodada que desassinou duas linhas
- **THEN** o detalhe lista as duas linhas, com o item, o provider e o link para a SPA 1146

#### Scenario: Sem sessão
- **WHEN** alguém chama a API de rodadas sem token do portal
- **THEN** a resposta é `401`

#### Scenario: Rodada inexistente
- **WHEN** o detalhe de um id de rodada que não existe é pedido
- **THEN** a resposta é `404`

### Requirement: Rodar agora pelo backoffice
O backoffice SHALL ter um botão "Rodar agora", que pede confirmação antes de disparar. A confirmação SHALL dizer que a rodada inclui a reconciliação das linhas e pode desassinar e cancelar assinaturas manuais vencidas. O disparo SHALL:
- executar a mesma verificação, com as mesmas regras e a mesma carência, **incluindo a reconciliação**;
- usar o mesmo lock da rodada agendada;
- ser registrado com gatilho `manual` e o usuário que disparou.

A API SHALL responder:
- logo depois de iniciar, sem esperar a rodada terminar, devolvendo o id da rodada;
- `409` quando outra rodada está em andamento (lock ocupado);
- `409` quando a verificação está desligada no ambiente (`SUBSCRIPTION_EXPIRATION_ENABLED`). Assim homolog nunca grava status no portal compartilhado.

#### Scenario: Disparo manual
- **WHEN** um usuário do backoffice clica em "Rodar agora" e confirma
- **THEN** uma rodada `manual` com o usuário dele aparece na lista como em andamento e, ao terminar, mostra os contadores, com reconciliação `true`

#### Scenario: Cancelar a confirmação
- **WHEN** o usuário clica em "Rodar agora" e cancela na confirmação
- **THEN** nada é disparado

#### Scenario: Rodada já em andamento
- **WHEN** "Rodar agora" é confirmado enquanto a rodada agendada está verificando
- **THEN** a API responde `409`, a tela avisa que já há uma rodada em andamento, e nenhuma rodada nova é registrada

#### Scenario: Ambiente desligado
- **WHEN** "Rodar agora" é confirmado em homolog com a verificação desligada
- **THEN** a API responde `409`, a tela avisa que a verificação está desligada neste ambiente, e nada é gravado na SPA
