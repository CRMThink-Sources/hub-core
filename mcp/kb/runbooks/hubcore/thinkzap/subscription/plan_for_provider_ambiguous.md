---
category: config
audience: suporte
summary: Há mais de um plano para este tipo de linha e não dá para decidir automaticamente qual usar.
---
# thinkzap.subscription.plan_for_provider_ambiguous

## O que significa
A contratação foi barrada porque existe mais de um plano ofertável para o mesmo tipo de linha, e o app não consegue decidir sozinho qual deles aplicar. Para não arriscar contratar o plano errado, a operação é interrompida. Não é falha do parceiro nem cobrança indevida: é uma configuração de catálogo que precisa ficar sem ambiguidade. Depende do time responsável.

## Causa provável
- **Vários planos ofertáveis para o mesmo conector**: mais de uma opção ativa para o mesmo tipo de linha.
- **Configuração duplicada**: planos equivalentes deixados simultaneamente ofertáveis.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.subscription.plan_for_provider_ambiguous`.
3. Veja no log qual tipo de linha (conector) estava sendo contratado.

## Como resolver
1. Este caso não se resolve pelo parceiro: informe que a contratação para esse tipo de linha está temporariamente indisponível.
2. Acione o time responsável para deixar um único plano ofertável por conector.
3. Após o ajuste no catálogo, oriente o parceiro a repetir a contratação.

## Quando escalar
Acione a equipe de desenvolvimento assim que confirmar o erro, pois depende de configuração interna. Anexe: `traceKey`, `código de erro: thinkzap.subscription.plan_for_provider_ambiguous`, domínio do parceiro, o horário do evento e o tipo de linha (conector) envolvido.
