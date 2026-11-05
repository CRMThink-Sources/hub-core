## Context

`GetLineSubscriptionState` calcula `canSubscribe = isTrial || cancelled` e `canCreateLine = lineCount > 0 && (isTrial || stripe)`. A tela mostra "Assinar" nas linhas bloqueadas (`needsSubscription`) com planos filtrados por conector (`plansForProvider`) e "Nova linha" quando `canCreateLine`.

`CreateAdditionalLine` monta a cobrança com `buildContractLineItems({ contract, additional })`, que soma as linhas ativas do contrato por conector. Sem contrato vivo no gateway (caso do trial), abre checkout carregando **todas** as linhas: a do trial entra na assinatura no mesmo ato. Com `trial_expired`, isso embute a linha web expirada na cobrança da business.

Observado no código: `countActiveLinesByProvider` conta item `active` sem olhar o status da assinatura pai, e `resolveCurrentContract` escolhe a assinatura vigente por precedência (`trial_expired` fica atrás de `trialing` e `past_due`).

Hipótese sobre o sintoma relatado (a confirmar na primeira tarefa): o caminho "Nova linha" ou fica oculto, ou leva a um checkout que cobra a linha web expirada junto. Em qualquer dos dois casos o cliente só percebe "Assinar" na linha do trial.

## Goals / Non-Goals

**Goals:**
- Cliente com trial expirado contrata linha de qualquer conector.
- Cliente decide se a linha do trial expirado entra na cobrança; padrão: fora.

**Non-Goals:**
- Trocar plano de assinatura paga viva.
- Contratar linha em assinatura `manual` (boleto).
- Mudar a expiração do trial ou o job de varredura.

## Decisions

1. **Reproduzir antes de mudar.** Primeira tarefa: teste que monta o estado `trial_expired` com uma linha `ZAPI` ativa e confirma o valor atual de `canCreateLine` e a cobrança gerada. Se `canCreateLine` já for verdadeiro, o defeito é só a cobrança embutida e o front não precisa de mudança além do seletor.

2. **`canCreateLine` aceita `trial_expired` explicitamente.** A condição passa a ser: tem linha e (trial vigente ou expirado, ou stripe). Não depende de a linha do trial estar ativa em nenhum sentido que a expiração anule.

3. **Linhas do trial expirado saem da contagem por padrão.** `buildContractLineItems` recebe `includeExpiredTrialLines: string[]` (ids de item). Com a assinatura em `trial_expired`, só os itens listados entram. Em `trialing` o comportamento atual é preservado. Alternativa descartada: tratar item de assinatura expirada como inativo em `countActiveLinesByProvider`; afetaria composição, preços exibidos e reconciliação, que também usam a função.

4. **Escolha vem do cliente, e o preço não.** O corpo da criação de linha ganha `includeLineIds` opcional. O servidor valida que cada id pertence à instalação e a uma assinatura `trial_expired`; ids estranhos são recusados. O preço continua sendo resolvido no servidor pelo plano do conector.

5. **Seletor no modal "Nova linha".** O modal lista as linhas do trial expirado com checkbox desmarcado. O estado devolvido ao front ganha `expiredTrialLines` (id, nome, conector) para montar a lista; sem linhas expiradas o modal fica como hoje.

6. **Ativação move só as linhas escolhidas.** `ActivateLineSubscription` move para a assinatura paga todas as linhas da origem e depois cancela a origem (`endOrigin`). A intenção `add-line` passa a carregar `includeLineIds` (metadata do Stripe, ids separados por vírgula). Quando a origem é `trial_expired`, só as linhas listadas são movidas e assinadas no provider. As demais ficam na assinatura de trial, que é cancelada e portanto some da tela (`listSubscriptionLines` ignora assinatura cancelada). Decisão do produto: linha que ficou de fora não é reativável; para ter outra o cliente cria uma nova. Metadata ausente ou ilegível vale como lista vazia para `trial_expired` e como "todas" para `trialing`, mantendo o comportamento atual.

## Risks / Trade-offs

- [Cobrança errada na fatura] → testes de `buildContractLineItems` para trial vigente, expirado sem escolha e expirado com escolha.
- [Webhook ignora `includeLineIds` e deixa a linha escolhida bloqueada] → teste do consumo da intenção; tarefa dedicada.
- [Cliente cria business e esquece a web] → aceito; a linha web some após o pagamento e ele cria outra se precisar. A tela deve deixar isso claro no seletor.
- [Cancelar a origem aciona o desassinar no provider das linhas que ficaram] → comportamento existente para pai cancelado; o recurso do trial nunca foi assinado e os clients tratam o cancelamento como sucesso.

## Open Questions

- Nenhuma. O consumo da intenção `add-line` está em `activate-line-subscription.ts` e `stripe-payment.gateway.ts` (`readIntent`/`toMetadata`).
