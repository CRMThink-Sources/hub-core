---
category: integration
audience: suporte
summary: A z-api recusou a alteração do espelhamento das mensagens enviadas pelo aparelho.
---
# thinkzap.zapi.notify_sent_by_me_failed

## O que significa
O parceiro ligou ou desligou, na aba Ajustes da linha, o toggle "Espelhar mensagens enviadas pelo aparelho". Para isso funcionar, o app thinkzap pede à z-api que avise também das mensagens enviadas pelo próprio número da linha, pelo celular ou pelo WhatsApp Web. A z-api recusou o pedido ou não respondeu. Por segurança, **nada foi gravado** nos ajustes da linha: o toggle continua como estava, e o nome também, caso tenha sido alterado junto.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.
- **Linha sem credencial válida**: a instância da linha na z-api pode ter sido cancelada ou trocada.
- **Status da z-api**: a conta na z-api pode estar com problema de status.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.notify_sent_by_me_failed`.
3. Leia na linha do log o status e a mensagem devolvidos pela z-api.

## Como resolver
1. Peça ao parceiro para salvar os ajustes de novo em alguns instantes.
2. Verifique na aba Conexão se a linha aparece normalmente. Se ela não carregar, a instância pode ter sido cancelada na z-api.
3. Se persistir, verifique o status da z-api usando a mensagem do log e repita depois que normalizar.

## Quando escalar
Se continuar falhando com a z-api normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.notify_sent_by_me_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
