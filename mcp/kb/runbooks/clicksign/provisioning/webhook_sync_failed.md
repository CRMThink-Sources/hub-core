---
category: integration
audience: suporte
summary: O CRMThink não conseguiu ligar (ou desligar) na Clicksign o aviso automático de eventos do parceiro.
---
# clicksign.provisioning.webhook_sync_failed

## O que significa
Para o CRMThink ficar sabendo o que acontece com os documentos, a Clicksign precisa mandar um aviso automático toda vez que algo muda — esse aviso é o webhook. Antes de os avisos funcionarem, o CRMThink precisa "cadastrar" (ou "descadastrar") esse aviso na Clicksign para aquele parceiro. Desta vez esse cadastro não foi concluído. Enquanto isso não se resolve, os avisos não chegam e os documentos do parceiro deixam de atualizar sozinhos no CRMThink.

## Causa provável
- **A credencial da conta Clicksign está inválida ou vencida**: essa credencial é a senha de acesso que autoriza o CRMThink a mexer na conta Clicksign do parceiro, e fica na tela de Configurações. Sem ela válida, a Clicksign não deixa cadastrar o aviso.
- **A Clicksign estava fora do ar ou instável na hora**: uma falha temporária do lado da Clicksign também impede o cadastro de completar.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.provisioning.webhook_sync_failed`.
3. Na linha do log, identifique de qual parceiro/credencial era o cadastro que falhou e leia o status e a mensagem que a Clicksign devolveu, porque isso separa um problema de credencial de uma simples instabilidade.

## Como resolver
1. Oriente o parceiro a conferir e corrigir, se preciso, a credencial da conta na tela de Configurações, já que uma credencial válida é o que permite o CRMThink cadastrar o aviso na Clicksign.
2. Se existir a opção de reparar provisionamento, use-a para esse parceiro, pois ela força o CRMThink a tentar o cadastro de novo do zero.
3. Peça ao parceiro para salvar novamente a configuração da conta, o que dispara uma nova tentativa de cadastrar o aviso e costuma resolver quando a causa foi instabilidade passageira.

## Quando escalar
Se a credencial estiver correta e o cadastro do aviso continuar falhando depois de repetir a tentativa, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.provisioning.webhook_sync_failed`, domínio do parceiro, o horário do evento e o status/mensagem que a Clicksign retornou quando fizer sentido.
