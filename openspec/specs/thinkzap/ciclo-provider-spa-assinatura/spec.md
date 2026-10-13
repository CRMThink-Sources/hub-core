# thinkzap/ciclo-provider-spa-assinatura Specification

## Purpose

Define como os eventos da SPA 1146 (item de assinatura) e da SPA 1142 (assinatura) controlam o recurso da linha do ThinkZap no provider (Z-API ou HubMessage): provisionar, assinar, desassinar e limpar. Produção e homolog compartilham o portal Bitrix, então só o ambiente de produção pode agir no provider.

## Requirements

### Requirement: Só o ambiente com efeitos de provider habilitados age sobre eventos da SPA
A API SHALL ter uma flag de ambiente que liga ou desliga os efeitos de provider dos eventos da SPA. O padrão é ligada. Com a flag desligada (homolog/staging), o webhook da SPA SHALL:

- continuar validando o token;
- continuar invalidando o cache;
- continuar respondendo `200`;
- e SHALL NOT enfileirar nenhum job que toque o provider nos eventos ADD, UPDATE e DELETE da SPA 1146 e UPDATE da SPA 1142.

#### Scenario: Item criado no CRM é provisionado uma vez só
- **WHEN** um item é criado na SPA 1146 com provider `ZAPI` e sem credencial, e o portal entrega o evento `ONCRMDYNAMICITEMADD` para produção e para homolog
- **THEN** só produção cria a instância na Z-API e grava a credencial no item
- **AND** homolog responde `200` sem enfileirar provisionamento

#### Scenario: Homolog não cancela recurso de produção
- **WHEN** um item de produção tem o status alterado para `Cancelado` ou é excluído, e homolog recebe o evento
- **THEN** homolog não desassina, não desconecta e não cancela nada no provider

#### Scenario: Cache continua sendo invalidado em homolog
- **WHEN** homolog recebe qualquer evento da SPA 1146 ou 1142 com os efeitos de provider desligados
- **THEN** o cache das listagens daquela SPA é invalidado como hoje

### Requirement: Linha ativa sob assinatura paga é assinada no provider
Quando um item da SPA 1146 é atualizado, o sistema SHALL assinar o recurso do item no provider se todas as condições abaixo valerem:

- o status do item é `active`;
- o item tem credencial completa (Z-API: instância e token; HubMessage: canal);
- a assinatura pai (SPA 1142) tem status `active`;
- a assinatura pai não é trial;
- o recurso não tem marca de assinado.

Isso vale para assinaturas `manual` e `stripe`. Depois de o subscribe dar certo, o sistema SHALL gravar a marca de assinado. Se o subscribe falhar, a marca SHALL NOT ser gravada e o job SHALL ser retentado.

#### Scenario: Linha manual é assinada quando o item é atualizado
- **WHEN** a assinatura manual está `active` e o item dela (provider `HUBMESSAGE`, canal provisionado, status `active`, sem marca) recebe um UPDATE
- **THEN** o sistema chama o subscribe do canal na HubMessage e grava a marca de assinado

#### Scenario: Trial nunca é assinado
- **WHEN** a assinatura pai está `trialing` ou `trial_expired` e o item dela recebe um UPDATE
- **THEN** nada é assinado no provider

#### Scenario: UPDATE repetido não assina de novo
- **WHEN** um item que já tem a marca de assinado recebe um novo UPDATE (por exemplo, a própria API gravando `UF_CRM_93_CONNECTED`)
- **THEN** o sistema não chama o subscribe de novo

#### Scenario: Assinatura não ativa não assina
- **WHEN** a assinatura pai está `past_due` ou `cancelled` e o item recebe um UPDATE
- **THEN** nada é assinado no provider

### Requirement: Ativar a assinatura assina as linhas já existentes
Quando um item da SPA 1142 é atualizado, o sistema SHALL aplicar a regra de assinatura do requisito anterior a cada item da SPA 1146 vinculado àquela assinatura. A falha em um item SHALL NOT impedir a assinatura dos outros.

#### Scenario: Assinatura manual passada para ativa assina todas as linhas
- **WHEN** o time muda para `Ativo` o status de uma assinatura manual com duas linhas provisionadas (uma Z-API e uma HubMessage)
- **THEN** os dois recursos são assinados nos respectivos providers e os dois recebem a marca de assinado

#### Scenario: Falha em uma linha não trava as outras
- **WHEN** o subscribe da primeira linha falha no provider durante a ativação de uma assinatura
- **THEN** a segunda linha é assinada mesmo assim
- **AND** o job é retentado para assinar a primeira, sem assinar a segunda de novo

### Requirement: A marca de assinado acompanha todo caminho de subscribe e é limpa no unsubscribe
Todo subscribe bem-sucedido feito pelo produto SHALL gravar a marca de assinado do recurso. Isso inclui o checkout Stripe, a linha adicional, o provisionamento via SPA e os gatilhos das SPAs 1146 e 1142. Todo unsubscribe bem-sucedido SHALL limpar a marca. Regravar o espelho no provisionamento SHALL NOT apagar uma marca que já exista.

