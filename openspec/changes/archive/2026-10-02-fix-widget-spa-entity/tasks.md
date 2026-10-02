# Tasks

## 1. Widget: placement → entidade

- [x] 1.1 Criar `front/app/(widgets)/layouts/resolve-widget-entity.ts` com `resolveWidgetEntity(placement, options)` → `{ entity, entityId } | null` (mapa estático lead/deal/contact/company + regex `^CRM_DYNAMIC_(\d+)_DETAIL_TAB$` → `DYNAMIC_<id>`; `null` se placement desconhecido ou sem `ID`) e verificar com `resolve-widget-entity.test.ts` cobrindo as 4 entidades padrão, `CRM_DYNAMIC_1060_DETAIL_TAB` → `DYNAMIC_1060`, placement desconhecido e `ID` ausente (`npm test` em `front/`)
- [x] 1.2 Em `conversation-view.tsx`, remover `PLACEMENT_TO_ENTITY` e usar `resolveWidgetEntity` no envio; quando `null`, chamar `setErrorFeedback` com a mensagem de ficha não identificada e retornar antes de qualquer `post`, sem limpar rascunho/anexos — verificar que os quatro payloads (`send-widget`, `send-widget-multipart`, `send-widget-template`, `send-widget-button`) usam o `entity`/`entityId` resolvidos e que `npm run lint` e `npx tsc --noEmit` em `front/` passam

## 2. API: nome da conversa para SPA

- [x] 2.1 Em `api/src/modules/thinkzap/application/get-crm-contact-name.ts`, quando `entity` casar `^DYNAMIC_(\d+)$` (sem diferenciar caixa), chamar `crm.item.get` com `{ entityTypeId, id }` e usar `result.item.title`; manter `crm.<entity>.get` para as demais — verificar com novo `get-crm-contact-name.test.ts` (mock de `callMethod`) cobrindo SPA com título, SPA sem título (`null`), e `deal`/`contact` inalterados
- [x] 2.2 Adicionar teste em `send-widget-message.controller.test.ts` aceitando `entity: 'DYNAMIC_1060'` + `entityId: '1613'` (`202`) e confirmando que o corpo sem `entity` segue `400`, e verificar a suíte da API passando

## 3. Verificação integrada

- [ ] 3.1 Em um portal de teste, abrir o widget na aba de um item de SPA e enviar texto, anexo e mensagem com botões (e template numa linha oficial): verificar `202`/sucesso em cada um, comentário de timeline no item de SPA e conversa do canal aberto nomeada com o título do item
- [ ] 3.2 Repetir um envio de texto a partir de um Negócio e de um Contato e verificar que o comportamento não mudou
