# Spec Delta

## MODIFIED Requirements

### Requirement: Cancelar a assinatura desassina as linhas no provider
Quando um item da SPA 1142 é atualizado e o status lido da assinatura é `cancelled`, o sistema SHALL desassinar no provider o recurso de cada item da SPA 1146 vinculado àquela assinatura, se:

- o item tem credencial completa (Z-API: instância e token; HubMessage: canal);
- o recurso não tem a marca de desassinado.

Isso vale para itens `active` e `cancelled` e para assinaturas `manual` e `stripe`. Desassinar SHALL cancelar a cobrança do recurso no provider: na Z-API, o cancelamento on-demand da instância; na HubMessage, o cancelamento do canal. SHALL NOT desconectar a sessão do WhatsApp nem apagar o recurso. O status do item na SPA 1146 SHALL NOT ser alterado.

Depois de cada desassinatura bem-sucedida, o sistema SHALL gravar a marca de desassinado. A falha em um item SHALL NOT impedir a desassinatura dos outros. Se algum item falhar, o job SHALL ser retentado, e o retry SHALL NOT desassinar de novo os itens que já têm a marca.

Pelo evento da SPA, só o status `cancelled` desassina. Com a assinatura em `active`, `past_due`, `trialing` ou `trial_expired`, nenhum recurso é desassinado por este requisito. A única outra desassinatura por assinatura é a da verificação de assinaturas, para manuais `Vencido` há 5 dias ou mais (ver `pagamentos/expiracao-assinatura`). Ela usa a mesma operação e a mesma marca, então o cancelamento posterior dessa assinatura não chama o provider de novo para as linhas já desassinadas.

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
- **THEN** o evento da SPA não desassina nenhuma linha e as linhas assinadas continuam assinadas até o quinto dia da verificação

#### Scenario: Cancelamento depois da desassinatura por vencimento
- **WHEN** a verificação desassinou as duas linhas de uma manual `Vencido` no quinto dia e grava `Cancelado` no décimo
- **THEN** o UPDATE da SPA 1142 com `cancelled` encontra as duas linhas com a marca de desassinado e nada é chamado no provider

#### Scenario: Item sem credencial é ignorado
- **WHEN** a assinatura é cancelada e um dos itens nunca foi provisionado (sem credencial)
- **THEN** esse item é ignorado sem erro e os demais são desassinados

#### Scenario: Homolog não desassina recurso de produção
- **WHEN** homolog recebe o UPDATE de uma assinatura cancelada com os efeitos de provider desligados
- **THEN** nada é desassinado no provider
