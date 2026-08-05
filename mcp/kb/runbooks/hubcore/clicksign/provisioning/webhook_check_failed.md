---
category: integration
audience: suporte
summary: O CRMThink não conseguiu confirmar na Clicksign se o aviso automático de eventos está ativo.
---
# clicksign.provisioning.webhook_check_failed

## O que significa
Para o CRMThink ficar sabendo o que acontece com os documentos, a Clicksign manda um aviso automático a cada mudança — esse aviso é o webhook. De tempos em tempos o CRMThink pergunta à Clicksign se esse aviso continua cadastrado para o parceiro. Desta vez essa consulta falhou: o CRMThink não recebeu a confirmação. Como ele não conseguiu confirmar, o provisionamento fica marcado como pendente ou ausente, mesmo que o aviso talvez esteja funcionando normalmente.

## Causa provável
- **A credencial da conta Clicksign está inválida ou vencida**: essa credencial é a senha de acesso que autoriza o CRMThink a consultar a conta Clicksign do parceiro, e fica na tela de Configurações. Sem ela válida, a Clicksign não responde à consulta.
- **A Clicksign estava fora do ar ou instável na hora**: uma falha temporária do lado da Clicksign também impede a consulta de completar.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.provisioning.webhook_check_failed`.
3. Na linha do log, identifique de qual parceiro/credencial era a consulta que falhou e leia o status e a mensagem que a Clicksign devolveu, porque isso separa um problema de credencial de uma simples instabilidade.

## Como resolver
1. Oriente o parceiro a conferir e corrigir, se preciso, a credencial da conta na tela de Configurações, já que uma credencial válida é o que permite o CRMThink consultar a Clicksign.
2. Rode a verificação de provisionamento novamente para esse parceiro, pois muitas vezes foi só uma instabilidade momentânea e a segunda tentativa já recebe a confirmação.
3. Confirme se o provisionamento deixou de aparecer como pendente/ausente, o que indica que a consulta voltou a funcionar.

## Quando escalar
Se a credencial estiver correta e a consulta continuar falhando mesmo depois de rodar a verificação de novo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.provisioning.webhook_check_failed`, domínio do parceiro, o horário do evento e o status/mensagem que a Clicksign retornou quando fizer sentido.
