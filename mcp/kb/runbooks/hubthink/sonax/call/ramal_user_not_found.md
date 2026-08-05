---
category: config
audience: suporte
summary: Nenhum usuário do portal corresponde ao ramal desta chamada, então não há para quem registrá-la.
---
# sonax.call.ramal_user_not_found

## O que significa
Cada chamada chega com um ramal (telefone interno). O Sonax usa esse ramal para descobrir a qual usuário do Bitrix24 a chamada pertence.

Esse erro quer dizer que nenhum usuário do portal corresponde ao ramal desta chamada. Como não há usuário associado a esse ramal, não existe para quem registrar a ligação.

## Causa provável
- **Ramal não cadastrado em ninguém**: o ramal da chamada não está preenchido em nenhum usuário do Bitrix24.
- **Ramal cadastrado com valor diferente**: o ramal existe, mas foi digitado de forma diferente da que veio na chamada.
- **Usuário do ramal removido**: quem tinha esse ramal foi excluído do portal.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.call.ramal_user_not_found`.
3. Verifique qual ramal veio na chamada e confira, no Bitrix24 do parceiro, se algum usuário tem esse ramal cadastrado.

## Como resolver
1. Confira se o ramal da chamada corresponde ao telefone interno de algum usuário no Bitrix24.
2. Se não corresponder, oriente o parceiro a cadastrar esse ramal no usuário correto.
3. Peça para repetir a chamada e acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o ramal está corretamente cadastrado em um usuário e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.call.ramal_user_not_found`, domínio do parceiro e o horário do evento.
