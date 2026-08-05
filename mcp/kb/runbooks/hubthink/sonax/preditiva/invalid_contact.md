---
category: validation
audience: suporte
summary: A identificação ou o nome de um contato veio inválido, então o contato não pôde ser processado.
---
# sonax.preditiva.invalid_contact

## O que significa
Cada contato de uma campanha precisa ter uma identificação e um nome válidos para ser incluído na discagem.

Esse erro quer dizer que um contato veio com a identificação ou o nome inválidos (em branco ou fora do formato esperado). Por isso, esse contato não pôde ser processado.

## Causa provável
- **Nome em branco**: o contato foi cadastrado sem nome.
- **Identificação em branco ou inválida**: o campo de identificação do contato está vazio ou incorreto.
- **Dados corrompidos na origem**: o contato veio com informações incompletas da base de origem.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.preditiva.invalid_contact`.
3. Confira, na origem dos contatos, se a identificação e o nome do contato estão preenchidos corretamente.

## Como resolver
1. Peça ao parceiro para revisar os dados do contato na origem.
2. Oriente a preencher corretamente a identificação e o nome do contato.
3. Peça para reenviar a discagem e acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se os dados do contato estão corretos na origem e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.preditiva.invalid_contact`, domínio do parceiro e o horário do evento.
