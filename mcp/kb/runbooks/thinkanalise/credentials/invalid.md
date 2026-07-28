---
category: auth
audience: suporte
summary: A credencial (chave de API ou conta) do parceiro para o sistema externo é inválida ou expirou.
---
# thinkanalise.credentials.invalid

## O que significa
O app thinkanalise leva pro BI do Bitrix24 os dados que ficam guardados em sistemas financeiros e de ERP externos (como Asaas, Bling, Conta Azul, Omie e Sonax). Pra buscar esses dados, o CRMThink precisa de uma credencial do parceiro — uma chave de API ou uma conta conectada — que funciona como a senha de acesso àquele sistema. Este erro quer dizer que o sistema externo recebeu essa credencial e não a aceitou: ela está inválida, foi trocada ou já venceu. Na prática, o BI não consegue puxar os dados daquele sistema até a credencial ser corrigida.

## Causa provável
- **A chave de API foi trocada ou revogada no sistema externo**: se o parceiro gerou uma chave nova, apagou a antiga ou revogou o acesso, a credencial que está salva no CRMThink deixa de valer.
- **A credencial venceu**: alguns sistemas externos têm chaves com prazo de validade. Passado o prazo, a mesma credencial que funcionava passa a ser recusada.
- **A credencial foi digitada errada ao configurar**: um caractere a mais, um espaço nas pontas ou uma chave colada pela metade fazem o sistema externo recusar.
- **A conta do parceiro no sistema externo mudou de plano ou foi desativada**: em alguns casos a credencial deixa de valer porque a própria conta perdeu o acesso à API.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: thinkanalise.credentials.invalid`.
3. Na mesma linha do log, veja qual é o sistema externo (o provider) envolvido — Asaas, Bling, Conta Azul, Omie ou Sonax. É nesse sistema que a credencial precisa ser conferida.
4. Peça ao parceiro pra confirmar, no painel daquele sistema externo, se a chave de API atual é a mesma que está salva na configuração do conector.

## Como resolver
1. Oriente o parceiro a entrar no painel do sistema externo (Asaas, Bling, Conta Azul, Omie ou Sonax, conforme o log) e conferir ou gerar de novo a chave de API. É essa chave válida que reabre o acesso do BI aos dados.
2. Peça que ele copie a chave por inteiro, **sem espaços nas pontas**, e cole de novo na configuração do conector no CRMThink, salvando em seguida. Um espaço ou pedaço faltando já faz o sistema externo recusar.
3. Se o acesso for por conta conectada (não por chave), oriente o parceiro a reconectar a conta do provedor, porque a conexão anterior perdeu a validade.
4. Depois de atualizar, peça pra ele rodar de novo a atualização do BI e confirme na tela de Logs que o erro não se repete.

## Quando escalar
Se o parceiro confirmou que a chave de API é a mesma e está ativa no painel do sistema externo, e o erro continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: thinkanalise.credentials.invalid`, o sistema externo (domínio/provider) envolvido, o domínio do parceiro e o horário do evento.
