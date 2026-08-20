---
category: validation
audience: suporte
summary: O pedido de discagem preditiva chegou sem campanha e/ou sem contatos, então não há o que discar.
---
# sonax.preditiva.missing_campaign_or_contacts

## O que significa
A discagem preditiva liga automaticamente para uma lista de contatos dentro de uma campanha. Para começar, o pedido precisa trazer a campanha e a lista de contatos.

Esse erro quer dizer que o pedido chegou sem a campanha e/ou sem os contatos. Sem essas informações, não há o que discar.

## Causa provável
- **Campanha não selecionada**: o parceiro enviou o pedido sem escolher a campanha.
- **Lista de contatos vazia**: nenhum contato foi selecionado para a discagem.
- **Envio incompleto**: a ação foi disparada antes de terminar o preenchimento.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.preditiva.missing_campaign_or_contacts`.
3. Confirme com o parceiro se a campanha e a lista de contatos foram realmente selecionadas antes do envio.

## Como resolver
1. Oriente o parceiro a selecionar a campanha desejada.
2. Peça para selecionar a lista de contatos que serão discados.
3. Só então enviar o pedido de discagem preditiva.
4. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se a campanha e os contatos foram corretamente selecionados e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.preditiva.missing_campaign_or_contacts`, domínio do parceiro e o horário do evento.
