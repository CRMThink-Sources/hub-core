---
category: validation
audience: suporte
summary: Esta linha está sem assinatura ativa ou com o período de teste encerrado.
---
# thinkzap.line.blocked

## O que significa
A linha existe, mas está bloqueada para uso porque não há assinatura ativa: ou o período de teste terminou, ou a assinatura não está vigente. Enquanto estiver assim, a linha não envia nem recebe. Não é falha técnica: é uma questão de contratação. Nenhuma cobrança indevida ocorreu — a linha apenas ficou inativa por falta de plano vigente.

## Causa provável
- **Período de teste encerrado**: o teste chegou ao fim e nenhuma assinatura foi contratada em seguida.
- **Assinatura não vigente**: a assinatura da linha não está ativa no momento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.blocked`.
3. Confira o estado da linha e da assinatura: a linha aparece bloqueada por falta de plano vigente.

## Como resolver
1. Oriente o parceiro a contratar ou reativar a assinatura da linha.
2. Com a assinatura ativa, a linha volta a ficar disponível; peça para repetir a operação.
3. Confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a assinatura constar como ativa e a linha continuar bloqueada, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.blocked`, domínio do parceiro, o e-mail da conta, o horário do evento e o identificador da linha.