#### Scenario: Checkout Stripe marca as linhas
- **WHEN** o checkout Stripe ativa uma assinatura e assina as linhas dela
- **THEN** cada linha recebe a marca de assinado, e um UPDATE posterior nesses itens não assina de novo

#### Scenario: Desassinatura e reativação
- **WHEN** um item é cancelado (unsubscribe) e depois volta para `active` com a assinatura ainda ativa
- **THEN** a marca foi limpa no cancelamento, e a reativação assina de novo e grava a marca de novo

### Requirement: Cancelar a assinatura desassina as linhas no provider
Quando um item da SPA 1142 é atualizado e o status lido da assinatura é `cancelled`, o sistema SHALL desassinar no provider o recurso de cada item da SPA 1146 vinculado àquela assinatura, se:

- o item tem credencial completa (Z-API: instância e token; HubMessage: canal);
- o recurso não tem a marca de desassinado.

Isso vale para itens `active` e `cancelled` e para assinaturas `manual` e `stripe`. Desassinar SHALL cancelar a cobrança do recurso no provider: na Z-API, o cancelamento on-demand da instância; na HubMessage, o cancelamento do canal. SHALL NOT desconectar a sessão do WhatsApp nem apagar o recurso. O status do item na SPA 1146 SHALL NOT ser alterado.

Depois de cada desassinatura bem-sucedida, o sistema SHALL gravar a marca de desassinado. A falha em um item SHALL NOT impedir a desassinatura dos outros. Se algum item falhar, o job SHALL ser retentado, e o retry SHALL NOT desassinar de novo os itens que já têm a marca.

Só o status `cancelled` desassina. Com a assinatura em `active`, `past_due`, `trialing` ou `trial_expired`, nenhum recurso é desassinado por este requisito.

#### Scenario: Assinatura manual cancelada desassina todas as linhas
- **WHEN** o time muda para `Cancelado` o status de uma assinatura manual com duas linhas assinadas (uma Z-API e uma HubMessage)
- **THEN** a instância é cancelada na Z-API e o canal é cancelado na HubMessage
- **AND** as duas linhas recebem a marca de desassinado
- **AND** o status das duas linhas na SPA 1146 não muda

#### Scenario: Falha em uma linha não trava as outras
- **WHEN** o cancelamento da primeira linha falha no provider durante o cancelamento da assinatura
- **THEN** a segunda linha é desassinada mesmo assim
- **AND** o job é retentado para desassinar a primeira, sem desassinar a segunda de novo

#### Scenario: Assinatura Stripe já desassinada pelo gateway
- **WHEN** o gateway cancela uma assinatura Stripe, desassina as linhas e grava a marca, e em seguida chega o UPDATE da SPA 1142 com status `cancelled`
- **THEN** nada é chamado no provider

#### Scenario: UPDATE repetido da assinatura cancelada não desassina de novo
- **WHEN** uma assinatura já cancelada, com todas as linhas marcadas como desassinadas, recebe outro UPDATE na SPA 1142
- **THEN** nada é chamado no provider

#### Scenario: Inadimplência não desassina
- **WHEN** o status da assinatura muda para `past_due`
- **THEN** nenhuma linha é desassinada e as linhas assinadas continuam assinadas

#### Scenario: Item sem credencial é ignorado
- **WHEN** a assinatura é cancelada e um dos itens nunca foi provisionado (sem credencial)
- **THEN** esse item é ignorado sem erro e os demais são desassinados

#### Scenario: Homolog não desassina recurso de produção
- **WHEN** homolog recebe o UPDATE de uma assinatura cancelada com os efeitos de provider desligados
- **THEN** nada é desassinado no provider

### Requirement: Reativar a assinatura cancelada reassina as linhas ativas
Quando uma assinatura com linhas desassinadas volta para `active` e não é trial, o sistema SHALL assinar de novo no provider cada item `active` com credencial, e SHALL trocar a marca de desassinado pela de assinado. Itens `cancelled` SHALL continuar desassinados.

#### Scenario: Assinatura manual reativada
- **WHEN** uma assinatura manual cancelada, com uma linha `active` e uma linha `cancelled` (ambas desassinadas), volta para `Ativo`
- **THEN** só a linha `active` é assinada de novo no provider e recebe a marca de assinado
- **AND** a linha `cancelled` continua desassinada

### Requirement: Cancelar recurso já cancelado é tratado como sucesso
Quando o provider responde que o recurso já está cancelado ou que não há assinatura ativa para cancelar, o sistema SHALL tratar a desassinatura como bem-sucedida e gravar a marca de desassinado, sem retentar.

#### Scenario: Instância já cancelada na Z-API
- **WHEN** a assinatura é cancelada e a Z-API responde que a instância não tem assinatura ativa
- **THEN** a linha recebe a marca de desassinado e o job não falha por causa dela
