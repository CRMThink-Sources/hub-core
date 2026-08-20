---
category: config
audience: suporte
summary: A contratação por cartão está indisponível por erro de configuração.
---
# thinkzap.gateway.wrong_key_type

## O que significa
A contratação por cartão está indisponível por um erro de configuração do gateway de pagamento (hoje o Stripe): a chave cadastrada é de um tipo incorreto. Não é um problema do cartão do cliente nem da rede — é a credencial do gateway que precisa ser corrigida. A modalidade manual não é afetada.

## Causa provável
- **Tipo de chave incorreto**: foi cadastrada uma chave que não é a chave secreta esperada pelo gateway.
- **Chave de ambiente trocado**: chave de teste no lugar da chave de produção, ou o contrário.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.gateway.wrong_key_type`.
3. Confirme que o parceiro estava tentando a contratação por cartão.

## Como resolver
1. Como é um erro de configuração, acione o time responsável para corrigir a chave secreta do gateway de pagamento (a chave cadastrada está no tipo errado).
2. Oriente o parceiro de que não há nada a corrigir no cartão dele; a indisponibilidade é de configuração.
3. Após a correção da chave, peça que ele tente a contratação por cartão novamente.

## Quando escalar
Este erro já é um pedido ao time responsável para corrigir a chave do gateway. Se após a correção o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.gateway.wrong_key_type`, domínio do parceiro, horário do evento e os ids envolvidos.
