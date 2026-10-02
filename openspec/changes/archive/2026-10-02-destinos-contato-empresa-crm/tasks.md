# Tasks

## 1. Contato: somente os telefones do próprio contato

- [x] 1.1 Em `api/src/modules/thinkzap/application/related-destinations.resolver.ts`, reduzir `getContactDestinations` a retornar só `[{ entityTypeId: 3, id: contextId }]` (sem `getCompanyContactIdsFromEntity` e sem `leadId`), tornando-a síncrona e sem o parâmetro `getCrmItem`; ajustar a chamada em `getRelatedDestinationIds` e o JSDoc de `resolveRelatedDestinations`. Verificar com `yarn tsc --noEmit` (ou o type-check do pacote `api`) sem erros.
- [x] 1.2 Em `related-destinations.resolver.test.ts`, adicionar casos de `CRM_CONTACT_DETAIL_TAB` usando `routeCrmItems` (que rejeita pares não previstos): contato com `companyId` e `companyIds` apontando para empresas com contatos → destinos são exatamente os telefones do contato e nenhum `crm.item.get` em `entityTypeId` 4 é feito; contato com `leadId` → telefone do lead ausente e nenhum `get` em `entityTypeId` 1; contato sem telefone vinculado a empresa com contatos → lista vazia; telefone repetido no contato → aparece uma vez. Verificar com `yarn vitest run related-destinations.resolver` passando.
- [x] 1.3 Em `list-destinations.service.test.ts`, revisar o bloco `CRM_CONTACT_DETAIL_TAB`: manter "includes the contact itself", trocar o teste "does not call getCompanyContactIds when contact has no companyId" por um que afirme que, mesmo com `companyId`, só o contato é carregado (`getCrmItem` chamado uma única vez, com `(3, '42')`). Verificar com `yarn vitest run list-destinations.service` passando.

## 2. Empresa: empresa + contatos vinculados (fixar comportamento)

- [x] 2.1 Em `related-destinations.resolver.test.ts`, adicionar casos de `CRM_COMPANY_DETAIL_TAB`: empresa com telefone E e `contactIds` [C1, C2] → destinos contêm E com rótulo `Empresa - <nome>` e T1/T2 com rótulo `Contato - <nome>`; telefone igual entre empresa e contato → aparece uma vez; leitura de C2 rejeitada → retornam E e T1. Verificar com `yarn vitest run related-destinations.resolver` passando, sem alteração em `getCompanyDestinations`.

## 3. Verificação integrada

- [x] 3.1 Rodar a suíte da API do módulo thinkzap (`yarn vitest run src/modules/thinkzap` no pacote `api`), incluindo os testes dos controllers de robô (`bitrix-robot-`, `bitrix-button-robot-`, `bitrix-template-robot-webhook-handler`), e confirmar que tudo passa; ajustar qualquer teste de robô que afirme contatos da empresa ou lead para documento de Contato.
- [x] 3.2 Validar a change com `openspec validate destinos-contato-empresa-crm --strict` sem erros.
- [ ] 3.3 Teste manual no portal de homologação: abrir o widget na ficha de um contato vinculado a duas empresas com outros contatos e confirmar que só aparecem os telefones do contato; abrir na ficha de uma dessas empresas e confirmar telefone da empresa + telefones dos contatos vinculados.
