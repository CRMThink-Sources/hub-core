---
category: config
audience: suporte
summary: A conta Clicksign escolhida no envio não bate com nenhuma cadastrada.
---
# clicksign.envelope.company_token_not_found

## O que significa
Cada conta da Clicksign é identificada por um "token", uma espécie de senha que fica guardada na tela de Configurações da integração e autoriza o envio por aquela empresa. O robô do Bitrix24 aponta para uma dessas empresas na hora de enviar. Nesse envio, a empresa/token apontada não foi encontrada no cadastro. Sem uma conta válida e autorizada, o sistema não tem por onde enviar o documento.

## Causa provável
- **Empresa removida**: a empresa/token foi apagada das configurações, mas o robô continuou apontando para ela.
- **Token trocado**: o token da empresa foi alterado depois de o robô ter sido configurado, então o que o robô guardava não vale mais.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.envelope.company_token_not_found`.
3. Peça ao parceiro para abrir Configurações e comparar a lista de empresas/tokens cadastrados com a empresa que o robô do Bitrix24 está usando. A divergência entre as duas é a causa do erro.

## Como resolver
1. Oriente o parceiro a abrir Configurações e conferir quais empresas/tokens estão realmente cadastrados.
2. Peça que ele, no robô do Bitrix24, selecione uma empresa que apareça nessa lista, para o robô voltar a apontar para uma conta válida.
3. Se a empresa certa não existir mais, oriente o parceiro a cadastrá-la novamente em Configurações e depois ajustar o robô.
4. Peça que ele salve e reenvie o documento para confirmar que o envio passa.

## Quando escalar
Se a empresa aparece corretamente tanto nas configurações quanto no robô, mas o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.envelope.company_token_not_found`, domínio do parceiro, o horário do evento e o ID do negócio.
