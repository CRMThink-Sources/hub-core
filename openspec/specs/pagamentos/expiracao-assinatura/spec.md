# pagamentos/expiracao-assinatura Specification

## Purpose

Define como o sistema atualiza sozinho o status das assinaturas da SPA 1142 quando o período delas (`UF_CRM_91_CURRENT_PERIOD_END`) termina, para que o CRM mostre a situação real e linhas vencidas deixem de ficar habilitadas.

## Requirements

### Requirement: Trial com período encerrado vira Teste expirado
O sistema SHALL verificar as assinaturas da SPA 1142 pelo menos uma vez por hora. Toda assinatura com status `Em teste` cujo período já terminou SHALL ter o status trocado para `Teste expirado`. O período termina ao fim do último dia de `UF_CRM_91_CURRENT_PERIOD_END`: o último dia conta inteiro, com o dia lido no mesmo fuso que a leitura de habilitação usa hoje. Isso vale para qualquer modalidade. A carência da assinatura manual SHALL NOT ser aplicada ao trial.

#### Scenario: Trial vencido ontem
- **WHEN** uma assinatura está `Em teste` com fim do período no dia anterior
- **THEN** o status dela na SPA passa para `Teste expirado`

#### Scenario: Trial no último dia
- **WHEN** uma assinatura está `Em teste` e hoje é o dia do fim do período
- **THEN** o status continua `Em teste`

### Requirement: Assinatura manual com período encerrado vira Vencido
Toda assinatura com status `Ativo` e modalidade `manual` SHALL ter o status trocado para `Vencido` quando o período terminou há mais que os dias de carência configurados. A carência é configurável por ambiente, em dias inteiros, e o padrão é `0`. Uma assinatura sem modalidade preenchida é `manual`.

Assinaturas com modalidade `stripe` SHALL NOT ser alteradas por esta verificação.

#### Scenario: Manual vencida sem carência
- **WHEN** a carência é `0` e uma assinatura manual `Ativo` tem fim do período no dia anterior
- **THEN** o status dela na SPA passa para `Vencido`

#### Scenario: Manual dentro da carência
- **WHEN** a carência é `3` e uma assinatura manual `Ativo` terminou o período há dois dias
- **THEN** o status continua `Ativo`

#### Scenario: Manual depois da carência
- **WHEN** a carência é `3` e uma assinatura manual `Ativo` terminou o período há quatro dias
- **THEN** o status passa para `Vencido`

#### Scenario: Renovação antes do vencimento
- **WHEN** a automação de cobrança empurra o fim do período de uma assinatura manual `Ativo` para o mês seguinte antes da data
- **THEN** o status continua `Ativo`

#### Scenario: Assinatura Stripe vencida
- **WHEN** uma assinatura `Ativo` de modalidade `stripe` tem o fim do período no passado
- **THEN** o status não é alterado por esta verificação

### Requirement: Outros status não são alterados
A verificação SHALL alterar o status só de:
- assinaturas `Em teste` (para `Teste expirado`);
- assinaturas `Ativo` manuais (para `Vencido`);
- assinaturas `Vencido` manuais (para `Cancelado`, conforme o requisito do décimo dia).

Assinaturas `Cancelado` e `Teste expirado` SHALL NOT ter o status alterado. Assinaturas Stripe SHALL NOT ter o status alterado.

Além do status, a verificação SHALL gravar só:
- a data "Vencido em";
- a data de cancelamento, quando grava `Cancelado`.

Plano, período, modalidade e id do gateway SHALL NOT ser alterados.

#### Scenario: Assinatura já vencida
- **WHEN** uma assinatura manual `Vencido` tem o fim do período no passado e "Vencido em" de dois dias atrás
- **THEN** nada é gravado nela

#### Scenario: Assinatura já cancelada
- **WHEN** uma assinatura `Cancelado` tem o fim do período no passado
- **THEN** nada é gravado nela

#### Scenario: Teste expirado continua como está
- **WHEN** uma assinatura está `Teste expirado` há 30 dias
- **THEN** nada é gravado nela

#### Scenario: Só o status muda
- **WHEN** uma assinatura manual passa para `Vencido`
- **THEN** o status e a data "Vencido em" mudam, e o plano, o período, a modalidade e o id do gateway ficam como estavam

### Requirement: Mudança de status segue o ciclo de provider existente
Depois de gravar o status, as linhas da assinatura SHALL seguir as regras de `thinkzap/ciclo-provider-spa-assinatura`. `Teste expirado` bloqueia as linhas no app e SHALL NOT desassinar nada no provider. `Vencido` bloqueia as linhas no app e SHALL NOT desassinar nada **no momento em que é gravado**. A desassinatura das linhas de uma assinatura `Vencido` acontece só pelo requisito do quinto dia. Voltar a assinatura para `Ativo` com um novo período SHALL habilitar as linhas de novo e assiná-las de novo no provider.

