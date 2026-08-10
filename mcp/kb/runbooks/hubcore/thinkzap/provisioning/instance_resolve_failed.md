---
category: validation
audience: suporte
summary: A linha não está conectada no WhatsApp.
---
# thinkzap.provisioning.instance_resolve_failed

## O que significa
A operação exigia uma linha conectada ao WhatsApp, mas a linha em questão **não está conectada**. Não é uma falha de integração externa: é o estado da linha — ela precisa ser conectada (ou reconectada) via QR Code para voltar a operar.

## Causa provável
- **Linha desconectada**: a sessão do WhatsApp caiu (celular sem internet, sessão encerrada no aparelho, muito tempo offline).
- **Nunca conectada**: a linha foi criada mas ainda não teve o QR Code lido.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.provisioning.instance_resolve_failed`.
3. Na aba Conexão, confirme o status da linha — deve aparecer como desconectada.

## Como resolver
1. Oriente o parceiro a abrir a aba Conexão e **ler o QR Code novamente** com o WhatsApp do aparelho responsável pela linha.
2. Confirme que o aparelho está com internet e com o WhatsApp aberto durante a leitura.
3. Com a linha conectada, peça para repetir a operação e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a linha aparece como conectada na aba Conexão e mesmo assim a operação diz que ela não está conectada, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.provisioning.instance_resolve_failed`, domínio/portal do parceiro, horário do evento, e-mail da conta e o id da linha.
