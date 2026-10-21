---
category: config
audience: suporte
summary: Uma mensagem do operador no canal aberto não foi enviada porque o canal não está ligado a nenhuma linha ativa desta instalação.
---
# thinkzap.message.outbound_context_missing

## O que significa
O operador escreveu no canal aberto do Bitrix24, e o envio para o WhatsApp **não aconteceu**. Para enviar, o sistema precisa achar a linha pela combinação de portal, app e canal aberto (`LINE` do evento). Essa busca não retornou nada, então não havia número por onde enviar.

O job falha, e a retentativa cai no mesmo lugar enquanto o vínculo não existir.

## Causa provável
- **Canal sem linha**: o canal aberto foi criado no Bitrix e nunca foi vinculado a uma linha pela aba Configurações.
- **Linha removida**: a linha que atendia o canal foi apagada, mas o canal continua recebendo conversas.
- **App reinstalado ou removido** no portal, com o contexto da instalação perdido.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.outbound_context_missing`.
3. O log traz `domain` e `line` (o id do canal aberto no Bitrix).
4. Na SPA de itens de assinatura (1146), procure item com o campo de canal (`ufCrm93Conector`) igual a `line`. Nenhum item ativo confirma a causa.

## Como resolver
1. Na tela de linhas do app, vincular o canal aberto à linha que deve atendê-lo.
2. Se a linha foi removida por engano, recriar ou reativar a linha e vincular de novo.
3. Pedir ao operador para reenviar a mensagem. Não há reprocessamento automático.

## Quando escalar
Se existe item ativo com o canal correto e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.outbound_context_missing`, domínio do parceiro, `line` e o id do item na SPA 1146.
