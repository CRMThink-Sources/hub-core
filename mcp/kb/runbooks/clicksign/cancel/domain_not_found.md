---
category: config
audience: suporte
summary: O portal do cancelamento veio certo, mas não está cadastrado na nossa base.
---
# clicksign.cancel.domain_not_found

## O que significa
O pedido de cancelamento chegou com o portal de origem, mas quando o CRMThink foi procurar esse portal na sua lista de portais conhecidos, não encontrou. É como receber uma carta com remetente, mas esse endereço não existir no nosso cadastro. Na prática, o portal só entra nessa lista quando o app Clicksign é instalado nele; se não está lá, é sinal de que a instalação nunca aconteceu ou não terminou. Sem reconhecer o portal, o CRMThink não segue com o cancelamento.

## Causa provável
- **App Clicksign nunca instalado no portal**: sem instalar o app no portal do cliente no Bitrix24, o portal nunca é registrado na nossa base — por isso ele fica "desconhecido".
- **Instalação não concluída**: o parceiro começou a instalar o app mas o processo não foi até o fim, então o registro do portal não chegou a ser criado.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.cancel.domain_not_found`.
3. Anote o domínio do parceiro que aparece no log — é ele que precisamos localizar (ou não) na base.

## Como resolver
1. Peça ao parceiro pra confirmar se o app Clicksign aparece instalado no Bitrix24 do portal, porque é a instalação que cria o registro que está faltando.
2. Se não estiver instalado, oriente o parceiro a instalar o app no portal — assim o portal passa a existir na nossa base e o cancelamento consegue reconhecê-lo.
3. Depois de instalar, peça ao parceiro pra refazer o cancelamento pela timeline do negócio, pra validar que agora o portal é reconhecido.

## Quando escalar
Se o app já estiver instalado no portal e o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.cancel.domain_not_found`, domínio do parceiro e o horário do evento.
