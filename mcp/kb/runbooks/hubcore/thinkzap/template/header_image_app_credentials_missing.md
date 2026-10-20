---
category: config
audience: suporte
summary: O envio de arquivo da imagem do cabeçalho não está disponível nesta conta.
---
# thinkzap.template.header_image_app_credentials_missing

## O que significa
O app thinkzap tentou criar um template do WhatsApp Oficial com uma imagem no cabeçalho enviada como arquivo. O provedor do WhatsApp Oficial recusou o envio do arquivo porque a conta não tem cadastradas as credenciais do app da Meta (App ID e App Secret), que são exigidas para esse tipo de envio. O template não foi enviado para aprovação. Não é instabilidade: é uma configuração da conta.

## Causa provável
- **Credenciais do app da Meta não cadastradas** no painel da Z-API Omni para a conta usada pela linha.
- **Credenciais removidas ou trocadas** no painel depois de terem funcionado.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.header_image_app_credentials_missing`.
3. Confirme que o parceiro escolheu "Enviar arquivo" na imagem de exemplo do template.

## Como resolver
1. Oriente o parceiro a criar o template escolhendo "Usar link" e informando um link https público, direto para o arquivo JPEG ou PNG. Esse caminho não depende das credenciais.
2. Se for preciso liberar o envio de arquivo, encaminhe o pedido de cadastro de App ID e App Secret da Meta no painel da Z-API Omni para quem administra a conta.
3. Depois do cadastro, peça para criar o template de novo com o arquivo e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se as credenciais estão cadastradas no painel e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.header_image_app_credentials_missing`, domínio do parceiro, o horário do evento e o nome do template.
