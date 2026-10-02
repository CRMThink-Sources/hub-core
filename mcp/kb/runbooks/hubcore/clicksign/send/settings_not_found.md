---
category: config
audience: suporte
summary: O robô de envio rodou, mas o portal não tem o app Clicksign instalado ou configurado; nenhum documento foi enviado.
---
# clicksign.send.settings_not_found

## O que significa
A automação do Bitrix24 chamou o robô "Enviar para assinatura", e o robô respondeu normalmente: o fluxo seguiu como se tudo tivesse dado certo. Mas o CRMThink não encontrou o app Clicksign instalado nesse portal, ou não achou a configuração salva. Por isso **nenhum envelope foi criado e nada foi enviado** para assinatura.

## Causa provável
- **App não instalado** no portal, ou reinstalado sem refazer a configuração.
- **Integração nunca configurada**: o app está no portal, mas as empresas e os tokens não foram salvos.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` ou pelo domínio do parceiro.
2. Confirme `código de erro: clicksign.send.settings_not_found`.
3. Confira se o app Clicksign aparece instalado no portal e se as Configurações têm empresas e tokens salvos.

## Como resolver
1. Instalar o app, ou abrir as Configurações e salvar empresas e tokens.
2. Reexecutar a automação no negócio ou contato que deveria ter gerado o envio.

## Quando escalar
Se o app está instalado, a configuração está salva e o erro continua. Anexe: `traceKey`, `código de erro: clicksign.send.settings_not_found`, domínio do parceiro e o horário.
