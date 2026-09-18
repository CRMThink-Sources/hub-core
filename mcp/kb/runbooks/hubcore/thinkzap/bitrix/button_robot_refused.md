---
category: config
audience: suporte
summary: "O robô de envio de botões não disparou: a linha configurada não pode enviar botões por esse robô (bloqueada, provider incompatível, canal não conectado) ou nenhum destinatário/botão válido foi encontrado."
---
# thinkzap.bitrix.button_robot_refused

## O que significa
O app thinkzap tem dois robôs de fluxo (Bizproc) que enviam **mensagem com botões**: um para linha do WhatsApp Oficial e um para linha Z-API (WhatsApp não-oficial). Este erro indica que o fluxo acionou um dos dois, mas o robô recusou o disparo antes de enviar qualquer coisa: nenhuma mensagem saiu. O fluxo do parceiro **não** foi interrompido — o passo concluiu e o motivo foi escrito na timeline da entidade (negócio, lead, contato ou empresa) onde o fluxo estava rodando.

## Causa provável
- **Linha bloqueada ou com assinatura vencida**: a linha escolhida na configuração do robô não está mais habilitada.
- **Linha do provider errado para este robô**: o robô "WhatsApp Oficial" foi configurado com uma linha Z-API, ou o robô "Z-API" foi configurado com uma linha do WhatsApp Oficial.
- **Canal não conectado**: a linha é do provider certo, mas ainda não está com o número conectado (WhatsApp Oficial) ou não está confirmadamente conectada (Z-API).
- **Nenhum destinatário**: o campo de destino está vazio e a opção "enviar para todos os contatos relacionados" está desligada; ou a opção está ligada e a entidade não tem nenhum telefone válido nos contatos relacionados.
- **Sem botão válido**: a configuração do robô não tem nenhum botão preenchido, ou os botões preenchidos não são aceitos por aquele robô — o robô "WhatsApp Oficial" só aceita botão de link/ligação, sem resposta rápida.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.button_robot_refused`.
3. Leia no log qual foi o motivo da recusa e qual linha estava configurada.
4. Abra a entidade onde o fluxo rodou: o mesmo motivo está registrado na timeline dela, em português.

## Como resolver
1. Se o motivo foi a linha ou o provider: confirme qual dos dois robôs de botão está no fluxo ("WhatsApp Oficial" ou "Z-API") e peça ao parceiro que escolha uma linha ativa e conectada **desse mesmo provider** na configuração do robô.
2. Se o motivo foi o destinatário: confira o campo de destino da configuração (aceita um telefone digitado ou um campo da entidade) ou, com a opção de contatos relacionados ligada, confirme que a entidade tem contatos com telefone preenchido.
3. Se o motivo foi o botão: reabra a configuração do robô e preencha ao menos um botão válido para aquele provider.
4. Depois de corrigir, peça para reexecutar o fluxo e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a linha estiver do provider certo, ativa e conectada, o destino e os botões estiverem preenchidos corretamente e o robô continuar recusando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bitrix.button_robot_refused`, domínio/portal do parceiro, horário do evento, e-mail da conta, qual dos dois robôs de botão foi usado, o id da linha configurada e o fluxo envolvido.
