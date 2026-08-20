---
category: integration
audience: suporte
summary: Falha ao anexar o áudio da chamada ao registro no Bitrix24, então a gravação não apareceu no card.
---
# sonax.job.attach_failed

## O que significa
Depois de baixar a gravação da ligação, o Sonax anexa esse áudio ao registro da chamada no Bitrix24, para que ele apareça no card.

Esse erro quer dizer que esse anexo falhou, então a gravação não apareceu no card. Costuma ser uma falha momentânea, e o Sonax reprocessa automaticamente na próxima rodada.

## Causa provável
- **Instabilidade momentânea** do Bitrix24 no momento de anexar.
- **Falha temporária de comunicação** com o portal durante o anexo.
- **Credencial de acesso ao portal com problema** no momento da operação.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.job.attach_failed`.
3. Verifique se a gravação acaba aparecendo no card em uma rodada seguinte ou se nunca é anexada.

## Como resolver
1. Na maioria dos casos, nenhuma ação é necessária — o Sonax tenta anexar de novo na próxima rodada.
2. Confira nas Configurações do Sonax se a credencial de acesso ao portal está válida.
3. Aguarde uma nova rodada e verifique se a gravação aparece no card.

## Quando escalar
Escale se o anexo continua falhando para a mesma chamada após várias rodadas. Acione a equipe de desenvolvimento e anexe: `traceKey`, `código de erro: sonax.job.attach_failed`, domínio do parceiro e o horário do evento.
