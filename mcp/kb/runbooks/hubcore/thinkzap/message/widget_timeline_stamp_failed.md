---
category: internal
audience: suporte
summary: Observabilidade — o comentário do envio foi publicado na timeline, mas a marca que evita repeti-lo não foi gravada.
---
# thinkzap.message.widget_timeline_stamp_failed

## O que significa
Uma mensagem enviada pelo widget foi entregue e o comentário dela foi publicado na timeline do CRM. Mas a marca que impede publicar o mesmo comentário de novo não foi gravada. Se o envio for retentado, o comentário pode aparecer duplicado.

## Causa provável
- **Banco indisponível** no momento da gravação.

## Como verificar
1. Filtre os Logs pelo `outboxId` e confirme `código de erro: thinkzap.message.widget_timeline_stamp_failed`.

## Como resolver
Nenhuma ação. Se o parceiro estranhar o comentário duplicado, explicar que a mensagem saiu uma vez só.

## Quando escalar
Se o código aparece em volume: o banco está indisponível. Anexe a janela de horário.
