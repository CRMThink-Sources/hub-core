---
category: validation
audience: suporte
summary: A campanha de SMS usou um template com imagem no cabeçalho.
---
# thinkzap.template.image_header_not_supported

## O que significa
Uma campanha de SMS do Bitrix24 tentou enviar, pelo WhatsApp Oficial, um template que tem uma imagem no cabeçalho. A Meta exige a imagem em todo envio desse template, e a campanha de SMS não tem um campo para informá-la. Por isso o envio foi recusado antes de sair, e nada foi cobrado. Não é instabilidade: é uma limitação da campanha de SMS.

## Causa provável
- **Template com imagem escolhido na campanha**: o provedor de SMS registrado aponta para um template aprovado com imagem no cabeçalho.
- **Template alterado na Meta**: o template não tinha imagem quando foi registrado na campanha e foi substituído por uma versão com imagem.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.image_header_not_supported`.
3. Veja no log o nome e o idioma do template usado pela campanha.
4. Na configuração da linha oficial no ThinkZap, na aba de templates da campanha, confira se esse template aparece marcado como indisponível para a campanha.

## Como resolver
1. Oriente o parceiro a usar na campanha um template sem imagem no cabeçalho.
2. Se a imagem for necessária, oriente a enviar esse template pelo robô de template da automação ou pelo widget do CRM, que pedem a URL da imagem.
3. Peça para disparar a campanha de novo e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se o template usado não tem imagem no cabeçalho e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.image_header_not_supported`, domínio do parceiro, o horário do evento e o nome e idioma do template.
