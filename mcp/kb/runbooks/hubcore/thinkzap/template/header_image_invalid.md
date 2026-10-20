---
category: validation
audience: suporte
summary: A imagem do cabeçalho do template não pode ser usada.
---
# thinkzap.template.header_image_invalid

## O que significa
O app thinkzap tentou criar um template do WhatsApp Oficial com uma imagem no cabeçalho, mas a imagem de exemplo informada não pode ser usada. O template não foi enviado para aprovação. Não é instabilidade: é um problema com o link da imagem.

## Causa provável
- **Link que não é https** ou que não abre publicamente (exige login, está fora do ar).
- **Link que abre uma página, e não o arquivo**: por exemplo, link de visualização do Google Drive ou de rede social.
- **Arquivo que não é JPEG nem PNG**, ou que passa de 5 MB.
- **Link do próprio WhatsApp/Meta** (copiado de outro template ou de uma conversa): a Meta não aceita esse link como exemplo.
- **A Meta recusou a imagem** depois de receber o template (amostra inválida, ou não conseguiu baixar o link).

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.header_image_invalid`.
3. Leia a mensagem do log: ela diz qual foi o problema com a imagem (tamanho, tipo, link da Meta, link inacessível).
4. Abra o link da imagem numa janela anônima do navegador: tem de abrir só a imagem, sem página em volta.

## Como resolver
1. Peça ao parceiro um link https público que abra direto o arquivo JPEG ou PNG, com até 5 MB.
2. Se a imagem estiver no Drive ou numa rede social, oriente a hospedar em um site ou serviço de arquivos que gere link direto.
3. Peça para criar o template de novo com o link corrigido e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o link abre direto a imagem, é JPEG/PNG de até 5 MB e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.header_image_invalid`, domínio do parceiro, o horário do evento e o link da imagem usado.
