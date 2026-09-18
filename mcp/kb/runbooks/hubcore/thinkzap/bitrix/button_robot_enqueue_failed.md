---
category: internal
audience: suporte
summary: O robô de envio de botões não conseguiu registrar o envio de um destinatário.
---
# thinkzap.bitrix.button_robot_enqueue_failed

## O que significa
Um dos dois robôs de fluxo (Bizproc) que enviam mensagem com botões — WhatsApp Oficial ou Z-API — aceitou o disparo, mas falhou ao registrar o envio de **um** destinatário. Os demais destinatários daquele disparo seguiram normalmente — a falha é por destinatário, não do disparo inteiro.

Este erro é diferente de uma falha de entrega: aqui a mensagem nem chegou a entrar na fila de envio, então não haverá retentativa automática para esse destinatário.

## Causa provável
- **Telefone inválido**: o número resolvido (digitado na configuração ou vindo de um campo da entidade) não é um telefone de WhatsApp válido — campo com texto no lugar do número, ou número incompleto.
- **Falha momentânea de banco ou fila**: instabilidade passageira ao gravar a intenção de envio.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.button_robot_enqueue_failed`.
3. Leia na linha do log qual destinatário falhou e a mensagem devolvida — ela distingue telefone inválido de falha de infraestrutura.
4. Abra a entidade onde o fluxo rodou: a timeline mostra quantos envios foram registrados, e a diferença para o total esperado são os que falharam.

## Como resolver
1. Se foi telefone inválido: corrija o número no cadastro da entidade (ou o campo escolhido na configuração do robô) e reexecute o fluxo.
2. Se foi falha momentânea: reexecute o fluxo para a entidade afetada — os destinatários que já foram registrados serão enviados de novo.

## Quando escalar
Se o telefone estiver correto e a falha se repetir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bitrix.button_robot_enqueue_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta, qual dos dois robôs de botão foi usado, o id da linha configurada e a entidade onde o fluxo rodou.
