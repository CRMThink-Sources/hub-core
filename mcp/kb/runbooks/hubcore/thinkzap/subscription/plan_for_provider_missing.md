---
category: config
audience: suporte
summary: A contratação para este tipo de linha está indisponível no momento.
---
# thinkzap.subscription.plan_for_provider_missing

## O que significa
A contratação foi barrada porque não há um plano/preço configurado para o tipo de linha em questão. Ou seja, o catálogo não tem uma opção mapeada para esse conector, então não é possível oferecer nada para contratar agora. Não é falha do parceiro nem cobrança indevida: falta uma configuração interna. Depende do time responsável para ser resolvido.

## Causa provável
- **Plano/preço não configurado para o conector**: o catálogo não tem uma opção para esse tipo de linha.
- **Configuração incompleta**: uma opção existente ficou sem o preço/plano vinculado.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.plan_for_provider_missing`.
3. Veja no log qual tipo de linha (conector) estava sendo contratado.

## Como resolver
1. Este caso não se resolve pelo parceiro: informe que a contratação para esse tipo de linha está temporariamente indisponível.
2. Acione o time responsável para configurar o plano/preço do conector no catálogo.
3. Após a configuração, oriente o parceiro a repetir a contratação.

## Quando escalar
Acione a equipe de desenvolvimento assim que confirmar o erro, pois depende de configuração interna. Anexe: `traceKey`, `código de erro: thinkzap.subscription.plan_for_provider_missing`, domínio do parceiro, o horário do evento e o tipo de linha (conector) envolvido.
