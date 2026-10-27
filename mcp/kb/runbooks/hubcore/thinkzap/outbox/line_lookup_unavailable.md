---
category: integration
audience: suporte
summary: A consulta dos dados da linha falhou no momento do envio; a mensagem é tentada de novo ou, na última tentativa, fica com falha.
---
# thinkzap.outbox.line_lookup_unavailable

## O que significa
Na hora de enviar uma mensagem da fila de saída, o sistema não conseguiu ler os dados da linha (assinatura e item da linha) no Bitrix da CRMThink e não havia cópia de reserva desses dados.

Isso **não** quer dizer que a linha foi removida. Linha removida gera o erro "Linha não encontrada na instalação", sem este código.

## Causa provável
- O Bitrix da CRMThink ficou instável ou fora do ar por alguns instantes.
- Erro de rede, ou o tempo de resposta se esgotou.
- Limite de requisições do Bitrix atingido.

## Como verificar
1. No log, filtre por `thinkzap.outbox.line_lookup_unavailable` e veja `outboxId`, `subscriptionItemId` e `willRetry`.
2. `willRetry: true` indica que a mensagem ainda vai ser tentada de novo. Confira o log seguinte do mesmo `outboxId`.
3. `willRetry: false` indica a última tentativa: a mensagem ficou com falha, com o motivo "Falha temporária ao consultar a linha: …".
4. No portal admin, em "Falhas de envio", filtre pelo portal e pelo período.

## Como resolver
- Com `willRetry: true`, nenhuma ação é necessária.
- Com `willRetry: false`, confirme que o Bitrix da CRMThink voltou a responder (por exemplo, abrindo o portal admin) e reprocesse a mensagem em "Falhas de envio".
- Se aparecer com frequência, acione o desenvolvimento para investigar a disponibilidade do Bitrix da CRMThink.