#### Scenario: Manual vencida bloqueia sem desassinar
- **WHEN** a verificação passa uma assinatura manual para `Vencido`
- **THEN** as linhas dela deixam de ser habilitadas no app
- **AND** nenhuma linha é desassinada no provider nessa rodada

#### Scenario: Pagamento regularizado
- **WHEN** o time muda a assinatura `Vencido` para `Ativo` e põe um fim de período no futuro, dois dias depois do vencimento
- **THEN** as linhas voltam a ser habilitadas, nenhuma linha foi desassinada, e a próxima verificação não muda o status

#### Scenario: Pagamento regularizado depois da desassinatura
- **WHEN** o time muda para `Ativo` uma assinatura que estava `Vencido` havia 7 dias, com as linhas já desassinadas
- **THEN** as linhas `active` dela são assinadas de novo no provider, como na reativação de assinatura cancelada

### Requirement: Só o ambiente habilitado grava status
A verificação SHALL ter uma flag de ambiente que a liga. Com a flag desligada (homolog), nenhum status SHALL ser gravado. Se o processo roda em mais de uma instância, cada rodada SHALL ser executada por uma só delas.

#### Scenario: Homolog não grava
- **WHEN** homolog está com a verificação desligada e existe um trial vencido no portal
- **THEN** homolog não grava nada na SPA

#### Scenario: Duas instâncias da API
- **WHEN** duas instâncias de produção chegam ao horário da verificação ao mesmo tempo
- **THEN** só uma delas varre e grava

### Requirement: Falha em uma assinatura não trava as outras
Um erro ao ler ou gravar uma assinatura SHALL ser registrado em log e SHALL NOT impedir que as outras sejam processadas. Uma assinatura com dados inválidos na SPA SHALL ser ignorada na rodada. A assinatura que falhou SHALL ser tentada de novo na rodada seguinte.

#### Scenario: Erro ao gravar uma assinatura
- **WHEN** a gravação do status da primeira de duas assinaturas vencidas falha no Bitrix
- **THEN** a segunda é atualizada mesmo assim
- **AND** a primeira é tentada de novo na próxima rodada

### Requirement: Data de vencimento registrada na assinatura
A SPA 1142 SHALL ter o campo "Vencido em" (`UF_CRM_91_PAST_DUE_AT`), guardado como dia de calendário, como o fim do período. A verificação SHALL:
- gravar a data de hoje no campo, junto com o status, ao passar uma assinatura manual para `Vencido`;
- gravar a data de hoje em toda assinatura manual `Vencido` com o campo vazio, que pode ter sido vencida à mão no CRM ou antes deste requisito existir;
- limpar o campo de toda assinatura que não está `Vencido` e tem o campo preenchido.

"Hoje" é o dia de calendário no mesmo fuso que a leitura de habilitação usa.

#### Scenario: Vencimento pela verificação
- **WHEN** a verificação passa uma assinatura manual `Ativo` para `Vencido` em 03/11
- **THEN** a assinatura fica `Vencido` com "Vencido em" = 03/11

#### Scenario: Vencida à mão pelo time
- **WHEN** o time muda uma assinatura manual para `Vencido` no CRM em 03/11, e a verificação roda às 14h do mesmo dia
- **THEN** a assinatura recebe "Vencido em" = 03/11

#### Scenario: Assinatura volta para Ativo
- **WHEN** uma assinatura com "Vencido em" = 03/11 volta para `Ativo`
- **THEN** a próxima verificação limpa "Vencido em"
- **AND** se ela vencer de novo em 20/12, a contagem dos dias começa em 20/12

### Requirement: Linhas desassinadas a partir do quinto dia de vencimento
Toda assinatura **manual** `Vencido` cuja data "Vencido em" é de 5 dias atrás ou mais SHALL ter desassinado no provider o recurso de cada item da SPA 1146 vinculado a ela. A regra vale para itens `active` e `cancelled` com credencial completa e sem a marca de desassinado. A desassinatura SHALL usar a mesma operação do cancelamento: cancelamento on-demand na Z-API, cancelamento do canal na HubMessage. Ela SHALL NOT desconectar o WhatsApp nem apagar o recurso. Depois de cada desassinatura bem-sucedida, o sistema SHALL gravar a marca de desassinado. O status da assinatura SHALL continuar `Vencido`, e o status dos itens SHALL NOT mudar.

A falha em um item SHALL NOT impedir os outros. O item que falhou SHALL ser tentado de novo na rodada seguinte, sem repetir os que já têm a marca.

#### Scenario: Quinto dia
- **WHEN** uma assinatura manual está `Vencido` com "Vencido em" = 03/11, tem uma linha Z-API e uma HubMessage assinadas, e a verificação roda em 08/11
- **THEN** a instância é cancelada na Z-API e o canal é cancelado na HubMessage
- **AND** as duas linhas recebem a marca de desassinado e a assinatura continua `Vencido`

