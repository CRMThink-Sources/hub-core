---
category: integration
audience: suporte
summary: O WhatsApp Oficial recusou a operação do template.
---
# thinkzap.template.provider_rejected

## O que significa
O app thinkzap enviou a operação de template ao WhatsApp Oficial, o pedido chegou até lá, mas o próprio provedor recusou. Ou seja, não faltou nada do nosso lado e não é instabilidade — o WhatsApp Oficial disse "não" por um motivo específico. A boa notícia é que o provedor quase sempre devolve uma mensagem explicando a recusa, e essa mensagem é o ponto de partida.

## Causa provável
- **Regras de conteúdo/política**: o template feriu alguma regra do WhatsApp Oficial.
- **Categoria/idioma incompatível**: a categoria ou o idioma não bate com o conteúdo enviado.
- **Template não aprovado ou em estado inválido**: o template não está no estado esperado para essa operação.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.provider_rejected`.
3. Leia na linha do log a mensagem retornada pelo provedor — ela costuma dizer exatamente o motivo da recusa.

## Como resolver
1. Leia a mensagem do provedor no log e identifique o que ela aponta — é ela quem diz o que corrigir.
2. Ajuste o template conforme o motivo indicado (conteúdo, categoria, idioma ou estado de aprovação).
3. Peça para reenviar o template já ajustado e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a mensagem do provedor não for clara, ou se a recusa continuar mesmo após o ajuste apontado, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.provider_rejected`, domínio do parceiro, o horário do evento e a mensagem retornada pelo provedor.
