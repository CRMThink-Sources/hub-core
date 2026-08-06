---
category: integration
audience: suporte
summary: O aviso de encerramento da chamada não chegou, então a chamada não é encerrada e o card fica aberto.
---

# sonax.call.callback_end_not_found

## O que significa

Quando uma chamada é feita, o CRMThink aciona a discagem no Sonax e recebe de volta um id da chamada. Ao encerrar, o Sonax deve enviar de volta um aviso de encerramento (com esse mesmo id da chamada e a ação de finalizar) para o CRMThink registrar o fim e fechar o card.

Em alguns casos esse aviso de encerramento não chega. O sinal disso é ver várias chamadas só com o evento de início (sem o evento de encerramento correspondente) — indicando que o retorno de finalização não está sendo recebido.

## Causa provável

- **Endereço de encerramento errado** na configuração do portal Sonax do parceiro.
- **Aviso de encerramento sendo enviado para uma integração antiga**, por causa de uma instalação antiga do app no ambiente do cliente.

## Como verificar

1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme que **não** existem eventos de encerramento da chamada (só aparece o de início).
3. Confirme, pelo domínio do parceiro, que as chamadas em geral não estão sendo encerradas (não é um caso isolado).

## Como resolver

1. Verifique, no portal Sonax do cliente, se o endereço configurado para o aviso de encerramento está apontando para o destino correto do CRMThink (e não para uma integração antiga). O time de desenvolvimento informa o endereço esperado, se necessário.
2. Peça ao parceiro para fazer uma chamada de teste e acompanhe na tela de Logs se o evento de encerramento passa a aparecer.

## Quando escalar

Se o endereço de encerramento no portal Sonax do cliente estiver correto e os encerramentos continuarem sem chegar, acione o time de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.call.callback_end_not_found`, o domínio do parceiro e o horário.
