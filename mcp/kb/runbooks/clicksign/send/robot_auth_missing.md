---
category: auth
audience: suporte
summary: A automação de envio disparou sem os dados que identificam o portal, então o CRMThink recusou o envio.
---
# clicksign.send.robot_auth_missing

## O que significa
No Bitrix24 existe uma automação que dispara o envio de documentos pra assinatura — uma ação automática dentro do fluxo do negócio (o Bitrix24 chama de "robô"). Toda vez que ela dispara, precisa mandar junto uma espécie de crachá que diz de qual portal o pedido está vindo (os dados de autenticação: o endereço do portal e uma senha de acesso). É por esse crachá que o CRMThink sabe de qual cliente é o envio. Este erro quer dizer que a automação disparou sem esse crachá. Sem saber de quem é o pedido, o CRMThink recusa o envio por segurança, e o documento não é enviado.

## Causa provável
- **A automação foi montada sem repassar os dados do portal** (mais comum): ao configurar a ação de envio, o parceiro não incluiu os dados de autenticação, então ela dispara "anônima".
- **Automação copiada de outro portal sem reconfigurar**: se o parceiro duplicou ou importou a automação de um portal diferente, os dados de autenticação do portal original não valem no novo, e o envio sai sem identificação válida.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.send.robot_auth_missing`.
3. Oriente o parceiro a abrir, no Bitrix24, a automação de envio e conferir se os dados de autenticação do portal estão preenchidos na ação. Se estiverem em branco, é a confirmação do problema.

## Como resolver
1. Oriente o parceiro a abrir a ação de envio dentro da automação (o "robô") do Bitrix24.
2. Peça ao parceiro pra garantir que a ação usa os dados de autenticação do portal atual, e não valores fixos que vieram de outro portal. É esse crachá que permite ao CRMThink identificar o cliente e aceitar o envio.
3. Se a ação veio de outro portal ou está inconsistente, oriente o parceiro a recriar a ação de envio do zero na automação e testar um envio. Recriar evita arrastar configurações erradas do portal antigo.

## Quando escalar
Se a automação está com os dados de autenticação do portal atual preenchidos corretamente e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.send.robot_auth_missing`, domínio do parceiro, o horário do evento e o negócio onde o envio foi disparado.
