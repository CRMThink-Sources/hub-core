---
category: config
audience: suporte
summary: O usuário não tem ramal (telefone interno) configurado no Bitrix24, então a chamada não pôde ser associada.
---
# sonax.call.ramal_not_configured

## O que significa
O ramal é o telefone interno do usuário. É por meio dele que o Sonax liga uma chamada ao usuário certo dentro do Bitrix24.

Esse erro quer dizer que o usuário não tem ramal configurado no Bitrix24. Sem o ramal, a chamada não pôde ser associada a ele.

## Causa provável
- **Ramal nunca preenchido**: o usuário foi cadastrado, mas o campo de telefone interno ficou vazio.
- **Ramal apagado**: o ramal existia, mas foi removido do cadastro do usuário.
- **Ramal preenchido em outro campo**: o valor foi informado em um campo diferente do telefone interno.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.call.ramal_not_configured`.
3. No Bitrix24 do parceiro, abra o cadastro do usuário e verifique se o campo de telefone interno (ramal) está preenchido.

## Como resolver
1. Oriente o parceiro a abrir o cadastro do usuário no Bitrix24.
2. Peça para preencher o ramal no campo de telefone interno do usuário.
3. Salve e peça para repetir a chamada.
4. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o ramal está corretamente preenchido no telefone interno do usuário e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.call.ramal_not_configured`, domínio do parceiro e o horário do evento.
