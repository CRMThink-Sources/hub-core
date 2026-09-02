---
category: config
audience: suporte
summary: "Uma campanha de SMS foi disparada por um provedor de mensagem que não corresponde a nenhuma linha desta instalação."
---
# thinkzap.bitrix.sms_sender_unknown

## O que significa
O app thinkzap registra a linha de WhatsApp do parceiro como **provedor de mensagem** no Bitrix24 dele, e é isso que faz a linha aparecer em Marketing → Campanha de SMS. Este erro indica que o Bitrix disparou uma campanha por um provedor cujo código não corresponde a nenhuma linha da instalação — um **provedor órfão**.

Nenhuma mensagem saiu, nada foi cobrado, e o Bitrix marca aquele destinatário como falho na tela da campanha. Como o Bitrix chama o provedor uma vez **por destinatário**, uma campanha inteira disparada por um provedor órfão produz um erro por contato.

## Causa provável
- **A linha foi cancelada ou removida** depois de o provedor ter sido registrado. A remoção do provedor não é automática, então ele continua na lista de campanha do cliente apontando para uma linha que não existe mais.
- **O provedor foi registrado em outra instalação** e o portal foi migrado ou reinstalado.
- **O prefixo de código mudou de ambiente** (`BITRIX_SMS_SENDER_CODE_PREFIX`), e o provedor antigo ficou para trás com o prefixo anterior.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.sms_sender_unknown` e leia o `code` registrado — é o código do provedor que o Bitrix usou.
3. No portal admin, abra o cliente → aba **Provedor SMS**. O provedor com aquele código aparece marcado como **Órfão**.

## Como resolver
1. Na aba **Provedor SMS**, remova o provedor marcado como órfão. É a única ação que o tira da lista de campanha do Bitrix do cliente.
2. Se o parceiro ainda precisa disparar campanha, abra a linha desejada no modal de linha e use **Registrar provedor**.
3. Peça para o parceiro refazer a campanha escolhendo o provedor da linha correta e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o provedor **não** aparecer como órfão na tela (ou seja, o código bate com uma linha existente) e o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bitrix.sms_sender_unknown`, domínio/portal do parceiro, horário do evento, e-mail da conta e o `code` do provedor registrado no log.
