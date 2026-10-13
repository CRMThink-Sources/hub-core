# Spec Delta

## ADDED Requirements

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
