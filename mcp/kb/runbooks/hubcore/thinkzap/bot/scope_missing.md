---
category: config
audience: suporte
summary: O app instalado no portal não tem as permissões de mensageria que o bot de atendimento precisa.
---
# thinkzap.bot.scope_missing

## O que significa
Para um fluxo atender sozinho num canal aberto, o app precisa criar um bot de mensageria dentro do Bitrix24. Antes de criar, o app confere se tem permissão para isso — e neste caso não tem.

O app checa antes justamente para dar esta resposta. Sem a checagem, o Bitrix24 recusaria a criação com uma mensagem genérica de acesso negado, que manda investigar canal aberto e bot quando o problema é a permissão do app.

**Nada mudou no portal.** O fluxo não foi vinculado e o canal aberto continua no atendimento humano, como antes.

## Causa provável
Uma única: o app instalado no portal do parceiro não tem liberadas as permissões de mensageria que o bot usa.

- `imbot` — criar e configurar o bot. **É a que falta na maioria dos casos.**
- `imopenlines` — falar, transferir e encerrar a conversa no canal aberto.

Isso acontece tipicamente quando o app foi instalado no portal antes de o recurso de bot existir: a instalação antiga foi autorizada com menos permissões, e permissão nova só entra em vigor reinstalando.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo identificador do evento (o traceKey da tela de Logs).
2. Confirme o código de erro `thinkzap.bot.scope_missing`.
3. Na mesma linha do log, leia o campo `faltando` — ele nomeia exatamente quais permissões estão ausentes.
4. Confirme com o parceiro há quanto tempo o app está instalado no portal e se ele foi reinstalado recentemente.

## Como resolver
1. Oriente o parceiro a reinstalar (ou reautorizar) o app no portal do Bitrix24. É a única forma de aplicar permissões novas — mudar a configuração sem reinstalar não basta.
2. Na tela de autorização, as permissões de mensageria precisam estar marcadas.
3. Depois de reinstalar, peça para publicar o fluxo novamente pelo app.
4. Confirme na tela de Logs que o aviso não voltou a aparecer.

Não peça para repetir a publicação antes de reinstalar: sem a permissão o resultado é o mesmo, por isso este erro não é retentável.

## Quando escalar
Escale se o parceiro reinstalou o app com as permissões de mensageria marcadas e o aviso continua aparecendo. Acione a equipe de desenvolvimento e anexe: identificador do evento (traceKey), código de erro `thinkzap.bot.scope_missing`, o conteúdo do campo `faltando`, domínio/portal do parceiro, horário do evento e quando a reinstalação foi feita.
