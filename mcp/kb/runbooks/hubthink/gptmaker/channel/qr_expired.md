---
category: validation
audience: suporte
summary: O QR Code do canal expirou antes de o parceiro parear o aparelho.
---
# gptmaker.channel.qr_expired

## O que significa
O QR Code gerado para conectar o canal expirou antes de o parceiro lê-lo com o aparelho. O QR tem validade curta por segurança.

## Causa provável
- O parceiro demorou para ler o QR Code.
- A tela de Conexão ficou aberta parada até o QR vencer.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.channel.qr_expired`.

## Como resolver
1. Oriente o parceiro a **gerar um novo QR Code** na tela de Conexão.
2. Peça para ler o QR com o aparelho **logo em seguida**, sem demora.
3. Confirme na tela de Logs que o canal conectou.

## Quando escalar
Se o parceiro lê o novo QR rapidamente e mesmo assim expira sempre, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.channel.qr_expired`, domínio do parceiro e o horário do evento.
