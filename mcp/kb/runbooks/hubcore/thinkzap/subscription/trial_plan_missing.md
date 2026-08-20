---
category: config
audience: suporte
summary: O período de teste está temporariamente indisponível.
---
# thinkzap.subscription.trial_plan_missing

## O que significa
O cliente tentou iniciar o período de teste, mas o plano de teste não está disponível no momento. É uma configuração ausente/incompleta no catálogo de planos — não é erro do cliente nem falta de elegibilidade. Enquanto isso não for ajustado, ninguém consegue iniciar o teste.

## Causa provável
- **Plano de teste não configurado**: o plano usado pelo período de teste não está cadastrado no catálogo.
- **Configuração removida ou incompleta**: o plano existia mas foi alterado/removido.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.trial_plan_missing`.
3. Confirme que o cliente estava tentando iniciar o período de teste (e não contratar assinatura).

## Como resolver
1. Como se trata de configuração ausente, acione o time responsável para configurar o plano de teste no catálogo.
2. Enquanto isso, informe o cliente de que o período de teste está temporariamente indisponível; se houver urgência, oriente sobre a opção de assinatura.
3. Após a configuração, peça ao cliente para iniciar o teste novamente e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Este erro é, por natureza, um pedido ao time responsável para configurar o plano de teste. Se após a configuração o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.subscription.trial_plan_missing`, domínio/portal do parceiro, horário do evento e e-mail da conta.
