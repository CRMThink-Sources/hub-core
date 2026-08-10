---
category: validation
audience: suporte
summary: O telefone de um contato veio inválido, então esse contato não pôde ser discado.
---
# sonax.preditiva.invalid_phone

## O que significa
Para discar, cada contato da campanha precisa de um telefone válido.

Esse erro quer dizer que o telefone de um contato veio inválido (em branco, incompleto ou fora de um formato que permita a ligação). Por isso, esse contato não pôde ser discado.

## Causa provável
- **Telefone em branco**: o contato foi cadastrado sem número.
- **Telefone incompleto ou com caracteres inválidos**: o número não está em um formato discável.
- **Dados incorretos na origem**: o telefone foi importado errado da base de origem.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.preditiva.invalid_phone`.
3. Confira, na origem dos contatos, o telefone do contato apontado e verifique se está válido.

## Como resolver
1. Peça ao parceiro para revisar o telefone do contato na origem.
2. Oriente a corrigir o número para um formato e valor válidos.
3. Peça para reenviar a discagem e acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o telefone está correto e válido na origem e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.preditiva.invalid_phone`, domínio do parceiro e o horário do evento.
