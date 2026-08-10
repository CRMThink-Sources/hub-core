---
category: integration
audience: suporte
summary: O áudio da chamada não foi encontrado no Sonax (ausente, vazio ou em formato inválido).
---
# sonax.job.audio_not_found

## O que significa
Depois de uma ligação, o Sonax busca a gravação de áudio no SonaVoip para anexá-la ao card no Bitrix24.

Esse erro quer dizer que essa gravação não foi encontrada no Sonax: ela pode estar ausente, vir vazia ou em um formato que não pôde ser usado. Vale lembrar que alguns tipos de chamada não geram áudio.

## Causa provável
- **Gravação ainda não disponível**: o áudio pode não ter terminado de ser processado no momento da busca.
- **Chamada sem gravação**: alguns tipos de chamada (por exemplo, muito curtas ou não atendidas) não geram áudio.
- **Áudio vazio ou em formato inválido** retornado pelo SonaVoip.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.job.audio_not_found`.
3. Confira, no painel Sonax, se a gravação daquela chamada existe.

## Como resolver
1. Verifique no painel Sonax se a gravação existe para a chamada em questão.
2. Se o tipo de chamada não gera áudio, é o comportamento esperado — nenhuma ação é necessária.
3. Se a gravação deveria existir, aguarde uma nova rodada de processamento e acompanhe na tela de Logs.

## Quando escalar
Se a gravação existe no painel Sonax mas nunca é encontrada para anexo, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.job.audio_not_found`, domínio do parceiro e o horário do evento.
