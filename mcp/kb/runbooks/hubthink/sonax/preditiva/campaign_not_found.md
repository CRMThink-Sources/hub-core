---
category: validation
audience: suporte
summary: A campanha informada não foi encontrada no Sonax, então a discagem não pôde ser montada.
---
# sonax.preditiva.campaign_not_found

## O que significa
A discagem preditiva sempre roda dentro de uma campanha. O Sonax usa a campanha informada para montar a lista e iniciar as ligações.

Esse erro quer dizer que a campanha informada não foi encontrada no Sonax. Sem uma campanha válida, a discagem não pôde ser montada.

## Causa provável
- **Campanha inexistente**: a campanha informada não existe no painel Sonax.
- **Campanha inativa ou encerrada**: a campanha existe, mas não está mais ativa.
- **Seleção incorreta**: foi escolhida uma campanha errada ou já removida.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.preditiva.campaign_not_found`.
3. Confira, no painel Sonax, se a campanha informada existe e está ativa.

## Como resolver
1. Peça ao parceiro para conferir, no painel Sonax, se a campanha existe e está ativa.
2. Se necessário, oriente a corrigir a seleção e escolher uma campanha válida.
3. Peça para reenviar a discagem e acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se a campanha existe e está ativa no Sonax, mas o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.preditiva.campaign_not_found`, domínio do parceiro e o horário do evento.
