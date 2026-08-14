---
category: integration
audience: suporte
summary: Não foi possível confirmar se uma mensagem enviada pelo widget saiu para o contato.
---
# thinkzap.message.widget_send_unknown

## O que significa
Uma mensagem enviada pelo widget chegou ao ponto de ser transmitida ao provider, mas **a resposta nunca voltou** — timeout, queda de rede, ou o processo morreu no meio da chamada.

O sistema não sabe, e não tem como saber localmente, se a mensagem foi entregue. Ela pode estar no WhatsApp do contato agora mesmo.

**O sistema não reenvia neste caso, e isso é deliberado.** Reenviar trocaria uma incerteza rara por duplicidade garantida no WhatsApp do cliente do parceiro, que ninguém desfaz. O operador foi avisado na timeline com um texto que pede conferência antes de reenviar.

## Causa provável
- Instabilidade de rede entre a nossa API e o provider.
- Provider com latência acima do timeout configurado.
- Container de worker reiniciado (deploy, OOM, kill) exatamente durante a chamada.

## Como verificar
1. Na tela de Logs, filtre pelo `traceKey` e confirme `código de erro: thinkzap.message.widget_send_unknown`.
2. Leia `destination` e `subscriptionItemId`.
3. **Confirme com o parceiro se a mensagem apareceu na conversa do contato** — é a única fonte de verdade aqui.
4. Se houve deploy ou reinício de worker no horário do evento, isso explica o caso.

## Como resolver
1. Orientar o parceiro a abrir a conversa com o contato e verificar se a mensagem consta.
2. Se **não** consta: reenviar normalmente pelo widget.
3. Se consta: nenhuma ação — a mensagem foi entregue e só a confirmação se perdeu.
4. Registrar o caso. Ocorrências isoladas são esperadas; recorrência não é.

## Quando escalar
Escale se este código aparecer mais de uma vez por semana no mesmo portal, ou se aparecer em lote. Recorrência aponta para instabilidade de rede com o provider ou para worker sendo reiniciado com frequência, e ambos são investigação de infraestrutura. Anexe: `traceKey`, `código de erro: thinkzap.message.widget_send_unknown`, domínio/portal, horários das ocorrências e se houve deploy no período.
