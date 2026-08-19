---
category: config
audience: suporte
summary: "O robô de envio de template não disparou: a linha configurada não pode enviar template (bloqueada, Z-API, ou canal não conectado) ou nenhum destinatário foi encontrado."
---
# thinkzap.bitrix.template_robot_refused

## O que significa
O app thinkzap tem um robô de fluxo (Bizproc) que envia **template aprovado** do WhatsApp Oficial. Este erro indica que o fluxo acionou o robô, mas ele recusou o disparo antes de enviar qualquer coisa: nenhuma mensagem saiu e nada foi cobrado pela Meta. O fluxo do parceiro **não** foi interrompido — o passo concluiu e o motivo foi escrito na timeline da entidade (negócio, lead, contato ou empresa) onde o fluxo estava rodando.

## Causa provável
- **Linha bloqueada ou com assinatura vencida**: a linha escolhida na configuração do robô não está mais habilitada.
- **Linha que não envia template**: a linha configurada é Z-API (WhatsApp não-oficial). Template só existe no WhatsApp Oficial.
- **Canal não conectado**: a linha é do WhatsApp Oficial, mas o número ainda não concluiu a conexão, então não há catálogo de template para enviar.
- **Nenhum destinatário**: o campo de destino está vazio e a opção "enviar para todos os contatos relacionados" está desligada; ou a opção está ligada e a entidade não tem nenhum telefone válido nos contatos relacionados.
- **Template não configurado**: a configuração do robô foi salva sem escolher o template.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.template_robot_refused`.
3. Leia no log qual foi o motivo da recusa e qual linha estava configurada.
4. Abra a entidade onde o fluxo rodou: o mesmo motivo está registrado na timeline dela, em português.

## Como resolver
1. Se o motivo foi a linha: peça ao parceiro que abra a configuração do robô no fluxo e escolha uma linha do **WhatsApp Oficial** que esteja ativa e conectada. A tela de configuração só lista as linhas elegíveis — uma linha que sumiu da lista é uma linha que não pode mais enviar template.
2. Se o motivo foi o destinatário: confira o campo de destino da configuração (ele aceita um telefone digitado ou um campo da entidade) ou, com a opção de contatos relacionados ligada, confirme que a entidade tem contatos com telefone preenchido.
3. Se o motivo foi o template: reabra a configuração do robô e escolha o template aprovado que deve ser enviado.
4. Depois de corrigir, peça para reexecutar o fluxo e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a linha estiver ativa, conectada e aparecendo na lista da tela de configuração, o destino estiver preenchido e o robô continuar recusando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bitrix.template_robot_refused`, domínio/portal do parceiro, horário do evento, e-mail da conta, o id da linha configurada e o fluxo envolvido.
