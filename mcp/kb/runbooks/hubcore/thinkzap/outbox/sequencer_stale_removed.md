---
category: internal
audience: dev
summary: Uma mensagem que não estava mais na fila ocupava a vez da linha e foi removida pela varredura.
---
# thinkzap.outbox.sequencer_stale_removed

## O que significa
A varredura do sequenciador FIFO encontrou, na fila de vez da linha (`thinkzap:cadence-queue:{lineKey}`), um id da outbox que não existe mais ou já está em estado terminal, e o removeu. Enquanto ele estava na cabeça, as demais mensagens da linha esperavam.

## Causa provável
- Job encerrado sem passar pelo `finally` do dispatcher (processo morto no meio do envio).
- Linha da outbox apagada manualmente.

## Como verificar
1. No log, filtre por `thinkzap.outbox.sequencer_stale_removed` e veja `lineKey` e `outboxId`.
2. Confira o status da linha em `core_thinkerszap_widget_outbox`.

## Como resolver
Nenhuma ação: a fila da linha volta a andar sozinha. Se o mesmo `lineKey` aparecer com frequência, investigar por que o desfecho terminal não está removendo o ticket.
