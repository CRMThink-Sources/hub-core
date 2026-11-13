---
category: integration
audience: suporte
summary: Uma mensagem ou evento recebido não foi processado depois de todas as tentativas e ficou registrado como falha de recebimento.
---
# thinkzap.inbound.event_failed

## O que significa
Um evento que chegou ao sistema (mensagem recebida do WhatsApp, resposta do operador no Bitrix, status de entrega ou evento do bot) foi tentado 3 vezes e falhou em todas. Ele ficou registrado como **falha de recebimento**, guardado por 7 dias, e **não será tentado de novo sozinho**.

Na prática: a mensagem do contato pode não ter aparecido no canal aberto do Bitrix, ou uma ação pedida pelo operador não chegou ao contato.

## Causa provável
- O Bitrix do cliente ficou instável ou fora do ar durante as tentativas.
- A linha está sem canal aberto vinculado, ou a assinatura da linha está inativa.
- Evento com dados que o sistema não soube interpretar.
- Falha temporária de rede ou banco no momento do processamento.

## Como verificar
1. No portal admin, abra "Falhas de envio" e vá para a aba "Recebimento". Filtre pelo portal do cliente e pelo período.
2. Abra o item: o detalhe mostra a origem, o identificador do evento (traceKey) e o erro de cada tentativa.
3. Use o identificador do evento (traceKey) na consulta de logs para ver o fluxo completo.

## Como resolver
- Corrija a causa (por exemplo, vincular o canal aberto à linha, ou aguardar o Bitrix voltar).
- Se a origem for **HubMessage**, use "Reprocessar" no próprio item. Para as demais origens o botão não aparece: reentregar o evento poderia duplicar uma mensagem ou repetir uma ação no cliente. Nesses casos, peça ao contato para reenviar a mensagem, ou acione o desenvolvimento.
- Depois de 7 dias o registro é apagado e deixa de poder ser reprocessado.
