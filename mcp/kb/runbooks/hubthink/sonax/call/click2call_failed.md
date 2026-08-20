---
category: integration
audience: suporte
summary: Falha ao acionar a discagem (click2call) no Sonax, então a ligação não foi iniciada.
---
# sonax.call.click2call_failed

## O que significa
O click2call é o recurso que inicia uma ligação direto do card no Bitrix24, com um clique. Quando acionado, o Sonax pede ao SonaVoip para começar a chamada.

Esse erro quer dizer que esse acionamento falhou: a discagem não foi iniciada. Como costuma ser uma falha momentânea, geralmente vale tentar de novo.

## Causa provável
- **Instância de telefonia indisponível**: a instância do parceiro estava fora do ar ou instável no momento.
- **Falha momentânea de comunicação** com o SonaVoip ao iniciar a chamada.
- **Configuração de telefonia incompleta**: falta algum dado necessário para a discagem.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.call.click2call_failed`.
3. Verifique se a instância de telefonia do parceiro está ativa e se o erro se repete a cada tentativa.

## Como resolver
1. Confirme que a instância de telefonia do parceiro está provisionada e ativa.
2. Peça ao parceiro para tentar a discagem novamente pelo card.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se a instância está ativa e a discagem continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.call.click2call_failed`, domínio do parceiro e o horário do evento.
