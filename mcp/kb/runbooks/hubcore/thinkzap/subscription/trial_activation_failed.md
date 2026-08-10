---
category: internal
audience: suporte
summary: Não foi possível ativar o período de teste agora.
---
# thinkzap.subscription.trial_activation_failed

## O que significa
O cliente tentou iniciar o período de teste (trial), mas a ativação não pôde ser concluída no momento. Não há cobrança envolvida (é um teste); o efeito é que o teste não começou. Costuma ser uma falha passageira.

## Causa provável
- **Instabilidade momentânea**: um erro passageiro impediu a ativação do teste.
- **Falha interna no processamento**: algum passo da ativação do trial não terminou.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.trial_activation_failed`.
3. Leia na linha do log o e-mail/portal e a mensagem devolvida — indica se foi falha passageira ou algo persistente.

## Como resolver
1. Peça ao cliente para tentar ativar o período de teste novamente em alguns instantes (o erro costuma ser passageiro).
2. Confirme na tela de Logs que a nova tentativa não gerou o erro.
3. Se o teste ativar, confirme com o cliente que já pode conectar a linha (aba Conexão / QR Code).

## Quando escalar
Se a ativação do teste continuar falhando em novas tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.trial_activation_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e a mensagem devolvida.
