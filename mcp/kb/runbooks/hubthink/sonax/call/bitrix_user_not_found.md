---
category: validation
audience: suporte
summary: O usuário que originou a chamada não foi encontrado no Bitrix24 do portal.
---
# sonax.call.bitrix_user_not_found

## O que significa
Quando uma chamada acontece, o Sonax precisa saber qual usuário do Bitrix24 ela pertence, para registrar a ligação na pessoa certa.

Esse erro quer dizer que o usuário que originou a chamada não foi encontrado no Bitrix24 do portal. Sem identificar esse usuário, a chamada não pode ser associada corretamente.

## Causa provável
- **Usuário inexistente ou removido**: o usuário não existe mais no Bitrix24 do parceiro.
- **Usuário inativo**: o usuário existe, mas está desativado no Bitrix24.
- **Ramal apontando para o usuário errado**: o ramal vinculado à chamada não corresponde a nenhum usuário válido.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.call.bitrix_user_not_found`.
3. Confirme, no Bitrix24 do parceiro, se o usuário da chamada existe e está ativo, e confira o ramal vinculado a ele.

## Como resolver
1. Peça ao parceiro para confirmar que o usuário existe e está ativo no Bitrix24.
2. Verifique se o ramal usado na chamada está corretamente vinculado a esse usuário.
3. Corrija o cadastro do usuário ou o vínculo do ramal e peça para repetir a chamada.
4. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o usuário existe, está ativo e com ramal correto, e mesmo assim o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.call.bitrix_user_not_found`, domínio do parceiro e o horário do evento.
