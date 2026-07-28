---
category: integration
audience: suporte
summary: O documento não tinha nenhum arquivo anexado na hora de enviar para assinatura.
---
# clicksign.envelope.file_missing

## O que significa
Para enviar algo para assinatura, o sistema precisa de um arquivo (o documento em si) anexado ao negócio no Bitrix24. Nesse envio ele foi procurar esse arquivo e não achou nenhum. Como não existe documento para assinar, o envelope nem chega a ser criado na Clicksign.

## Causa provável
- **Nenhum arquivo no negócio**: o negócio no Bitrix24 simplesmente não tem arquivo anexado, então não há o que enviar.
- **Arquivo removido no meio do caminho**: o arquivo existia quando o envio foi disparado, mas foi apagado ou movido antes de o sistema conseguir pegá-lo.
- **Falha ao baixar o arquivo**: o arquivo está lá, mas o link para baixá-lo expirou, então na prática o sistema não conseguiu enxergá-lo.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.envelope.file_missing`.
3. Peça ao parceiro para abrir o negócio no Bitrix24 e conferir se existe de fato um arquivo anexado.

## Como resolver
1. Oriente o parceiro a anexar o arquivo do documento no negócio do Bitrix24. Sem esse arquivo o sistema não tem o que mandar para a Clicksign.
2. Peça que ele reenvie o documento para assinatura pelo fluxo normal, agora que o arquivo está no lugar.
3. Confira nos Logs se, dessa vez, o envelope foi criado sem erro — é isso que confirma que o problema foi resolvido.

## Quando escalar
Se já existe arquivo anexado no negócio e mesmo assim o erro se repete, pode ser uma falha na hora de baixar o arquivo. Acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.envelope.file_missing`, domínio do parceiro, o horário do evento e o ID do negócio.
