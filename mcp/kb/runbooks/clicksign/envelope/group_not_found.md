---
category: config
audience: suporte
summary: O grupo de assinatura usado no envio não existe mais nas configurações.
---
# clicksign.envelope.group_not_found

## O que significa
Um "grupo de assinatura" é uma configuração salva na tela de Configurações da integração que define quem assina e como o documento é montado. O robô do Bitrix24 que dispara o envio aponta para um desses grupos pelo nome. Nesse envio, o grupo apontado não foi encontrado na lista — ou seja, o robô pediu algo que não existe mais. Sem um grupo válido, o sistema não sabe como montar o documento e o envio para.

## Causa provável
- **Grupo apagado**: o grupo foi excluído das configurações depois que o robô do Bitrix24 já estava configurado apontando para ele.
- **Grupo renomeado**: o grupo mudou de nome, mas o robô continuou chamando pelo nome antigo, que já não existe.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.envelope.group_not_found`.
3. Peça ao parceiro para abrir Configurações > Assinatura e comparar os grupos que aparecem na lista com o grupo que o robô do Bitrix24 está usando. A diferença entre os dois é a causa do erro.

## Como resolver
1. Oriente o parceiro a abrir Configurações > Assinatura e conferir quais grupos realmente existem.
2. Peça que ele, no robô do Bitrix24, selecione um grupo que apareça nessa lista — assim o robô volta a apontar para algo que existe.
3. Se o grupo certo não existir mais, oriente o parceiro a recriá-lo em Configurações > Assinatura e depois ajustar o robô para usá-lo.
4. Peça que ele salve e reenvie o documento para confirmar que o envio passa.

## Quando escalar
Se o grupo aparece corretamente tanto nas configurações quanto no robô, mas o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.envelope.group_not_found`, domínio do parceiro, o horário do evento e o ID do negócio.
