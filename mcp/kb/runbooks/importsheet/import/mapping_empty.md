---
category: validation
audience: suporte
summary: A importação foi salva ou executada sem nenhuma coluna ligada a um campo do Bitrix24.
---
# importsheet.import.mapping_empty

## O que significa
Para o CRMThink saber o que fazer com a planilha, é preciso montar o **de-para**:
ligar cada coluna da planilha ao campo correspondente do Bitrix24. É esse de-para
que diz, por exemplo, que a coluna "E-mail" da planilha vai para o campo de e-mail
do CRM.

Este erro quer dizer que a importação foi salva ou colocada para rodar **sem nenhuma
coluna mapeada** — o de-para está vazio. Sem ao menos uma coluna ligada a um campo,
não há o que importar, então a operação é barrada.

## Causa provável
- O cliente salvou a configuração antes de montar o de-para.
- Os mapeamentos foram removidos ou não chegaram a ser criados.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `errorCode: importsheet.import.mapping_empty`.
3. Abra a configuração da importação e veja a área de de-para: ela está sem nenhuma
   coluna ligada a um campo.

## Como resolver
1. Oriente o parceiro a abrir a configuração da importação e **mapear ao menos uma
   coluna** da planilha para um campo do Bitrix24, no de-para.
2. Peça que ele salve novamente e rode a importação.

## Quando escalar
Se houver colunas mapeadas na tela e o erro de de-para vazio continuar aparecendo,
acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: importsheet.import.mapping_empty`, domínio do parceiro, id da
importação e horário.
