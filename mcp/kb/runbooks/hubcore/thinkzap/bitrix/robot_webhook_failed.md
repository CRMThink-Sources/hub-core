---
category: integration
audience: suporte
summary: O disparo automático de WhatsApp pelo fluxo (robô) não pôde ser concluído.
---
# thinkzap.bitrix.robot_webhook_failed

## O que significa
O app thinkzap permite disparar mensagens de WhatsApp automaticamente por dentro de um fluxo do Bitrix24 (o "robô" do Bizproc). Este erro indica que, quando o fluxo tentou acionar esse disparo, o envio automático não pôde ser concluído. A mensagem programada pelo robô não seguiu.

## Causa provável
- **Linha inativa ou desconectada**: a linha de WhatsApp configurada no robô não está mais ativa ou perdeu a conexão.
- **Configuração do robô**: o robô no fluxo está apontando para uma linha que não existe mais ou com parâmetros incompletos.
- **Instabilidade momentânea**: houve uma falha passageira ao acionar o disparo.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.robot_webhook_failed`.
3. Leia na linha do log qual linha e qual fluxo estavam envolvidos, e a mensagem devolvida — ela indica se o problema foi a linha, a configuração do robô ou uma falha passageira.

## Como resolver
1. Confirme com o parceiro que a linha usada pelo robô está ativa e conectada (aba Conexão; se necessário, ler o QR Code novamente).
2. Revise a configuração do robô no fluxo do Bitrix24: se a linha certa está selecionada e se os campos obrigatórios estão preenchidos.
3. Após corrigir, peça para reexecutar o fluxo (ou aguardar o próximo disparo) e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a linha estiver ativa e conectada, a configuração do robô estiver correta e o disparo continuar falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bitrix.robot_webhook_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e os ids da linha e do fluxo envolvidos.
