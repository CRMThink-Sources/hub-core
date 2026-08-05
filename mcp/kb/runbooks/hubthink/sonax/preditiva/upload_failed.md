---
category: integration
audience: suporte
summary: Falha ao enviar os contatos para o Sonax, então a campanha não foi carregada.
---
# sonax.preditiva.upload_failed

## O que significa
Antes de a discagem preditiva começar, os contatos precisam ser enviados ao Sonax para carregar a campanha.

Esse erro quer dizer que esse envio dos contatos falhou, e a campanha não foi carregada. Como costuma ser uma falha momentânea, geralmente vale tentar de novo.

## Causa provável
- **Instabilidade momentânea** do Sonax no momento do envio.
- **Falha temporária de comunicação** ao transferir os contatos.
- **Volume ou dados que interromperam o envio** no meio do processo.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.preditiva.upload_failed`.
3. Verifique se o erro é pontual ou se está se repetindo a cada tentativa de envio.

## Como resolver
1. Peça ao parceiro para tentar reenviar os contatos da campanha após alguns minutos.
2. Confira se a campanha e a lista de contatos continuam válidas.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o envio continua falhando após novas tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.preditiva.upload_failed`, domínio do parceiro e o horário do evento.
