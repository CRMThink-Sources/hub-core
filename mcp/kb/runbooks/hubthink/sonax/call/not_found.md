---
category: validation
audience: suporte
summary: O evento se refere a uma chamada que não está no registro do portal, então não há o que atualizar ou encerrar.
---
# sonax.call.not_found

## O que significa
Ao longo de uma ligação, o Sonax recebe avisos de andamento e encerramento e precisa localizar a chamada correspondente para atualizá-la.

Esse erro quer dizer que o evento chegou se referindo a uma chamada que não está no registro do portal. Sem encontrar a chamada, não há o que atualizar ou encerrar. Na maioria das vezes isso é benigno: acontece quando um aviso chega duplicado ou fora de ordem.

## Causa provável
- **Evento duplicado**: o mesmo aviso chegou mais de uma vez.
- **Evento fora de ordem**: o aviso de encerramento chegou antes do registro da chamada, ou depois dela já ter sido removida.
- **Chamada nunca registrada**: a ligação de origem não chegou a ser criada no portal.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.call.not_found`.
3. Verifique se o parceiro relata algum problema real (chamadas sumindo) ou se são apenas eventos isolados nos Logs.

## Como resolver
1. Na maioria dos casos, nenhuma ação é necessária — é um evento benigno.
2. Se o parceiro relata que chamadas estão sumindo ou não aparecem no portal, reúna exemplos com data e horário.
3. Acompanhe se o padrão se repete com frequência incomum.

## Quando escalar
Escale apenas se o parceiro relatar chamadas realmente sumindo ou não sendo registradas. Acione a equipe de desenvolvimento e anexe: `traceKey`, `código de erro: sonax.call.not_found`, domínio do parceiro e o horário do evento.
