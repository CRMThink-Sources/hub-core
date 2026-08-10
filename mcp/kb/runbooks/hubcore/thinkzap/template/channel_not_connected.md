---
category: validation
audience: suporte
summary: O número desta linha ainda não foi conectado no WhatsApp Oficial; sem isso não há templates.
---
# thinkzap.template.channel_not_connected

## O que significa
Esta é uma linha de WhatsApp Oficial, mas o número dela ainda não terminou de ser conectado do lado da Meta. Enquanto essa conexão não estiver concluída, não existe catálogo de templates para usar, então a operação não pode seguir. Não é falha de envio nem instabilidade: falta um passo de configuração do canal.

## Causa provável
- **Conexão do canal incompleta**: o número de WhatsApp Oficial ainda não foi conectado/aprovado na Meta.
- **Canal em processo de habilitação**: a linha foi criada, mas a etapa de vincular o número Oficial não foi finalizada.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.channel_not_connected`.
3. Confira o status da linha: ela deve estar como WhatsApp Oficial, mas o número ainda aparece como não conectado.

## Como resolver
1. Oriente o parceiro a concluir a conexão do número de WhatsApp Oficial (o vínculo do número na Meta).
2. Com o canal conectado, o catálogo de templates fica disponível; peça para repetir a operação.
3. Confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a conexão do canal parecer concluída e o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.channel_not_connected`, domínio do parceiro, o horário do evento e o identificador da linha.
