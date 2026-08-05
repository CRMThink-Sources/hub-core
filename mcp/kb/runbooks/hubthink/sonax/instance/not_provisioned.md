---
category: config
audience: suporte
summary: O parceiro ainda não tem uma instância de telefonia provisionada, então a telefonia não funciona.
---
# sonax.instance.not_provisioned

## O que significa
Para que as chamadas funcionem, cada parceiro precisa ter uma instância de telefonia provisionada — é ela que conecta o SonaVoip ao Bitrix24 daquele parceiro.

Esse erro quer dizer que o parceiro ainda não tem essa instância de telefonia provisionada. Enquanto o provisionamento não for concluído, a telefonia não opera.

## Causa provável
- **Provisionamento nunca iniciado**: o parceiro ainda não passou pela etapa que cria a instância de telefonia.
- **Provisionamento não concluído**: o processo começou, mas parou no meio.
- **Instância removida**: a instância existia, mas deixou de existir depois.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.instance.not_provisioned`.
3. Verifique, para o domínio do parceiro, se há uma instância de telefonia ativa. A ausência dela confirma a causa.

## Como resolver
1. Oriente o parceiro a abrir a tela do Sonax para disparar ou concluir o provisionamento da instância de telefonia.
2. Aguarde a conclusão do provisionamento e peça para repetir a ação que gerou o erro.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o parceiro tentou provisionar e o processo falha ou nunca conclui, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.instance.not_provisioned`, domínio do parceiro e o horário do evento.
