---
category: integration
audience: suporte
summary: O Bitrix24 não deixou o CRMThink pegar a lista de campos e por isso ela ficou vazia.
---
# clicksign.fields.bitrix_error

## O que significa
Para montar as regras da integração, o CRMThink precisa buscar dentro do Bitrix24 (o CRM do parceiro, onde ficam os negócios e os contatos) a lista de campos disponíveis. Desta vez, quando o CRMThink foi buscar esses campos, o Bitrix24 recusou o pedido. Como o pedido foi negado, a lista não veio e a tela ficou sem campos para escolher, travando a configuração.

## Causa provável
- **O app Clicksign não tem permissão para ler os campos**: quando o parceiro autorizou o app Clicksign dentro do Bitrix24, ele concedeu um conjunto de permissões (chamado de "escopo"). Se a permissão de ler o CRM não estava nesse conjunto, o Bitrix24 bloqueia a busca dos campos.
- **A autorização do app venceu ou foi retirada**: a permissão que o app Clicksign recebeu no Bitrix24 pode expirar com o tempo ou ter sido removida por alguém, e aí o Bitrix24 passa a recusar tudo.
- **O usuário logado não pode ver os campos**: mesmo com o app autorizado, se a pessoa que está operando não tem acesso ao CRM dentro do Bitrix24, o próprio Bitrix24 nega a leitura dos campos para ela.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.fields.bitrix_error`.
3. Na mesma linha do log, leia a mensagem que o Bitrix24 devolveu. Ela costuma dizer se foi falta de permissão, autorização vencida ou acesso negado ao usuário. É essa mensagem que aponta qual das causas aconteceu, então vale ler com calma antes de agir.

## Como resolver
1. Oriente o parceiro a refazer a autorização (reinstalar) do app Clicksign dentro do Bitrix24 do cliente. Isso renova a permissão vencida ou retirada e garante que o app volte a ter acesso ao CRM, que é o que estava faltando.
2. Peça ao parceiro para conferir se o usuário que está usando a tela tem acesso ao CRM no Bitrix24, porque sem esse acesso o Bitrix24 continua negando a leitura dos campos mesmo com o app autorizado.
3. Depois disso, peça ao parceiro para abrir a tela de novo e tentar carregar os campos, para confirmar se a lista voltou a aparecer.

## Quando escalar
Se o parceiro já refez a autorização do app e confirmou que o usuário tem acesso ao CRM, e mesmo assim a lista de campos continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.fields.bitrix_error`, domínio do parceiro, o horário do evento e o status/mensagem que o Bitrix24 retornou quando fizer sentido.
