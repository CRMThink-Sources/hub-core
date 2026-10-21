---
category: internal
audience: dev
summary: A primeira mensagem da fila da linha estava sem job agendado; a varredura recriou o job.
---
# thinkzap.outbox.sequencer_head_rescheduled

## O que significa
A varredura do sequenciador FIFO encontrou, na cabeça da fila da linha (`thinkzap:cadence-queue:{lineKey}`), uma row da outbox ainda PENDING ou SENDING, mas sem nenhum job `widget-send-<outboxId>` esperando, atrasado ou rodando no BullMQ. Nada a acordaria, e todas as mensagens da linha ficariam esperando atrás dela. A varredura removeu o job terminado (se havia) e criou outro.

## Causa provável
- O job esgotou as tentativas com um erro **antes** do envio (leitura da linha, Redis, reserva de vaga), deixando a row PENDING.
- O enfileiramento do job falhou depois de a row entrar na fila da linha.
- Job removido manualmente do Bull Board.

## Como verificar
1. No log, filtre por `thinkzap.outbox.sequencer_head_rescheduled` e veja `lineKey` e `outboxId`.
2. No Bull Board, veja o histórico do job `widget-send-<outboxId>` (o anterior foi removido; o erro dele está no log do worker no mesmo horário).
3. Confira a row em `core_thinkerszap_widget_outbox` (`status`, `attempts`, `last_error`).

## Como resolver
Nenhuma ação para a mensagem: ela volta a ser despachada. Se o código aparecer com frequência, corrigir a falha que derrubou o job original.
