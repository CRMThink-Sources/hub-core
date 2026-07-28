---
category: integration
audience: suporte
summary: O documento foi assinado, mas o CRMThink não conseguiu baixar o arquivo final.
---
# clicksign.document.signed_file_download_failed

## O que significa
Depois que todos assinam, o CRMThink busca na Clicksign o arquivo final assinado pra anexar de volta ao negócio no Bitrix24, fechando o ciclo. Esse erro quer dizer que a assinatura foi concluída, mas na hora de baixar esse arquivo da Clicksign o download falhou — ou por um problema no caminho, ou porque o arquivo passou do limite de 25 MB que o CRMThink consegue processar. Na prática, o documento está assinado normalmente na Clicksign, mas pode não ter sido anexado de volta ao negócio.

## Causa provável
- **Arquivo assinado maior que 25 MB**: acima desse tamanho o CRMThink não dá conta de baixar e anexar, então o download é interrompido.
- **Instabilidade momentânea ao baixar da Clicksign**: um soluço passageiro na conexão com a Clicksign fez o download falhar mesmo com o arquivo dentro do limite.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.document.signed_file_download_failed`.
3. Peça ao parceiro pra ver no painel da Clicksign o tamanho do documento assinado — é isso que separa o caso de "arquivo grande demais" do caso de "instabilidade".

## Como resolver
1. Peça ao parceiro pra conferir no painel da Clicksign o tamanho do documento assinado, porque o tamanho aponta direto pra causa.
2. Se passar de 25 MB, oriente o parceiro a reduzir o tamanho do documento original (menos imagens ou páginas) nos próximos envios, já que acima do limite o download não vai concluir mesmo tentando de novo.
3. Como o documento assinado está íntegro na Clicksign, oriente o parceiro a baixá-lo manualmente pelo painel da Clicksign e anexar ao negócio, pra não deixar o cliente sem o arquivo final enquanto isso.

## Quando escalar
Se o arquivo estiver abaixo de 25 MB e o download continuar falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.document.signed_file_download_failed`, domínio do parceiro, o horário do evento e o identificador do envelope.
