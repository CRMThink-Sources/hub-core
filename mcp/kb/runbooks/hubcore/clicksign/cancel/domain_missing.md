---
category: validation
audience: suporte
summary: O pedido de cancelar o documento chegou sem dizer de qual portal ele é.
---
# clicksign.cancel.domain_missing

## O que significa
Quando alguém pede pra cancelar um documento pela linha do tempo (a timeline) do negócio no Bitrix24, esse pedido chega até o CRMThink junto com a informação de qual portal do cliente ele pertence — é como um endereço de remetente. Esse erro quer dizer que o pedido chegou sem esse endereço. Sem saber de qual portal veio, o CRMThink não consegue descobrir de quem é o documento nem qual instalação do app usar, então o cancelamento não sai do lugar.

## Causa provável
- **Pedido incompleto vindo do Bitrix24** (mais comum, mas raro): por algum problema pontual, o Bitrix24 montou e enviou o pedido sem incluir o portal de origem — como uma carta postada sem o remetente.
- **Falha momentânea ao disparar a ação**: um soluço passageiro entre o clique na timeline e a chegada do pedido no CRMThink fez o dado se perder no caminho.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.cancel.domain_missing`.
3. Confirme no log que o cancelamento partiu mesmo de uma ação na timeline do negócio no Bitrix24, e não de outro caminho — assim você garante que o fluxo usado foi o correto.

## Como resolver
1. Peça ao parceiro pra refazer o cancelamento pela timeline do negócio no Bitrix24, porque como a causa costuma ser um soluço passageiro, uma nova tentativa quase sempre já monta o pedido completo.
2. Aguarde a nova tentativa terminar e olhe os Logs de novo pra ver se o erro repete — isso confirma se foi coisa pontual ou algo recorrente.
3. Se a segunda tentativa funcionou, o problema era momentâneo e está resolvido; não precisa fazer mais nada.

## Quando escalar
Se o erro repetir mesmo depois de refazer o cancelamento pela timeline, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.cancel.domain_missing`, domínio do parceiro e o horário do evento.
