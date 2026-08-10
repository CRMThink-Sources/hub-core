---
category: integration
audience: suporte
summary: Não foi possível preparar a linha para o envio.
---
# thinkzap.provisioning.instance_ensure_failed

## O que significa
Antes de enviar, o app thinkzap precisa garantir que a linha de WhatsApp está pronta (provisionada e disponível). Este erro indica que esse preparo não pôde ser concluído, então o envio não seguiu. Costuma ser uma falha passageira na preparação da linha.

## Causa provável
- **Instabilidade momentânea**: a preparação da linha falhou por um erro passageiro.
- **Linha em estado inconsistente**: a linha não estava pronta para receber o envio no momento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.provisioning.instance_ensure_failed`.
3. Leia na linha do log qual linha estava envolvida e a mensagem devolvida.

## Como resolver
1. Peça ao parceiro para repetir a operação em alguns instantes (o erro costuma ser passageiro).
2. Confirme na aba Conexão que a linha está ativa e conectada; se não estiver, oriente a reconectar (ler o QR Code).
3. Após reprovar a operação, confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a linha está ativa e conectada e o preparo continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.provisioning.instance_ensure_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e o id da linha.
