---
category: validation
audience: suporte
summary: O limite diário precisa ser um número inteiro maior que zero, e só existe para linha não oficial (Web).
---
# thinkzap.line.daily_limit_invalid

## O que significa
Ao salvar os ajustes da linha (ou liberar um limite temporário), o valor informado para o limite diário não foi aceito. Nada foi gravado: a configuração anterior continua valendo. Não é falha técnica.

## Causa provável
- **Valor inválido**: o limite ou a quantidade extra está vazio, é zero, negativo ou tem casas decimais.
- **Linha oficial**: o limite diário existe só para linhas não oficiais (Web). Linhas Business (WhatsApp oficial) não têm essa configuração, porque seguem os limites da própria Meta.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.daily_limit_invalid`.
3. Confira o tipo da linha (Web ou Business) e o valor que o parceiro tentou salvar.

## Como resolver
1. Em linha Web (não oficial), oriente a informar um número inteiro maior que zero e salvar de novo.
2. Em linha Business (oficial), explique que o limite diário não existe para esse tipo de linha.

## Quando escalar
Se o parceiro informar um inteiro maior que zero numa linha Web (não oficial) e o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.daily_limit_invalid`, domínio do parceiro, o horário do evento, o identificador da linha e o valor informado.
