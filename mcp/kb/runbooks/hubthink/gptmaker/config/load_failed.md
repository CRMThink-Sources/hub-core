---
category: integration
audience: suporte
summary: Falha ao ler ou gravar a configuração do GPT Maker no Bitrix24.
---
# gptmaker.config.load_failed

## O que significa
O GPT Maker tentou ler ou gravar a configuração no Bitrix24 e a operação falhou. Costuma ser uma falha momentânea de comunicação.

## Causa provável
- Instabilidade momentânea de comunicação com o Bitrix24.
- O portal do parceiro estava indisponível no momento.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.config.load_failed`.
3. Verifique se o erro se repete ou foi pontual.

## Como resolver
1. Peça ao parceiro para abrir as Configurações e salvar novamente.
2. Se foi momentâneo, a operação volta a funcionar na próxima tentativa.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o erro persiste a cada tentativa, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.config.load_failed`, domínio do parceiro e o horário do evento.
