---
category: config
audience: suporte
summary: "O aplicativo não tem permissão de serviço de mensagens no portal, então a linha não pode ser oferecida à campanha de SMS."
---
# thinkzap.line.messageservice_scope_missing

## O que significa
O app thinkzap permite oferecer uma linha de WhatsApp como **provedor de mensagem** do Bitrix24, para que ela apareça em Marketing → Campanha de SMS. Este erro indica que o portal do parceiro não concedeu ao aplicativo a permissão (`escopo`) de serviço de mensagens, e por isso o registro do provedor foi recusado.

Nada foi alterado no portal do parceiro, nenhuma mensagem foi enviada e a linha continua funcionando normalmente para atendimento. O que não funciona é **apenas** oferecer aquela linha à campanha de SMS.

**Não é problema da linha nem da credencial do portal.** As duas podem estar corretas e o erro continuar — é uma permissão que falta no aplicativo.

## Causa provável
- **O escopo `messageservice` ainda não foi publicado** no manifesto do aplicativo no Marketplace do Bitrix24. Enquanto não for, nenhum portal consegue conceder a permissão.
- **O portal ainda não reautorizou o app** depois de o escopo ter sido publicado. Permissão nova só passa a valer quando o portal reautoriza — instalações antigas continuam com o conjunto de permissões do dia da instalação.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.messageservice_scope_missing`.
3. Confirme com o time de produto se o escopo `messageservice` já está publicado no manifesto do aplicativo.
4. Se já estiver, confirme a data da última autorização do app naquele portal.

## Como resolver
1. **Escopo não publicado**: acione o time responsável pelo aplicativo no Marketplace. É um passo externo ao portal do parceiro, e enquanto ele não acontecer nenhum cliente consegue registrar o provedor.
2. **Escopo publicado, portal desatualizado**: peça ao parceiro que reabra o aplicativo no portal e aceite a solicitação de permissões, ou reinstale o app. Depois disso, registrar o provedor de novo pela tela da linha.
3. Confirme com o parceiro que a linha aparece em Marketing → Campanha de SMS.

## Quando escalar
Se o escopo estiver publicado, o portal tiver reautorizado o app e o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.messageservice_scope_missing`, domínio/portal do parceiro, horário do evento, e-mail da conta e o id da linha.
