---
category: validation
audience: suporte
summary: O contato não interage há mais de 24h; o WhatsApp Oficial só permite mensagem livre nessa janela.
---
# thinkzap.hubmessage.window_closed

## O que significa
O WhatsApp Oficial só permite enviar mensagens livres (texto escrito na hora) dentro de uma janela de 24 horas desde a última interação do contato. Como o contato não responde há mais de 24 horas, essa janela fechou. A partir daí, o WhatsApp Oficial exige um template aprovado para reabrir a conversa. Não é um erro do sistema: é uma regra do próprio WhatsApp Oficial.

## Causa provável
- **Janela de 24h expirada**: o contato não envia mensagem há mais de 24 horas.
- **Primeira abordagem**: o operador tenta iniciar a conversa com o contato, e o WhatsApp Oficial não permite texto livre nesse caso.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.hubmessage.window_closed`.
3. Confirme na conversa que a última mensagem do contato foi há mais de 24 horas.

## Como resolver
1. Oriente o operador a reabrir a conversa enviando um template aprovado, em vez de texto livre.
2. Assim que o contato responder ao template, a janela de 24 horas reabre e o texto livre volta a funcionar normalmente.
3. Se o parceiro ainda não tem templates aprovados, oriente-o a criar e aprovar um template para esse tipo de reabertura.

## Quando escalar
Este caso é uma regra do WhatsApp Oficial e normalmente não exige desenvolvimento. Escale apenas se o envio de template aprovado também falhar mesmo com a janela reconhecidamente fechada. Anexe: `traceKey`, `código de erro: thinkzap.hubmessage.window_closed`, domínio do parceiro, horário do evento e os ids envolvidos.
