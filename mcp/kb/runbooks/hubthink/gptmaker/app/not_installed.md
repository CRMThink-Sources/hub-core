---
category: config
audience: suporte
summary: O app GPT Maker não está instalado no portal do parceiro, então nada é processado.
---
# gptmaker.app.not_installed

## O que significa
O GPT Maker não está instalado no portal Bitrix24 do parceiro. Sem a instalação, o agente de IA não recebe nem responde conversas.

## Causa provável
- O app nunca foi instalado no portal.
- A instalação foi removida ou desfeita.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.app.not_installed`.
3. Confirme com o parceiro se o app aparece instalado no portal dele.

## Como resolver
1. Oriente o parceiro a instalar o GPT Maker no portal.
2. Após instalar, peça para abrir o app e concluir a configuração inicial.
3. Confirme na tela de Logs que o erro deixou de ocorrer.

## Quando escalar
Se o parceiro afirma que o app está instalado e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.app.not_installed`, domínio do parceiro e o horário do evento.
