---
category: validation
audience: suporte
summary: A cadência precisa de números inteiros maiores que zero, e só existe para linha não oficial (Web).
---
# thinkzap.line.cadence_invalid

## O que significa
Ao salvar a aba Limites de envio, os valores do Cadenciador não foram aceitos. Nada foi gravado: a configuração anterior continua valendo. Não é falha técnica.

## Causa provável
- **Valor inválido**: com o Cadenciador ativado, "mensagens por janela" ou "duração da janela" está vazio, é zero, negativo ou tem casas decimais.
- **Pausa sem duração**: a pausa está ativada e a "duração da pausa" está vazia ou inválida.
- **Linha oficial**: o Cadenciador existe só para linhas não oficiais (Web).

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.cadence_invalid`.
3. Confira o tipo da linha (Web ou Business) e os valores que o parceiro tentou salvar.

## Como resolver
1. Em linha Web, oriente a informar inteiros maiores que zero nos campos ativados e salvar de novo.
2. Se o parceiro não quer pausa, desative a pausa: a duração deixa de ser exigida.
3. Em linha Business, explique que o Cadenciador não existe para esse tipo de linha.

## Quando escalar
Se os valores forem inteiros maiores que zero numa linha Web e o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.line.cadence_invalid`, domínio do parceiro, o horário do evento, o identificador da linha e os valores informados.
