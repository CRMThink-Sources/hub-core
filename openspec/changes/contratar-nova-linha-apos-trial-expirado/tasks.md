## 1. Reprodução e diagnóstico

- [x] 1.1 Teste de `GetLineSubscriptionState` com assinatura `trial_expired` e uma linha `ZAPI` ativa (resultado: `canCreateLine` já era verdadeiro; o defeito não estava aí)
- [x] 1.2 Teste de `CreateAdditionalLine` com a mesma instalação pedindo `HUBMESSAGE` (resultado: o checkout embutia a linha web expirada na cobrança)
- [x] 1.3 Localizar onde a intenção `add-line` do checkout é consumida no webhook do gateway (`activate-line-subscription.ts` e `stripe-payment.gateway.ts`)

## 2. API: estado e cobrança

- [x] 2.1 `get-line-subscription-state.ts`: expor `expiredTrialLines` (id, nome, conector); `canCreateLine` já cobria `trial_expired`
- [x] 2.2 Filtro das linhas do teste encerrado na cobrança, feito em `CreateAdditionalLine.billableContract` (o helper `buildContractLineItems` ficou intacto, para não mudar a composição lida por outras telas)
- [x] 2.3 `create-additional-line.ts` e controller: `includeLineIds` opcional, validado contra as linhas ativas do teste encerrado; id inválido ou escolha fora de `trial_expired` responde 400
- [x] 2.4 `includeLineIds` na intenção `add-line` (tipo, metadata do Stripe) e uso em `ActivateLineSubscription`: com origem `trial_expired`, só as linhas listadas são movidas e assinadas; a origem é cancelada como hoje
- [x] 2.5 Testes: sem escolha, com escolha, id inválido, escolha com teste em andamento, sem provisionar antes de pagar, ativação com e sem escolha, ida e volta do metadata

## 3. Front: tela de conexões

- [x] 3.1 `use-line-subscription.ts`: tipar `expiredTrialLines`, enviar `includeLineIds` em `createLine` via `buildCreateLineBody`
- [x] 3.2 `nova-linha-modal.tsx`: linhas do teste encerrado com checkbox desmarcado por padrão, escondidas quando vazias
- [x] 3.3 `conexoes-layout.tsx`: passa as linhas ao modal e as escolhidas ao `createLine`
- [x] 3.4 Mensagens `thinkzap/conexoes/nova-linha` em pt e es
- [x] 3.5 Teste do corpo da requisição com e sem escolha (`build-create-line-body.test.ts`); o front não tem ferramenta de renderização de componente

## 4. Verificação

- [x] 4.1 Typecheck de api (sem erros em thinkzap) e front; testes de api (2947 + gateway) e front passam, exceto `bots/issue-text.test.ts`, que já falhava antes desta change
- [ ] 4.2 Validar o cenário completo em homolog com Stripe em modo teste: trial web expirado, contratar business sem a web, e contratar business com a web. Conferir também `NEXT_PUBLIC_THINKZAP_ENABLED_PROVIDERS` no ambiente: sem `HUBMESSAGE` na lista, a opção business aparece como "Em breve" e não pode ser contratada
- [x] 4.3 `openspec validate contratar-nova-linha-apos-trial-expirado`
