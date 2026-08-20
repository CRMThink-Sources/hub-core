---
category: config
audience: suporte
summary: A contratação por cartão está indisponível no momento.
---
# thinkzap.gateway.not_configured

## O que significa
A contratação por cartão passa por um gateway de pagamento (hoje o Stripe). Este erro indica que esse gateway não está configurado no app thinkzap, então a modalidade por cartão fica indisponível. A modalidade manual (por exemplo, boleto/acerto direto) não é afetada por isso.

## Causa provável
- **Gateway de pagamento não configurado**: as credenciais do gateway ainda não foram cadastradas.
- **Configuração incompleta ou removida**: a configuração existia, mas foi apagada ou salva pela metade.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.not_configured`.
3. Confirme que o parceiro estava tentando a contratação por cartão (a via manual não passa pelo gateway).

## Como resolver
1. Como é uma configuração ausente, acione o time responsável para configurar o gateway de pagamento.
2. Oriente o parceiro de que, enquanto isso, a contratação por cartão fica indisponível, mas a modalidade manual segue funcionando.
3. Após a configuração, peça que ele tente a contratação por cartão novamente.

## Quando escalar
Este erro já é um pedido ao time responsável para configurar o gateway. Se após a configuração o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.gateway.not_configured`, domínio do parceiro, horário do evento e os ids envolvidos.
