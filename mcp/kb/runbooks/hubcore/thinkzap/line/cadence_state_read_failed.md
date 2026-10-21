---
category: internal
audience: suporte
summary: O estado atual da cadência não pôde ser lido agora. Os envios continuam seguindo a cadência.
---
# thinkzap.line.cadence_state_read_failed

## O que significa
A aba Limites de envio abriu, mas o estado da janela de envio (quantas mensagens saíram, se está em pausa) não pôde ser lido. Os ajustes continuam editáveis e as mensagens continuam sendo enviadas no ritmo configurado.

## Causa provável
- **Indisponibilidade momentânea** do serviço que guarda o estado da janela.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.cadence_state_read_failed`.
3. Veja se o erro se repete em várias linhas ou instalações no mesmo horário.

## Como resolver
1. Oriente o parceiro a recarregar a tela em alguns instantes.

## Quando escalar
Se o erro persistir por mais de alguns minutos ou aparecer em várias instalações, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.cadence_state_read_failed`, domínio do parceiro e o horário do evento.
