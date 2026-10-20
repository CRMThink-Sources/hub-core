---
category: integration
audience: suporte
summary: O envio de arquivo da imagem do cabeçalho (widget ou criação de template) está indisponível.
---
# thinkzap.message.widget_header_image_storage_unavailable

## O que significa
No widget do CRM ou na criação de um template do WhatsApp Oficial, o operador enviou um arquivo como imagem do cabeçalho, mas o app thinkzap não conseguiu guardar a imagem. Nada foi enviado à Meta. O envio (ou a criação) do template continua possível informando um link da imagem.

## Causa provável
- **Instabilidade momentânea** do serviço que guarda as imagens.
- **Configuração ausente ou inválida** do armazenamento de imagens no ambiente (credenciais, nome do bucket).

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.widget_header_image_storage_unavailable`.
3. Veja se o erro aparece para vários parceiros no mesmo período: se sim, é instabilidade ou configuração do ambiente, não do parceiro.

## Como resolver
1. Oriente o operador a escolher "Usar link" e informar um link https público, direto para o arquivo da imagem. Assim o envio segue normalmente.
2. Peça para tentar o envio de arquivo de novo em alguns minutos.

## Quando escalar
Se o erro continuar por mais de alguns minutos ou aparecer para vários parceiros, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.message.widget_header_image_storage_unavailable`, domínio do parceiro e o horário do evento.
