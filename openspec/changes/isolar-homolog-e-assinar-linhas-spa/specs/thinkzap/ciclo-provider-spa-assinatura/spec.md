# Spec Delta

## Purpose

Define como os eventos da SPA 1146 (item de assinatura) e da SPA 1142 (assinatura) controlam o recurso da linha do ThinkZap no provider (Z-API ou HubMessage): provisionar, assinar, desassinar e limpar. Produção e homolog compartilham o portal Bitrix, então só o ambiente de produção pode agir no provider.

## ADDED Requirements

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
