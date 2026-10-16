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
A verificação SHALL alterar só assinaturas `Em teste` e `Ativo` (manual). Assinaturas `Vencido`, `Cancelado` e `Teste expirado` SHALL NOT ser alteradas. A verificação SHALL NOT mexer em nenhum campo além do status.

#### Scenario: Assinatura já vencida
- **WHEN** uma assinatura `Vencido` tem o fim do período no passado
- **THEN** nada é gravado nela

#### Scenario: Só o status muda
- **WHEN** uma assinatura manual passa para `Vencido`
- **THEN** o plano, o período, a modalidade e o id do gateway ficam como estavam

### Requirement: Mudança de status segue o ciclo de provider existente
Depois de gravar o status, as linhas da assinatura SHALL seguir as regras de `thinkzap/ciclo-provider-spa-assinatura`. `Vencido` e `Teste expirado` bloqueiam as linhas no app e SHALL NOT desassinar nada no provider. Voltar a assinatura para `Ativo` com um novo período SHALL habilitar as linhas de novo.

#### Scenario: Manual vencida bloqueia sem desassinar
- **WHEN** a verificação passa uma assinatura manual para `Vencido`
- **THEN** as linhas dela deixam de ser habilitadas no app
- **AND** nenhuma linha é desassinada no provider

#### Scenario: Pagamento regularizado
- **WHEN** o time muda a assinatura `Vencido` para `Ativo` e põe um fim de período no futuro
- **THEN** as linhas voltam a ser habilitadas e a próxima verificação não muda o status

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
