---
category: validation
audience: suporte
summary: Falta escolher o tipo de entidade de destino da importação no Bitrix24.
---
# importsheet.import.entity_type_required

## O que significa
Toda importação precisa saber **para onde** os dados vão dentro do Bitrix24: se cada
linha vai virar um lead, um negócio, um contato, uma empresa ou um item de SPA. Essa
escolha é a **entidade de destino**.

Este erro quer dizer que a importação foi salva ou colocada para rodar **sem que a
entidade de destino tenha sido escolhida**. Como o CRMThink não sabe em que tipo de
registro gravar os dados, a operação é barrada até que o destino seja definido.

## Causa provável
- O cliente montou a importação mas não selecionou a entidade/SPA de destino.
- A seleção de destino ficou em branco após alguma alteração na configuração.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.import.entity_type_required`.
3. Abra a configuração da importação e veja o campo de destino: ele está sem
   entidade selecionada.

## Como resolver
1. Oriente o parceiro a abrir a configuração da importação e **selecionar a entidade
   ou SPA de destino** (lead, negócio, contato, empresa ou item de SPA).
2. Peça que ele salve novamente e rode a importação.

## Quando escalar
Se a entidade de destino estiver selecionada na tela e o erro continuar, acione a
equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: importsheet.import.entity_type_required`, domínio do parceiro, id da importação
e horário.
