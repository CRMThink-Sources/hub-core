---
category: auth
audience: suporte
summary: A janela de conexão com o provedor expirou ou foi reaberta antes de terminar, e a conexão não se completou.
---
# thinkanalise.oauth.state_invalid_or_expired

## O que significa
Quando o parceiro conecta uma conta do Conta Azul ou do Bling, o CRMThink abre uma janela de autorização (popup) e cria, junto, um bilhete de segurança temporário que amarra aquela janela específica ao pedido de conexão. Quando a autorização volta, o CRMThink confere esse bilhete pra ter certeza de que é a mesma janela que ele abriu. Este erro quer dizer que o bilhete não bateu: ou ele já tinha vencido (a janela ficou aberta tempo demais) ou uma janela nova foi aberta por cima antes de a primeira terminar. Por segurança, o CRMThink não completa a conexão nesse caso.

## Causa provável
- **A janela de autorização ficou aberta tempo demais**: o parceiro abriu, saiu pra fazer outra coisa e só voltou a autorizar depois que o bilhete já tinha expirado.
- **Duas janelas de conexão abertas ao mesmo tempo**: o parceiro clicou em conectar mais de uma vez, ou reabriu a janela, e a autorização voltou pra uma janela que não era a atual.
- **A conexão foi interrompida no meio**: a janela foi fechada e reaberta antes de concluir, quebrando o vínculo com o bilhete original.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkanalise.oauth.state_invalid_or_expired`.
3. Veja no log qual é o sistema externo (o provider) que o parceiro tentava conectar.
4. Pergunte ao parceiro como foi a tentativa: se demorou pra autorizar, se abriu mais de uma janela ou se fechou e reabriu no meio. Isso confirma que é um problema de fluxo, não de credencial.

## Como resolver
1. Oriente o parceiro a **fechar todas as janelas** de conexão que estejam abertas e começar de novo, do zero.
2. Peça pra ele abrir a configuração do conector no CRMThink e clicar em conectar a conta **uma única vez**, sem abrir outra janela por cima.
3. Oriente a concluir a autorização **sem demorar** e sem sair da janela, pra que o bilhete de segurança ainda esteja válido quando a autorização voltar.
4. Confirme com o parceiro que a conta passou a aparecer como conectada e peça pra rodar a atualização do BI.

## Quando escalar
Se o parceiro seguiu o fluxo direto (uma janela só, sem demora) e a conexão continua falhando com esse erro, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkanalise.oauth.state_invalid_or_expired`, o sistema externo (provider) envolvido, o domínio do parceiro e o horário do evento.
