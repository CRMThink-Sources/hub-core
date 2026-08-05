---
category: integration
audience: suporte
summary: A Clicksign respondeu com erro a um pedido do CRMThink e a operação não foi concluída.
---
# clicksign.api.request_failed

## O que significa
Sempre que o CRMThink precisa fazer algo na Clicksign (a plataforma que cria e assina os documentos) — como criar um envelope, alterar, notificar quem assina ou cancelar — ele envia um pedido para lá e espera uma resposta de "deu certo". Desta vez a Clicksign respondeu com erro, então a operação não foi concluída. Na prática, o que o parceiro tentou fazer com o documento não aconteceu.

## Causa provável
- **A credencial da conta Clicksign está inválida ou vencida**: essa credencial é a senha de acesso que autoriza o CRMThink a agir na conta Clicksign do parceiro, e fica na tela de Configurações. Se foi trocada, apagada ou expirou, a Clicksign recusa o pedido.
- **A conta na Clicksign está com algum problema**: bloqueio, limite de uso atingido ou restrição do plano contratado fazem a Clicksign barrar a operação mesmo com a credencial certa.
- **Algum dado enviado estava inválido**: se uma informação da operação (um e-mail, um campo obrigatório) veio errada ou faltando, a Clicksign não aceita.
- **A Clicksign estava fora do ar ou instável na hora**: uma falha temporária do lado da Clicksign também derruba o pedido.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.api.request_failed`.
3. Na mesma linha do log, leia o status e a mensagem que a Clicksign devolveu. É esse texto que diz o motivo real (credencial, conta, dado ou instabilidade), então ele guia todo o resto. Aproveite para conferir a credencial da conta na tela de Configurações e o estado da conta no painel da Clicksign.

## Como resolver
1. Comece lendo o status e a mensagem da Clicksign no log, porque cada motivo pede uma ação diferente e sem isso você agiria no escuro.
2. Se apontar problema de credencial, oriente o parceiro a conferir e atualizar a credencial da conta na tela de Configurações, já que uma credencial correta é o que reabre o acesso.
3. Se apontar problema na conta, peça ao parceiro para verificar no painel da Clicksign se a conta está ativa, sem bloqueio e dentro do limite do plano, pois nada disso se resolve trocando a credencial.
4. Se a mensagem indicar dado inválido, oriente o parceiro a corrigir a informação usada na operação e tentar de novo, porque a Clicksign só aceita quando o dado está completo e correto.

## Quando escalar
Se a credencial e a conta estiverem corretas e a operação continuar falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.api.request_failed`, domínio do parceiro, o horário do evento e o status/mensagem que a Clicksign retornou.
