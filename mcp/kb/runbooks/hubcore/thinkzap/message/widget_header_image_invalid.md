---
category: validation
audience: suporte
summary: O arquivo escolhido como imagem do cabeçalho no widget não pode ser usado.
---
# thinkzap.message.widget_header_image_invalid

## O que significa
No widget do CRM, o operador escolheu um template com imagem no cabeçalho e enviou um arquivo como imagem. O app thinkzap conferiu o arquivo antes de guardá-lo e recusou: ele não é uma imagem JPEG ou PNG, ou passa de 5 MB. Nada foi guardado e nenhuma mensagem foi enviada. Não é instabilidade: é um problema com o arquivo escolhido.

## Causa provável
- **Arquivo que não é imagem JPEG/PNG**: PDF, WEBP, GIF, HEIC (foto de iPhone) ou um arquivo renomeado para `.png`/`.jpg`.
- **Imagem grande demais**: acima de 5 MB, comum em fotos tiradas direto do celular.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.widget_header_image_invalid`.
3. A mensagem do log diz se o problema foi o tipo do arquivo ou o tamanho.

## Como resolver
1. Peça ao operador para salvar a imagem como JPEG ou PNG (por exemplo, abrindo e exportando num editor de imagem) e, se necessário, reduzir o tamanho para menos de 5 MB.
2. Como alternativa, oriente a escolher "Usar link" e informar um link https público, direto para o arquivo da imagem.
3. Peça para tentar de novo e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o arquivo é JPEG ou PNG de menos de 5 MB e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.widget_header_image_invalid`, domínio do parceiro, o horário do evento e, se possível, o arquivo usado.
