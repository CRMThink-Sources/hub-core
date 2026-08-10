---
category: config
audience: suporte
summary: A integração com o WhatsApp Oficial não está configurada.
---
# thinkzap.hubmessage.not_configured

## O que significa
O app thinkzap tentou usar o canal do WhatsApp Oficial (HubMessage), mas não encontrou a credencial necessária para falar com esse canal. Sem essa configuração, nenhuma mensagem passa pelo WhatsApp Oficial. Não é um erro pontual de envio: é uma configuração que está faltando ou incompleta.

## Causa provável
- **Credencial do canal HubMessage ausente**: a integração com o WhatsApp Oficial ainda não foi configurada para esta conta.
- **Configuração incompleta ou removida**: a credencial existia, mas foi apagada ou salva pela metade.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.hubmessage.not_configured`.
3. Confirme que o parceiro está tentando usar uma linha de WhatsApp Oficial (HubMessage) — este erro não se aplica a linhas de WhatsApp comum.

## Como resolver
1. Como se trata de configuração ausente, acione o time responsável para configurar a credencial do canal HubMessage desta conta.
2. Enquanto isso, oriente o parceiro de que o envio pelo WhatsApp Oficial ficará indisponível até a configuração ser concluída.
3. Após a configuração, peça que ele reenvie a mensagem e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Este erro já é, por natureza, um pedido ao time responsável para configurar o canal. Se após a configuração o erro persistir, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.hubmessage.not_configured`, domínio do parceiro, horário do evento e os ids envolvidos.
