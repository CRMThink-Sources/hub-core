# Proposal

## Why

Um cliente ativou o trial do ThinkZap com uma linha WhatsApp Web, o trial expirou e agora ele quer contratar uma linha WhatsApp Business (oficial). A tela de conexões só oferece "Assinar" na linha que estava em trial, e esse botão só lista planos do conector dessa linha (web). O cliente não tem caminho para contratar uma linha de outro conector sem antes pagar pela linha que só testou.

## What Changes

- Com a assinatura vigente em `trial_expired`, a instalação passa a poder criar uma linha nova de qualquer conector do catálogo ("Nova linha" liberado), sem depender de a linha do trial ser contratada.
- O checkout dessa linha deixa o cliente **escolher** se a linha do trial expirado também entra na contratação. Por padrão ela fica de fora: só a linha nova é cobrada e a do trial continua bloqueada.
- O "Assinar" por linha bloqueada continua existindo e continua oferecendo os planos do conector da própria linha.
- A API deixa de montar sempre a cobrança com todas as linhas do trial: a linha de trial expirado só entra na cobrança quando o cliente a selecionou.
- O estado de assinatura devolvido à tela expõe o que ela precisa para o caso (`canCreateLine` verdadeiro com trial expirado e a lista de linhas elegíveis a entrar na contratação).

## Capabilities

### New Capabilities
- `thinkzap/contratacao-linha`: regras de contratar e criar linhas do ThinkZap a partir de uma instalação em trial ou com trial expirado: quando "Nova linha" está disponível, o que o checkout cobra e como o cliente escolhe as linhas que entram.

### Modified Capabilities
<!-- Nenhuma: as specs existentes não descrevem contratação de linha. -->

## Impact

- API: `api/src/modules/thinkzap/application/get-line-subscription-state.ts` (`canCreateLine`), `create-additional-line.ts` e `helpers/build-contract-line-items.ts` (linhas do trial na cobrança), `create-subscription-checkout.ts` e controllers de assinatura/checkout (nova entrada com as linhas escolhidas).
- Front: `front/app/(thinkzap)/thinkzap/_layout/conexoes-layout.tsx`, `_components/conexoes/nova-linha-modal.tsx`, `front/app/hooks/use-line-subscription.ts` e mensagens `thinkzap/conexoes/nova-linha` (pt/es).
- Sem migração de banco. Sem mudança no fluxo de assinaturas pagas ativas.
- Risco: cobrança. Linha de trial indevidamente incluída ou excluída muda o valor da fatura; os testes de cobrança cobrem as duas escolhas.
