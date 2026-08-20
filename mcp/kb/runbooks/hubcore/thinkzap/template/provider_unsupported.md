---
category: validation
audience: suporte
summary: Esta linha usa uma conexão que não trabalha com templates; use o envio de mensagem normal.
---
# thinkzap.template.provider_unsupported

## O que significa
O app thinkzap tentou usar um template nesta linha, mas a linha é do tipo z-api (WhatsApp conectado por QR Code). Templates só existem no WhatsApp Oficial. Ou seja, não é um erro de dados nem de instabilidade: é uma operação que não faz sentido para esse tipo de linha. Nenhuma mensagem foi enviada. Este é, de longe, o caso mais comum quando alguém tenta usar template numa linha comum.

## Causa provável
- **Linha z-api (WhatsApp comum)**: a linha foi conectada por QR Code, e essa modalidade não tem catálogo de templates.
- **Escolha equivocada**: o operador tentou disparar um template quando o correto seria escrever a mensagem no campo comum.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.provider_unsupported`.
3. Confira a modalidade da linha na lista de linhas: se ela foi conectada por QR Code, é uma linha z-api e não trabalha com templates.

## Como resolver
1. Oriente o operador a enviar a mensagem pelo campo de mensagem comum, e não pela função de template.
2. Se a intenção era mesmo usar templates aprovados, explique que isso só está disponível em linhas de WhatsApp Oficial; nesse caso, a conta precisa de uma linha nessa modalidade.

## Quando escalar
Se a linha for de WhatsApp Oficial e ainda assim o erro aparecer, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.provider_unsupported`, domínio do parceiro, o horário do evento e o identificador da linha.
