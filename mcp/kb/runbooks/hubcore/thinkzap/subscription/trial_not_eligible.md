---
category: validation
audience: suporte
summary: Este portal não está elegível ao período de teste (já utilizado ou já possui assinatura).
---
# thinkzap.subscription.trial_not_eligible

## O que significa
Não é uma falha do sistema. O portal do cliente **não está elegível** ao período de teste — normalmente porque o teste já foi utilizado antes, ou porque o portal já possui uma assinatura ativa. O comportamento está correto; o teste simplesmente não se aplica a este caso.

## Causa provável
- **Teste já utilizado**: o portal já usou o período de teste anteriormente (o trial é uma única vez).
- **Assinatura já existente**: o portal já tem uma assinatura ativa, então não faz sentido oferecer teste.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.trial_not_eligible`.
3. Leia na linha do log o e-mail/portal e o motivo da inelegibilidade (teste já usado ou assinatura ativa).

## Como resolver
1. Explique ao cliente que o período de teste não está disponível para o portal, pois já foi utilizado ou o portal já possui assinatura.
2. Se o cliente quiser seguir usando, oriente-o a **contratar pela opção de assinatura**.
3. Esclareça eventuais dúvidas sobre planos e valores da assinatura.

## Quando escalar
Normalmente não requer escalonamento — é uma regra de negócio esperada. Escale apenas se o cliente afirmar que **nunca** usou o teste e **não** possui assinatura, e ainda assim aparecer inelegível. Nesse caso acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.trial_not_eligible`, domínio/portal do parceiro, horário do evento e e-mail da conta.
