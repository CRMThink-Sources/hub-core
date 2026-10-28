# Spec Delta

## Purpose

Define o job que reconcilia o status e o período das assinaturas Stripe da SPA 1142 com o Stripe, corrigindo o que o webhook do gateway não aplicou, e como as rodadas dele são registradas e consultadas no backoffice.

## ADDED Requirements

### Requirement: Quais assinaturas a sincronização lê
A sincronização SHALL considerar só as assinaturas da SPA 1142 com:
- modalidade `stripe`;
- id do gateway preenchido;
- ambiente (`UF_CRM_91_ENVIRONMENT`) igual ao ambiente da chave Stripe em uso. Campo vazio conta como `production`.

Assinaturas manuais, sem id do gateway ou de outro ambiente SHALL NOT ser lidas no Stripe nem alteradas. Assinaturas que compartilham o mesmo id do gateway (uma por plano) SHALL ser lidas no Stripe uma vez e receber o mesmo estado.

#### Scenario: Assinatura de homologação no portal compartilhado
- **WHEN** a sincronização roda em produção e uma assinatura Stripe tem ambiente `homolog`
- **THEN** ela não é lida no Stripe nem alterada

#### Scenario: Ambiente vazio
- **WHEN** a sincronização roda em produção e uma assinatura Stripe tem o ambiente vazio
- **THEN** ela é lida no Stripe como de produção

#### Scenario: Duas assinaturas do mesmo contrato
- **WHEN** duas assinaturas da SPA têm o mesmo id do gateway
- **THEN** o Stripe é consultado uma vez e as duas recebem o mesmo status e período

### Requirement: Status e período seguem o Stripe
Para cada assinatura considerada, a sincronização SHALL ler a assinatura no Stripe e, quando o status mapeado ou o fim do período diferir da SPA, gravar na SPA o status e o início e fim do período. O mapa de status SHALL ser o mesmo do webhook:
- `trialing` e `active` → `Ativo`;
- `past_due`, `unpaid`, `incomplete`, `incomplete_expired` e `paused` → `Vencido`;
- `canceled` → ver o requisito de cancelamento.

Assinaturas que já concordam SHALL NOT ser escritas. Status do Stripe fora do mapa SHALL NOT gerar escrita, e a rodada SHALL registrar a assinatura com o status desconhecido. A mudança de status SHALL seguir o ciclo de provider de `thinkzap/ciclo-provider-spa-assinatura`: `Vencido` não desassina linha; voltar a `Ativo` assina as linhas ativas.

#### Scenario: Renovação perdida
- **WHEN** o Stripe renovou a assinatura até 28/11 e a SPA ainda tem fim do período em 28/10
- **THEN** a SPA passa a ter o período até 28/11, e a rodada registra a atualização

#### Scenario: Inadimplência perdida
- **WHEN** a assinatura está `past_due` no Stripe e `Ativo` na SPA
- **THEN** a SPA passa a `Vencido` e nenhuma linha é desassinada

#### Scenario: Já sincronizada
- **WHEN** status e fim do período da SPA já concordam com o Stripe
- **THEN** nada é gravado na SPA e nada é registrado para a assinatura

### Requirement: Cancelamento no Stripe cancela na SPA e desassina
Quando o Stripe responde `canceled` e a SPA não está `Cancelado`, a sincronização SHALL gravar `Cancelado` e desassinar no provider as linhas da assinatura, como o evento `subscription.deleted` do webhook. Linhas com a marca de desassinado SHALL NOT ser desassinadas de novo. Se a gravação de `Cancelado` falhar, as linhas SHALL NOT ser desassinadas e a assinatura SHALL ser tentada de novo na próxima rodada.

#### Scenario: Cancelamento perdido
- **WHEN** a assinatura foi cancelada no Stripe, o webhook não chegou e a SPA está `Ativo` com duas linhas assinadas
- **THEN** a SPA passa a `Cancelado` e as duas linhas são desassinadas no provider

#### Scenario: Falha ao gravar o cancelamento
- **WHEN** a gravação de `Cancelado` falha no Bitrix
- **THEN** nenhuma linha é desassinada e a assinatura é tentada de novo na próxima rodada