#### Scenario: Quarto dia
- **WHEN** a verificação roda em 07/11 para a mesma assinatura
- **THEN** nenhuma linha é desassinada

#### Scenario: Rodadas seguintes não repetem
- **WHEN** a verificação roda de novo em 08/11 e em 09/11, com as duas linhas já marcadas como desassinadas
- **THEN** nada é chamado no provider

#### Scenario: Falha em uma linha
- **WHEN** o cancelamento da linha Z-API falha no quinto dia
- **THEN** a linha HubMessage é desassinada mesmo assim
- **AND** a próxima rodada tenta só a linha Z-API

#### Scenario: Stripe vencida não entra
- **WHEN** uma assinatura Stripe está `Vencido` há 6 dias
- **THEN** nenhuma linha dela é desassinada por esta verificação

### Requirement: Cancelamento a partir do décimo dia de vencimento
Toda assinatura **manual** `Vencido` cuja data "Vencido em" é de 10 dias atrás ou mais SHALL passar para `Cancelado`, com a data de cancelamento (`UF_CRM_91_CANCELED_AT`) igual a hoje. A gravação dispara o ciclo de cancelamento de `thinkzap/ciclo-provider-spa-assinatura`. As linhas já marcadas como desassinadas SHALL NOT ser desassinadas de novo. As que falharam no quinto dia SHALL ser desassinadas por esse ciclo.

#### Scenario: Décimo dia
- **WHEN** uma assinatura manual está `Vencido` com "Vencido em" = 03/11, as linhas já desassinadas, e a verificação roda em 13/11
- **THEN** a assinatura passa para `Cancelado` com data de cancelamento 13/11
- **AND** nada é chamado no provider

#### Scenario: Linha que ficou para trás
- **WHEN** no décimo dia uma das linhas ainda não tem a marca de desassinado
- **THEN** a assinatura passa para `Cancelado` e o ciclo de cancelamento desassina essa linha

#### Scenario: Falha ao gravar o cancelamento
- **WHEN** a gravação de `Cancelado` falha no Bitrix
- **THEN** a assinatura continua `Vencido` e é tentada de novo na próxima rodada

### Requirement: Reconciliação diária das linhas assinadas
Uma vez por dia, na primeira rodada agendada a partir das 03:00 no fuso do portal, e em toda rodada disparada pelo "Rodar agora", a verificação SHALL chamar o subscribe no provider para cada item `active` com credencial completa de toda assinatura `Ativo`, manual ou Stripe. A chamada SHALL acontecer **independentemente da marca de assinado**.

O sistema SHALL distinguir duas respostas do provider:
- "assinou agora": a linha estava sem assinatura e passou a ser cobrada. O sistema SHALL gravar a marca de assinado e registrar a linha na rodada;
- "já estava assinada": o sistema SHALL garantir a marca de assinado e não registrar a linha individualmente.

Itens `cancelled`, itens sem credencial e assinaturas em qualquer outro status SHALL NOT receber subscribe. A falha em um item SHALL NOT impedir os outros, e o item que falhou SHALL ser registrado como falha na rodada.

#### Scenario: Linha que estava sem assinatura
- **WHEN** a reconciliação roda e uma linha Z-API ativa de uma assinatura `Ativo` não tem assinatura on-demand na Z-API, embora tenha a marca de assinado
- **THEN** a linha é assinada na Z-API e a rodada registra a linha como "assinada agora"

#### Scenario: Linha já assinada
- **WHEN** a reconciliação roda e a HubMessage responde que o canal já está pago
- **THEN** nada é registrado para a linha além da contagem de linhas verificadas

#### Scenario: Rodadas horárias fora da janela
- **WHEN** a rodada agendada das 15:00 roda e a reconciliação do dia já aconteceu às 03:00
- **THEN** nenhuma chamada de subscribe é feita nessa rodada

#### Scenario: Vencida não é reconciliada
- **WHEN** a reconciliação roda e uma assinatura está `Vencido`
- **THEN** nenhuma linha dela recebe subscribe

### Requirement: Etapas de provider respeitam o ambiente
A desassinatura do quinto dia e a reconciliação SHALL rodar só quando os efeitos de provider estão ligados no ambiente (`THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED`). Com eles desligados, mesmo com a verificação ligada, a rodada SHALL gravar só status e datas na SPA, SHALL NOT chamar nenhum provider, e o registro da rodada SHALL indicar que as etapas de provider foram puladas.

#### Scenario: Verificação ligada e provider desligado
- **WHEN** um ambiente tem `SUBSCRIPTION_EXPIRATION_ENABLED=true` e `THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED=false`, e uma assinatura manual está `Vencido` há 6 dias
- **THEN** nada é desassinado no provider e a rodada registra as etapas de provider como puladas
