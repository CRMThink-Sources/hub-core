# Proposal

## Why

As assinaturas da SPA 1142 têm o fim do período em `UF_CRM_91_CURRENT_PERIOD_END`, mas nada no produto grava o status quando essa data passa. O trial (`Em teste`) só é tratado como expirado na hora da leitura, e na SPA continua `Em teste`. A assinatura manual (`Ativo`) continua `Ativo` e habilitada para sempre, porque `resolveLineEntitlement` não olha a data quando o status é `active`. O resultado é um CRM que não mostra a situação real e linhas manuais vencidas funcionando sem pagamento.

## What Changes

- Novo job agendado que varre a SPA 1142 e grava o status das assinaturas cujo período terminou:
  - `Em teste` (`trialing`) com o período encerrado → `Teste expirado` (`trial_expired`);
  - `Ativo` (`active`) com modalidade `manual` e o período encerrado há mais que a carência → `Vencido` (`past_due`).
- Carência configurável por variável de ambiente, em dias, padrão `0`. Vale só para a assinatura manual.
- Assinaturas `stripe` ficam de fora: o status delas é mantido pelo webhook do gateway.
- O job só roda no ambiente habilitado (produção). Homolog divide o portal com produção e não grava status.
- Gravar o status pela API dispara o `UPDATE` da SPA 1142 que já existe. `past_due` e `trial_expired` não desassinam nada no provider, conforme o requisito "Inadimplência não desassina" de `thinkzap/ciclo-provider-spa-assinatura`.
- A avaliação na leitura (`resolveLineEntitlement`) não muda.

## Capabilities

### New Capabilities
- `pagamentos/expiracao-assinatura`: transição automática de status das assinaturas da SPA 1142 (trial e manual) quando o fim do período passa.

### Modified Capabilities
<!-- Nenhuma: os requisitos de ciclo-provider-spa-assinatura já cobrem past_due e trial sem desassinar. -->

## Impact

- `api/src/modules/application`: leitor paginado das assinaturas vencidas na SPA 1142 (só os campos necessários, sem hidratar plano e aplicação) e uso de `SubscriptionRepository.updateSubscription` (com cache) para gravar o status.
- Novo caso de uso de expiração e novo job agendado em `api/src/shared/infra/scheduler`, com lock no Redis igual ao de `credential-refresh.job.ts`, iniciado em `app.ts`.
- `api/src/config/env.ts`: flag para ligar o job e dias de carência da assinatura manual.
- Bitrix: `crm.item.list` / `crm.item.update` na SPA 1142. Cada escrita dispara o webhook `ONCRMDYNAMICITEMUPDATE_1142`, que já tem tratamento.
