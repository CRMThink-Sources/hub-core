---
category: config
audience: suporte
summary: Chegou um aviso da Clicksign, mas esse parceiro não tem nenhuma configuração salva pra receber.
---
# clicksign.webhook.settings_not_found

## O que significa
Toda vez que algo acontece com um documento (assinado, recusado, cancelado), a Clicksign manda um aviso automático pro CRMThink — isso é o *webhook*. Pra saber de qual parceiro é esse aviso e o que fazer com ele, o CRMThink precisa ter uma configuração salva daquela integração.

Esse erro quer dizer que o aviso chegou, mas o CRMThink não encontrou nenhuma configuração salva pra esse parceiro. Sem saber a quem o aviso pertence e sem os dados de acesso pra tratar o documento, o CRMThink não tem como seguir em frente, e o evento é recusado.

## Causa provável
- **Integração instalada, mas nunca configurada**: o app Clicksign está no portal, porém o parceiro nunca preencheu os dados (empresas e tokens de acesso), então não há o que salvar.
- **Instalação deixada pela metade**: o parceiro começou a configurar e não terminou, ficando sem uma configuração completa.
- **Configuração removida**: os dados chegaram a existir, mas foram apagados depois — por reinstalação ou por engano.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.webhook.settings_not_found`.
3. Verifique, para o domínio do parceiro, se existe alguma configuração da Clicksign salva (empresas e tokens de acesso). A ausência dela confirma a causa.

## Como resolver
1. Confirme com o parceiro que o app Clicksign está de fato instalado no Bitrix24 dele. Sem o app instalado, não há onde guardar a configuração.
2. Oriente o parceiro a abrir as Configurações da integração Clicksign no portal dele.
3. Peça que ele preencha e salve todos os dados obrigatórios (empresas e tokens de acesso). É isso que cria a configuração que faltava pro CRMThink reconhecer os avisos.
4. Peça ao parceiro pra repetir a ação que gerou o aviso e acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se a configuração já está salva corretamente e mesmo assim os avisos continuam chegando com esse erro, o problema não é de preenchimento — acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.webhook.settings_not_found`, domínio do parceiro, o horário do evento e um print das Configurações salvas (sem mostrar o token de acesso completo).
