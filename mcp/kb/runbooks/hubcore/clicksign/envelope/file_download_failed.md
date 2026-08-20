---
category: integration
audience: suporte
summary: O arquivo estava anexado, mas o sistema não conseguiu baixá-lo para enviar.
---
# clicksign.envelope.file_download_failed

## O que significa
O arquivo do documento existe no negócio do Bitrix24, mas na hora de baixá-lo para mandar à Clicksign o sistema não conseguiu. Diferente de "não tinha arquivo", aqui o arquivo até aparece, só que ficou inacessível no momento do envio. Sem conseguir pegar o arquivo, o documento não é criado na Clicksign.

## Causa provável
- **Link do arquivo expirou**: o Bitrix24 gera um link temporário para o arquivo. Se esse link já venceu, o sistema bate numa porta fechada.
- **Arquivo movido ou removido**: o arquivo foi tirado do lugar depois que o envio começou, então o endereço que o sistema tinha não aponta mais para nada.
- **Falta de permissão**: a integração não teve autorização para acessar aquele arquivo no Bitrix24, e por isso foi barrada.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.envelope.file_download_failed`.
3. Peça ao parceiro para abrir o negócio no Bitrix24 e clicar no arquivo anexado, para ver se ele carrega normalmente. Se nem ele consegue abrir, o problema está no próprio arquivo.

## Como resolver
1. Oriente o parceiro a localizar, no negócio, o arquivo que deveria ser enviado.
2. Se o arquivo não abrir ou não existir mais, peça que ele reanexe o arquivo correto ao negócio — isso gera um novo link válido para o sistema baixar.
3. Peça que ele confirme que o arquivo abre normalmente ao clicar nele, garantindo que está acessível.
4. Oriente o parceiro a reenviar o documento pela Clicksign.

## Quando escalar
Se o arquivo abre normalmente no Bitrix24 e mesmo assim o erro continua após reenviar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.envelope.file_download_failed`, domínio do parceiro, o horário do evento e o ID do negócio.
