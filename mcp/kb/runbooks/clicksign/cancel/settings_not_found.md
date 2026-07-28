---
category: config
audience: suporte
summary: O app está instalado, mas ninguém preencheu a tela de Configurações da integração.
---
# clicksign.cancel.settings_not_found

## O que significa
O app Clicksign está instalado no portal, mas a tela de Configurações da integração (onde ficam salvos os dados que ligam o CRMThink à conta Clicksign do parceiro, como a chave de acesso) está vazia. Instalar o app é só o primeiro passo; sem preencher e salvar essas configurações, o CRMThink não tem as informações necessárias pra falar com a Clicksign e cancelar o documento. Por isso o cancelamento para aqui.

## Causa provável
- **Configurações nunca preenchidas**: a tela de Configurações da integração nunca foi salva, então os dados de acesso simplesmente não existem.
- **Configuração pendente após instalar**: o parceiro instalou o app mas pulou (ou esqueceu) a etapa de configurar, deixando o passo pela metade.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.cancel.settings_not_found`.
3. Anote o domínio do parceiro que aparece no log — é a configuração desse portal que está faltando.

## Como resolver
1. Oriente o parceiro a abrir a tela de Configurações da integração Clicksign, porque é lá que ficam os dados que faltam pro cancelamento funcionar.
2. Peça ao parceiro pra preencher os campos e salvar, já que só depois de salvar é que o CRMThink passa a ter o acesso à conta Clicksign.
3. Confirme com o parceiro que o app Clicksign continua instalado no Bitrix24, porque sem a instalação ativa as configurações não têm como ser usadas.
4. Depois de salvar, peça ao parceiro pra refazer o cancelamento pela timeline do negócio, pra validar que agora as configurações estão sendo lidas.

## Quando escalar
Se as configurações estiverem preenchidas e salvas e o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.cancel.settings_not_found`, domínio do parceiro e o horário do evento.
