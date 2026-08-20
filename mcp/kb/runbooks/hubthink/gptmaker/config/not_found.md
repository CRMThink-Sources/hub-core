---
category: config
audience: suporte
summary: A configuração do GPT Maker não foi salva pelo parceiro.
---
# gptmaker.config.not_found

## O que significa
A configuração do GPT Maker não foi encontrada para o portal do parceiro. Sem ela, o agente não sabe como atender.

## Causa provável
- O parceiro não salvou a configuração na tela de Configurações.
- A configuração foi limpa ou nunca chegou a ser preenchida.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.config.not_found`.
3. Confirme com o parceiro se ele chegou a salvar as Configurações do app.

## Como resolver
1. Oriente o parceiro a abrir a tela de Configurações do GPT Maker.
2. Peça para preencher os dados necessários e **salvar**.
3. Confirme na tela de Logs que o erro deixou de ocorrer.

## Quando escalar
Se o parceiro salvou a configuração e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.config.not_found`, domínio do parceiro e o horário do evento.
