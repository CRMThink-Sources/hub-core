---
category: integration
audience: suporte
summary: O bot não conseguiu ler o horário de atendimento do canal aberto e tratou a conversa como dentro do expediente.
---
# thinkzap.bot.working_hours_unavailable

## O que significa
O fluxo do ThinkBot tem um bloco de horário de atendimento, e a leitura do horário do canal aberto no Bitrix24 (`imopenlines.config.get`) falhou. O turno **não** é interrompido: o bot segue como se a conversa estivesse dentro do expediente.

O efeito visível para o parceiro é: "o bot respondeu fora do horário como se estivesse dentro" ou "o ramo de fora do expediente nunca dispara". A conversa em si não para.

## Causa provável
- **Canal aberto removido ou recriado** no portal enquanto o vínculo do fluxo apontava para ele.
- **Escopo `imopenlines` ausente** na instalação do app.
- **Instabilidade do Bitrix24**: falha pontual na chamada, que se resolve sozinha no próximo turno.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket ou pelo `chatId`.
2. Confirme `código de erro: thinkzap.bot.working_hours_unavailable`.
3. O log traz `lineId` (o `CONFIG_ID` do canal aberto), `domain` e `err` com a resposta do Bitrix.
4. A aba Logs do job mostra "Horário do canal indisponível | linha=…".
5. Se o erro aparece em todos os turnos daquele `lineId`, é estrutural; se aparece em turnos isolados, é instabilidade.

## Como resolver
1. Canal inexistente: vincular o fluxo ao canal aberto atual pelo ThinkBot.
2. Erro de permissão (`ACCESS_DENIED`, `insufficient_scope`): reinstalar o app liberando o escopo `imopenlines`.
3. Falha isolada: nenhuma ação, porque o próximo turno lê de novo.

## Quando escalar
Se o canal existe, o escopo está liberado e o erro continua em todo turno, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bot.working_hours_unavailable`, domínio do parceiro, `lineId` e o `err` do log.
