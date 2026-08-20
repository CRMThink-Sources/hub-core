---
category: validation
audience: suporte
summary: A linha não está conectada no WhatsApp.
---
# thinkzap.line.disconnected

## O que significa
A linha tem assinatura, mas a conexão com o WhatsApp caiu — o aparelho não está mais pareado. Sem essa conexão, nada é enviado nem recebido. Não é falha de cobrança nem de dados: é preciso reconectar a linha lendo o QR Code novamente.

## Causa provável
- **Sessão do WhatsApp caiu**: o celular ficou sem internet, o WhatsApp foi desconectado do aparelho ou a sessão expirou.
- **Aparelho desligado ou fora de alcance**: o telefone que mantém a linha ficou indisponível.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.disconnected`.
3. Na aba Conexão, veja se a linha aparece como desconectada.

## Como resolver
1. Oriente o parceiro a abrir a aba Conexão e ler o QR Code novamente com o celular da linha.
2. Peça para manter o celular com internet e o WhatsApp aberto no aparelho.
3. Com a linha reconectada, peça para repetir a operação e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a linha não reconectar mesmo após ler o QR Code corretamente, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.disconnected`, domínio do parceiro, o horário do evento e o identificador da linha.
