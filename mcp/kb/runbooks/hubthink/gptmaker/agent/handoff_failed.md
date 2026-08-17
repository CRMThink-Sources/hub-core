---
category: integration
audience: suporte
summary: A transferência da conversa para um atendente humano falhou.
---
# gptmaker.agent.handoff_failed

## O que significa
O agente tentou transferir a conversa para um atendente humano e a transferência falhou. O cliente pode ter ficado aguardando sem cair para um atendente.

## Causa provável
- Falha momentânea de comunicação ao transferir.
- Não havia atendente ou fila configurada para receber a conversa.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.agent.handoff_failed`.
3. Peça ao parceiro para conferir se há atendente/fila configurado para receber transferências.

## Como resolver
1. Confirme com o parceiro que existe atendente ou fila apto a receber a conversa.
2. Peça para repetir a ação que dispara a transferência.
3. Acompanhe na tela de Logs se a transferência passa a concluir.

## Quando escalar
Se há atendente/fila configurado e a transferência continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.agent.handoff_failed`, domínio do parceiro e o horário do evento.
