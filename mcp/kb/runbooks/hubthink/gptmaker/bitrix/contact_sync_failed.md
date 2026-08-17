---
category: integration
audience: suporte
summary: O contato não foi criado ou atualizado no CRM do Bitrix24.
---
# gptmaker.bitrix.contact_sync_failed

## O que significa
O GPT Maker tentou criar ou atualizar o contato da conversa no Bitrix24 e a operação falhou. O atendimento continua, mas o contato pode não ter sido registrado no CRM.

## Causa provável
- Instabilidade momentânea de comunicação com o Bitrix24.
- O portal do parceiro estava indisponível no momento.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.bitrix.contact_sync_failed`.
3. Verifique se o erro foi pontual ou se repete.

## Como resolver
1. Se foi momentâneo, a sincronização costuma concluir na próxima interação da conversa.
2. Peça ao parceiro para conferir se o contato aparece no CRM após novas mensagens.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o contato segue não sendo registrado no CRM em várias tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.bitrix.contact_sync_failed`, domínio do parceiro e o horário do evento.
