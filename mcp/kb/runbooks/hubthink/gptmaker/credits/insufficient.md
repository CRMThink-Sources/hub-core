---
category: validation
audience: suporte
summary: O parceiro está sem créditos para o agente responder.
---
# gptmaker.credits.insufficient

## O que significa
O parceiro não tem créditos suficientes para o agente gerar respostas. Enquanto estiver sem créditos, o agente para de responder. **Não é bug** — é consumo da assinatura.

## Causa provável
- Os créditos do plano acabaram.
- O consumo do período atingiu o disponível.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.credits.insufficient`.
3. Peça ao parceiro para conferir o saldo de créditos na área de assinatura/plano.

## Como resolver
1. Oriente o parceiro a repor créditos ou revisar o plano na área de assinatura.
2. Após regularizar, peça para testar a conversa novamente.
3. Confirme na tela de Logs que o agente voltou a responder.

## Quando escalar
Se o parceiro afirma ter créditos disponíveis e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.credits.insufficient`, domínio do parceiro e o horário do evento.
