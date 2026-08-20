---
category: integration
audience: suporte
summary: Falha ao conectar o canal de conversa do GPT Maker.
---
# gptmaker.channel.connect_failed

## O que significa
A tentativa de conectar o canal de conversa do parceiro falhou. Diferente do QR expirado, aqui a conexão nem chegou a se estabelecer.

## Causa provável
- Falha momentânea de comunicação ao estabelecer a conexão.
- O aparelho ou o canal estava indisponível no momento.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.channel.connect_failed`.
3. Verifique se o erro se repete a cada tentativa.

## Como resolver
1. Oriente o parceiro a tentar conectar o canal novamente pela tela de Conexão.
2. Confirme que o aparelho está online e com internet estável.
3. Acompanhe na tela de Logs se a conexão se estabelece.

## Quando escalar
Se a conexão continua falhando após novas tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.channel.connect_failed`, domínio do parceiro e o horário do evento.
