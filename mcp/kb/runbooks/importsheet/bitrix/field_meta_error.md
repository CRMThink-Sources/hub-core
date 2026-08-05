---
category: integration
audience: suporte
summary: Ao montar a importação, o CRMThink não conseguiu carregar do Bitrix24 os campos, entidades, categorias ou usuários.
---
# importsheet.bitrix.field_meta_error

## O que significa
Quando o cliente está montando a importação, o CRMThink precisa perguntar ao
Bitrix24 quais entidades existem (lead, negócio, contato, empresa, itens de SPA),
quais categorias e campos cada uma tem e quais são os usuários disponíveis. É com
essa informação que a tela monta as listas do de-para e do responsável.

Este erro quer dizer que essa consulta ao Bitrix24 falhou. Sem esses dados, a tela
não consegue montar as opções e a configuração da importação fica travada — o
cliente não consegue avançar.

## Causa provável
- **O app perdeu a permissão de ler o CRM no Bitrix24** (mais comum): o CRMThink
  precisa de permissão de CRM para listar campos, entidades e usuários. Se essa
  permissão foi removida, o Bitrix24 recusa a consulta.
- **Autorização do app expirada ou revogada**: a credencial que o CRMThink usa para
  falar com o Bitrix24 deixou de valer, então nenhuma consulta é aceita.
- **Instabilidade momentânea do Bitrix24**: o Bitrix24 estava fora do ar ou lento no
  momento e não respondeu à consulta.

## Como verificar
1. Na tela de Logs do app importsheet, filtre pelo `traceKey` do ticket.
2. Confirme que a linha de erro tem `código de erro: importsheet.bitrix.field_meta_error`.
3. Na mesma linha, veja a mensagem que o Bitrix24 devolveu — ela costuma indicar se
   foi falta de permissão, autorização inválida ou instabilidade.

## Como resolver
1. Oriente o parceiro a confirmar, no Bitrix24, que o CRMThink continua instalado e
   que o app está com as permissões de CRM concedidas. Sem essa permissão, a
   consulta nunca vai passar.
2. Peça que ele feche e reabra a tela de configuração da importação. Isso refaz a
   consulta e resolve os casos de instabilidade momentânea.
3. Se o erro persistir, oriente o parceiro a reinstalar ou reautorizar o CRMThink no
   Bitrix24. Isso renova a autorização expirada ou revogada.
4. Peça para abrir a tela de novo e confirmar, na tela de Logs, que o erro não
   aparece mais.

## Quando escalar
Se o parceiro confirmou que o app está instalado e com as permissões de CRM, já
reautorizou o app, e o erro continua, acione a equipe de desenvolvimento. Anexe:
`traceKey`, `código de erro: importsheet.bitrix.field_meta_error`, domínio do parceiro, id da importação, horário e a mensagem que o
Bitrix24 devolveu no log.
