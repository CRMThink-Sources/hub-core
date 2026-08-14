---
category: integration
audience: suporte
summary: Uma mensagem enviada pelo widget não pôde ser entregue ao contato.
---
# thinkzap.message.widget_send_exhausted

## O que significa
Uma mensagem que o operador enviou pelo widget do CRM foi enfileirada, tentada três vezes e **não foi entregue** ao contato no WhatsApp.

Este código é emitido apenas quando o provider **respondeu** recusando em todas as tentativas — o que prova que nada saiu. Se houvesse dúvida sobre a entrega, o código seria `thinkzap.message.widget_send_unknown`, que pede conferência antes de reenviar. Aqui o operador pode reenviar com segurança.

O operador foi avisado automaticamente por um comentário na timeline do deal/contato/lead de onde partiu o envio.

## Causa provável
- **Linha desconectada** entre o clique do operador e o processamento da fila.
- **Número do destinatário sem WhatsApp** ou em formato que o provider recusa.
- **Linha com assinatura vencida** durante a janela de retentativa.
- **Provider recusando por regra de negócio** (ex: WhatsApp Oficial fora da janela de 24h, que exige template).

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.widget_send_exhausted` e leia `destination`, `subscriptionItemId` e `lastError` — este último traz a mensagem crua do provider, que diz o motivo real.
3. Na aba Conexão da linha, confira se ela está conectada agora.
4. Confirme com o parceiro se o comentário de aviso apareceu na timeline da entidade.

## Como resolver
1. Se a linha está desconectada: orientar a reconectar (ler o QR Code) e reenviar a mensagem.
2. Se o número está errado: corrigir o cadastro do contato no CRM e reenviar.
3. Se a linha é WhatsApp Oficial e o `lastError` menciona janela/template: a conversa está fora das 24h e só um template aprovado passa. Orientar o operador a usar o modo template do widget.
4. Se a assinatura da linha venceu: regularizar e reenviar.

## Quando escalar
Se a linha está conectada, o número é válido, a assinatura está ativa e o envio continua esgotando as tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.widget_send_exhausted`, domínio/portal do parceiro, horário, `subscriptionItemId`, telefone de destino e o `lastError` do log.
