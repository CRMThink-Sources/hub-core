---
category: integration
audience: suporte
summary: Falha ao baixar o áudio da chamada no Sonax, então ele não pôde ser anexado.
---
# sonax.job.audio_download_failed

## O que significa
Para anexar a gravação de uma ligação ao card no Bitrix24, o Sonax primeiro baixa o áudio a partir do SonaVoip.

Esse erro quer dizer que esse download falhou, então o áudio não pôde ser anexado. Costuma ser uma falha momentânea, e o Sonax reprocessa automaticamente na próxima rodada.

## Causa provável
- **Instabilidade momentânea** ao baixar o áudio do SonaVoip.
- **Falha temporária de comunicação** durante a transferência.
- **Gravação ainda sendo preparada** no momento do download.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.job.audio_download_failed`.
3. Verifique se o áudio acaba sendo anexado em uma rodada seguinte ou se nunca aparece no card.

## Como resolver
1. Na maioria dos casos, nenhuma ação é necessária — o Sonax tenta baixar de novo na próxima rodada.
2. Aguarde uma nova rodada de processamento e verifique se a gravação aparece no card.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Escale se um áudio nunca é anexado, mesmo após várias rodadas de reprocessamento. Acione a equipe de desenvolvimento e anexe: `traceKey`, `código de erro: sonax.job.audio_download_failed`, domínio do parceiro e o horário do evento.
