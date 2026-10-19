---
category: integration
audience: suporte
summary: Um arquivo do robô de envio não pôde ser obtido do Bitrix24 e não foi enviado; o texto e os demais arquivos seguiram.
---
# thinkzap.bitrix.robot_file_unavailable

## O que significa
O robô "Enviar mensagem" do thinkzap, usado dentro de um fluxo do Bitrix24, pode enviar arquivos junto com o texto. Este erro indica que um desses arquivos não pôde ser obtido do Bitrix24, por isso não foi enviado. O texto e os outros arquivos do mesmo disparo seguiram normalmente, e o comentário na timeline do card lista o arquivo como "não foi possível obter o arquivo".

## Causa provável
- **Arquivo enviado direto na configuração do robô**: o robô só envia arquivos que estão num campo de arquivo do próprio card (negócio, lead, contato, empresa ou processo inteligente). Arquivo anexado direto no robô não é suportado.
- **Fluxo fora do CRM**: o fluxo roda numa lista universal ou em outro lugar sem card, então não há campo de arquivo de onde buscar.
- **Arquivo removido do campo**: o arquivo foi apagado ou trocado no card entre o disparo e a leitura.
- **Falha ao baixar**: o Bitrix24 não respondeu ou recusou o download naquele momento.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.robot_file_unavailable`.
3. Veja o motivo na linha do log:
   - `not_in_document`: o arquivo não está em nenhum campo de arquivo do card (casos 1 ou 3 acima);
   - `no_crm_document`: o fluxo não roda sobre um card do CRM (caso 2 acima);
   - `crm_item_read_failed`: não foi possível ler o card no Bitrix24;
   - `download_failed`: o card foi lido, mas o arquivo não baixou.

## Como resolver
1. Abra a configuração do robô no fluxo e confirme que a propriedade **Arquivo** está ligada a um campo de arquivo do card, e não a um arquivo anexado direto no robô.
2. Abra o card e confirme que o campo tem o arquivo.
3. Para `crm_item_read_failed` ou `download_failed`, peça para reexecutar o fluxo. Se foi uma falha passageira, o arquivo sai no novo disparo.

## Quando escalar
Se o robô estiver ligado a um campo de arquivo do card, o arquivo estiver no campo e o erro continuar aparecendo com `crm_item_read_failed` ou `download_failed`, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bitrix.robot_file_unavailable`, domínio/portal do parceiro, horário do evento, id do card e o motivo que aparece no log.
