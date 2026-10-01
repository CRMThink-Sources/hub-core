---
category: internal
audience: suporte
summary: Observabilidade — a proteção contra abrir a mesma conversa duas vezes no canal aberto falhou para uma mensagem.
---
# thinkzap.message.open_channel_guard_failed

## O que significa
Depois de enviar uma mensagem pelo widget, o sistema abre a conversa no canal aberto do Bitrix24 e guarda uma marca para não abrir a mesma conversa duas vezes. Essa proteção falhou para uma mensagem:
- `step: read`: não deu para ler a marca, e a conversa pode ser aberta de novo;
- `step: persist`: a conversa abriu, mas a marca não foi gravada.

No pior caso, a mesma mensagem aparece duas vezes no chat do canal aberto. O contato recebeu uma vez só.

## Causa provável
- **Banco indisponível** no momento da leitura ou da gravação.

## Como verificar
1. Filtre os Logs pelo `providerMessageId` e confirme `código de erro: thinkzap.message.open_channel_guard_failed`.
2. O campo `step` diz qual lado falhou.

## Como resolver
Nenhuma ação. Se o parceiro estranhar a duplicata no chat, explicar que o contato recebeu uma vez só.

## Quando escalar
Se o código aparece em volume: o banco está indisponível. Anexe a janela de horário.
