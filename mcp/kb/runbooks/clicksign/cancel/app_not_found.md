---
category: config
audience: suporte
summary: O portal foi reconhecido, mas não há app Clicksign instalado nele pra cancelar.
---
# clicksign.cancel.app_not_found

## O que significa
O CRMThink reconheceu de qual portal veio o pedido, mas ao procurar a instalação do app Clicksign daquele portal (o app instalado no Bitrix24 é o que dá acesso à conta Clicksign e permite agir sobre os documentos), não achou nenhuma. Diferente do erro de portal desconhecido, aqui o portal existe pra gente, só que a instalação do app não está mais ativa. Sem essa instalação, o CRMThink não tem como conversar com a Clicksign pra cancelar o documento.

## Causa provável
- **App não instalado no portal**: o app Clicksign não está presente no Bitrix24 do portal, então não há instalação pra usar.
- **Instalação removida ou interrompida**: o app chegou a ser instalado mas foi desinstalado depois, ou a instalação parou no meio — em ambos os casos o vínculo com a Clicksign se perdeu.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.cancel.app_not_found`.
3. Anote o domínio do parceiro que aparece no log — é a instalação desse portal que está faltando.

## Como resolver
1. Peça ao parceiro pra conferir se o app Clicksign aparece instalado no Bitrix24 do portal, porque é essa instalação que dá ao CRMThink o acesso pra cancelar.
2. Se não aparecer, oriente o parceiro a instalar o app no portal — isso recria o vínculo com a Clicksign.
3. Se constar instalado mas o erro persistir, oriente o parceiro a reinstalar o app, porque a instalação pode ter ficado quebrada ou incompleta, e a reinstalação a deixa novinha.
4. Depois, peça ao parceiro pra refazer o cancelamento pela timeline do negócio, pra confirmar que a instalação voltou a funcionar.

## Quando escalar
Se depois de reinstalar o app o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.cancel.app_not_found`, domínio do parceiro e o horário do evento.
