---
category: validation
audience: suporte
summary: A lista de registros da campanha voltou em branco, então não há contatos para discar.
---
# sonax.preditiva.empty_list

## O que significa
Para discar, a campanha precisa ter uma lista de contatos. O Sonax busca esses registros na campanha antes de iniciar as ligações.

Esse erro quer dizer que a lista de registros da campanha voltou em branco. Como não há contatos, não há para quem discar.

## Causa provável
- **Campanha sem contatos**: nenhum contato foi cadastrado na campanha.
- **Contatos já consumidos**: todos os contatos da campanha já foram discados.
- **Filtro que zerou a lista**: algum critério da campanha deixou a lista vazia.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.preditiva.empty_list`.
3. Confira, no painel Sonax, se a campanha tem contatos válidos cadastrados.

## Como resolver
1. Peça ao parceiro para verificar, no painel Sonax, se a campanha tem contatos cadastrados.
2. Se estiver vazia, oriente a incluir contatos válidos na campanha.
3. Peça para reenviar a discagem e acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se a campanha tem contatos válidos cadastrados e a lista continua vindo em branco, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.preditiva.empty_list`, domínio do parceiro e o horário do evento.
