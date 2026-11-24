# Tasks

## 1. Helper compartilhado do espelho

- [x] 1.1 Extrair o `ensureMirror` de `sync-spa-item-resource-status.ts` para `modules/thinkzap/application/helpers/ensure-line-mirror.ts`, devolvendo `'present' | 'created' | 'no-parent'` e mantendo o `warn` quando o item não tem assinatura pai; o sync passa a usar o helper
- [x] 1.2 Testes do helper (espelho presente, criado para Z-API com token, criado para HubMessage com `channelId`, sem assinatura pai) e confirmar que os testes existentes do sync seguem passando
- [x] 1.3 Verificado: a ação em lote `subscribe-lines` passa por `SyncSpaItemResourceStatus`, que usa o helper e recria o espelho; sem mudança necessária (só deixa de assinar sob trial, como a spec manda)

## 2. Ações manuais do backoffice

- [x] 2.1 Ampliar `LineBillingEffects.mirrors` para `find`, `save` e `setBillingState` em `subscribe-thinkzap-line.ts`
- [x] 2.2 `subscribeThinkzapLine`: depois de o provider aceitar, garantir o espelho com o helper e gravar a marca; devolver `{ markRecorded }` (`false` só quando não há assinatura pai)
- [x] 2.3 `unsubscribeThinkzapLine`: mesmo tratamento, com a marca de desassinado
- [x] 2.4 Controllers de subscribe e unsubscribe: responder `{ message, markRecorded }`
- [x] 2.5 Testes em `thinkzap-line-actions.test.ts`: espelho ausente (Z-API e HubMessage), espelho presente, sem assinatura pai, provider recusa (nada gravado), efeitos desligados, nos dois sentidos

## 3. Front do backoffice

- [x] 3.1 `admin-app-subscriptions-section.tsx` (`lineAction`): ler `markRecorded` e, quando `false`, mostrar aviso em vez do sucesso
- [x] 3.2 Textos do aviso em `front/messages` nos três idiomas e teste da função de resultado (padrão de `subscribeLinesOutcome`)

## 4. Verificação e entrega

- [x] 4.1 `api/`: `yarn check-types`, `yarn lint` (zero warnings) e `yarn test`; `front/`: `yarn check-types`, `yarn lint` e `yarn test`
- [x] 4.2 Branch `task/backoffice-assinar-linha-recria-espelho` a partir da `develop`, commit em português com o porquê no corpo
- [ ] 4.3 Depois do deploy em produção: clicar em "assinar" no item 317 e conferir `providerBilling: subscribed`; confirmar com o suporte o status da assinatura 239 (ver Open Questions) e arquivar a change
