---
category: integration
audience: suporte
summary: O Bitrix24 não deixou o CRMThink pegar a lista de usuários e por isso ela ficou vazia.
---
# clicksign.users.bitrix_error

## O que significa
Para configurar quem participa da integração, o CRMThink precisa buscar dentro do Bitrix24 (o CRM do parceiro) a lista de pessoas ativas que usam o sistema. Desta vez, quando o CRMThink foi buscar essa lista, o Bitrix24 recusou o pedido. Como o pedido foi negado, os usuários não vieram e a tela ficou sem ninguém para selecionar, travando a configuração.

## Causa provável
- **O app Clicksign não tem permissão para ler os usuários**: quando o parceiro autorizou o app Clicksign dentro do Bitrix24, ele concedeu um conjunto de permissões (o "escopo"). Se a permissão de ler os usuários não estava nesse conjunto, o Bitrix24 bloqueia a busca.
- **A autorização do app venceu ou foi retirada**: a permissão que o app Clicksign recebeu no Bitrix24 pode expirar com o tempo ou ter sido removida por alguém, e aí o Bitrix24 passa a recusar os pedidos.
- **O usuário logado não pode ver a lista de pessoas**: mesmo com o app autorizado, se a pessoa que está operando não tem acesso a essa informação dentro do Bitrix24, o próprio Bitrix24 nega a leitura para ela.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.users.bitrix_error`.
3. Na mesma linha do log, leia a mensagem que o Bitrix24 devolveu. Ela costuma dizer se foi falta de permissão, autorização vencida ou acesso negado ao usuário. É essa mensagem que aponta qual das causas aconteceu, então vale ler com calma antes de agir.

## Como resolver
1. Oriente o parceiro a refazer a autorização (reinstalar) do app Clicksign dentro do Bitrix24 do cliente. Isso renova a permissão vencida ou retirada e garante que o app volte a ter acesso, que é o que estava faltando.
2. Peça ao parceiro para conferir se o usuário que está usando a tela tem acesso ao CRM no Bitrix24, porque sem esse acesso o Bitrix24 continua negando a leitura da lista mesmo com o app autorizado.
3. Depois disso, peça ao parceiro para abrir a tela de novo e tentar carregar os usuários, para confirmar se a lista voltou a aparecer.

## Quando escalar
Se o parceiro já refez a autorização do app e confirmou que o usuário tem acesso ao CRM, e mesmo assim a lista de usuários continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.users.bitrix_error`, domínio do parceiro, o horário do evento e o status/mensagem que o Bitrix24 retornou quando fizer sentido.
