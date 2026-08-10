---
category: validation
audience: suporte
summary: Não foi encontrado nenhum assinante para o documento na hora de enviar.
---
# clicksign.envelope.no_signers

## O que significa
Na hora de montar a lista de quem vai assinar, o sistema não encontrou nenhum assinante. Sem assinante, o documento não pode ser enviado pra assinatura — ele nem chega a ser criado na Clicksign.

## Causa provável
- **Campos do negócio vazios**: os assinantes saem de campos do negócio no Bitrix24 (nome, e-mail, CPF). Se estão em branco, não há de quem montar a lista.
- **Mapeamento errado**: o grupo de assinatura pode estar apontando pros campos errados do negócio, então o sistema busca o assinante no lugar errado e não acha nada.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.envelope.no_signers`.
3. Peça ao parceiro para abrir o negócio no Bitrix24 e conferir se os campos de assinante (nome, e-mail, CPF) estão realmente preenchidos.

## Como resolver
1. Oriente o parceiro a preencher, no negócio, os campos de assinante que estiverem vazios (nome, e-mail, CPF). Sem esses dados a Clicksign não sabe pra quem mandar.
2. Peça que ele confira, em Configurações > Assinatura, se o mapeamento do grupo aponta pros campos certos do negócio — se apontar pro campo errado, o dado existe mas o sistema não o encontra.
3. Peça que ele salve e reenvie o documento para confirmar que a lista de assinantes foi montada.

## Quando escalar
Se os campos estão preenchidos e o mapeamento certo, mas ainda dá erro, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.envelope.no_signers`, domínio do parceiro, o horário do evento e o ID do negócio.
