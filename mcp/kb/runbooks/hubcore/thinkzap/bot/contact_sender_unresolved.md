---
category: config
audience: suporte
summary: O bot não conseguiu descobrir por qual número responder ao cliente; as falas ficaram só no chat do canal aberto.
---
# thinkzap.bot.contact_sender_unresolved

## O que significa
Para responder ao cliente no WhatsApp, o bot precisa saber por qual número sair — a mesma linha que um atendente usaria naquele canal aberto. Este aviso diz que o app não conseguiu descobrir essa linha.

**O cliente não recebeu as falas do bot.** As mensagens ficaram registradas no chat do canal aberto, dentro do Bitrix24, então o atendente vê o que o bot tentou dizer e pode continuar o atendimento manualmente. A conversa não foi perdida, mas também não foi atendida automaticamente.

O app escolheu deixar a conversa visível ao atendente em vez de falhar sem deixar rastro.

## Causa provável
- **O canal aberto do fluxo não tem linha de WhatsApp ativa.** É a causa mais comum: o fluxo foi vinculado a um canal que não está conectado a nenhum número.
- **A linha existe mas está desconectada** (aparelho fora, sessão do WhatsApp encerrada).
- **O canal aberto está vinculado a mais de uma linha ativa** — o app não escolhe uma por conta própria, porque sairia por um número arbitrário.
- **Assinatura da linha inativa**: sem contratação ativa não há envio.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo identificador do evento (o traceKey da tela de Logs).
2. Confirme o código de erro `thinkzap.bot.contact_sender_unresolved` e anote o campo `lineId` — é o canal aberto em questão.
3. No app thinkzap, abra a tela de Conexões e confirme se existe uma linha ativa e conectada respondendo por esse canal aberto.
4. Se houver mais de uma linha apontando para o mesmo canal, é essa a causa.

## Como resolver
1. Se o canal não tem linha: vincule o fluxo a um canal aberto que já tenha WhatsApp conectado, ou conecte uma linha a esse canal.
2. Se a linha está desconectada: reconecte pela tela de Conexões (leitura do QR Code, quando for o caso).
3. Se há duas linhas no mesmo canal: deixe apenas uma respondendo por ele.
4. Depois de corrigir, peça ao cliente para enviar uma nova mensagem e confirme na tela de Logs que o aviso não voltou.

Enquanto não estiver resolvido, o atendimento daquele canal continua funcionando de forma manual — o atendente responde pela conversa no Bitrix24 normalmente.

## Quando escalar
Escale se existe exatamente uma linha ativa, conectada e com assinatura em dia respondendo pelo canal, e o aviso continua aparecendo. Acione a equipe de desenvolvimento e anexe: identificador do evento (traceKey), código de erro `thinkzap.bot.contact_sender_unresolved`, o `lineId` da linha do log, domínio/portal do parceiro e horário do evento.