### Requirement: Assinatura não encontrada no Stripe só é registrada
Quando o Stripe responde que a assinatura não existe, a sincronização SHALL NOT alterar a SPA e SHALL registrar a assinatura como falha "não encontrada no Stripe", com o id do gateway. Erros de comunicação com o Stripe (rede, chave inválida, limite) SHALL ser registrados como falha da assinatura, e as demais SHALL seguir.

#### Scenario: Id do gateway de outra conta
- **WHEN** uma assinatura com ambiente vazio tem um id do gateway que só existe na conta de teste
- **THEN** a SPA não muda e a rodada registra "não encontrada no Stripe" para ela

#### Scenario: Stripe fora do ar para uma assinatura
- **WHEN** a leitura de uma assinatura no Stripe falha por rede
- **THEN** essa assinatura é registrada como falha e as seguintes são sincronizadas

### Requirement: Agendamento e ambiente
A sincronização SHALL rodar a cada hora no minuto 30, com lock próprio para rodar em uma só instância. Ela SHALL estar desligada quando a chave Stripe não é de produção ou quando os efeitos de provider estão desligados, salvo `STRIPE_SYNC_ENABLED=true` explícito; `STRIPE_SYNC_ENABLED=false` SHALL desligá-la sempre. Desligada, a rodada agendada SHALL NOT ser agendada, e o "Rodar agora" SHALL responder `409`.

#### Scenario: Homologação
- **WHEN** homologação sobe com chave Stripe de teste e efeitos de provider desligados
- **THEN** a sincronização não é agendada e o "Rodar agora" responde `409`

#### Scenario: Duas instâncias
- **WHEN** duas instâncias de produção chegam ao minuto 30 ao mesmo tempo
- **THEN** só uma delas sincroniza

### Requirement: Toda rodada é registrada
O sistema SHALL registrar toda rodada da sincronização, agendada ou manual, mesmo sem alterações, com:
- início, fim, gatilho e, no manual, o usuário que disparou;
- contadores: ids do gateway lidos, assinaturas atualizadas, canceladas, linhas desassinadas, não encontradas e falhas;
- resultado `success` ou `failed` (falha geral, com a mensagem).

Para cada assinatura alterada, ou com falha, o sistema SHALL registrar: a ação (atualização, cancelamento, linha desassinada, não encontrada, status desconhecido ou falha), o id da assinatura na SPA, o id do gateway, o status anterior e o novo, o fim do período anterior e o novo, o item e o provider nas linhas, e a mensagem de erro. O histórico SHALL ser apagado depois de 90 dias. Uma rodada agendada que não pega o lock SHALL NOT ser registrada.

#### Scenario: Rodada sem divergência
- **WHEN** todas as assinaturas já concordam com o Stripe
- **THEN** existe um registro `success` com os contadores de alteração em zero

#### Scenario: Rodada com cancelamento
- **WHEN** a rodada cancela uma assinatura e desassina duas linhas
- **THEN** o registro tem `cancelled = 1`, `linesUnsubscribed = 2`, e o detalhe tem a ação de cancelamento e as duas linhas

### Requirement: Backoffice da sincronização
O backoffice SHALL ter a página `/admin/jobs/sincronizacao-stripe`, acessível pelo catálogo e só com sessão do portal; a API SHALL responder `401` sem sessão e `404` para rodada inexistente. A página SHALL:
- mostrar nome, periodicidade e saúde do job, com link de volta ao catálogo;
- listar as rodadas da mais recente para a mais antiga, paginadas, com início, duração, gatilho, quem disparou, resultado e contadores;
- abrir o detalhe de uma rodada com as ações agrupadas por tipo e links para a assinatura na SPA 1142 e para o item na SPA 1146;
- ter "Rodar agora" com confirmação, que dispara a mesma sincronização com o mesmo lock, responde logo com o id da rodada e `409` quando outra rodada está em andamento ou a sincronização está desligada.

#### Scenario: Ver o que foi corrigido
- **WHEN** o time abre uma rodada que atualizou o período de uma assinatura
- **THEN** o detalhe mostra a assinatura, o id do gateway e o fim do período anterior e o novo

#### Scenario: Rodar agora com rodada em andamento
- **WHEN** "Rodar agora" é confirmado enquanto a rodada agendada está sincronizando
- **THEN** a API responde `409` e a tela avisa que já há uma rodada em andamento
