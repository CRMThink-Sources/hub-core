---
category: integration
audience: suporte
summary: Um contato do CRM não pôde ser lido; ele ficou fora da busca, ou a conversa abriu com o telefone no lugar do nome.
---
# thinkzap.bitrix.contact_read_failed

## O que significa
Um contato do CRM não pôde ser lido no Bitrix24. A operação continuou sem ele:
- na **busca de contatos** do widget, o contato some da lista;
- na **abertura da conversa** no canal aberto, a conversa usa o telefone como nome.

## Causa provável
- **Contato apagado** entre a listagem e a leitura.
- **Permissão de CRM** do app insuficiente para aquele contato.
- **Instabilidade do Bitrix24**.

## Como verificar
1. Filtre os Logs pelo `traceKey` e confirme `código de erro: thinkzap.bitrix.contact_read_failed`.
2. O log traz `contactId` (na busca) ou `entity`/`entityId` (na conversa), e o `err` do Bitrix.
3. Abra o contato no portal pelo id para ver se existe.

## Como resolver
1. Contato inexistente: nenhuma ação.
2. Erro de acesso: conferir o escopo `crm` do app no portal.
3. Instabilidade: repetir a busca.

## Quando escalar
Se o contato existe, o escopo está liberado e a leitura falha sempre. Anexe: `traceKey`, domínio, id do contato e o `err`.
