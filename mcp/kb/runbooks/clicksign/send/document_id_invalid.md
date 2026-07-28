---
category: validation
audience: suporte
summary: A automação de envio mandou o identificador do documento em um formato que o CRMThink não entendeu.
---
# clicksign.send.document_id_invalid

## O que significa
Quando a automação do Bitrix24 (a ação automática de envio, chamada de "robô") dispara um envio, ela precisa dizer qual documento vai pra assinatura. Pra isso ela manda um identificador — um código que aponta exatamente qual documento daquele negócio deve ser usado. Este erro quer dizer que esse identificador chegou num formato inesperado: em vez de um código válido, veio algo vazio ou fora do padrão. Sem conseguir entender qual documento é, o CRMThink não sabe o que enviar e recusa a operação.

## Causa provável
- **A ação está lendo o campo errado** (mais comum): na configuração do envio, o parceiro apontou pra um campo do negócio que não é o do documento, então o que chega ali não serve como identificador.
- **O campo apontado está vazio ou é de outro tipo**: a ação aponta pro campo certo, mas naquele negócio ele está em branco, ou o campo guarda outro tipo de informação (um texto, uma data), não a referência de um documento.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.send.document_id_invalid`.
3. Oriente o parceiro a abrir, no Bitrix24, a automação de envio e conferir para qual campo do negócio a ação está apontando pra pegar o documento. Assim dá pra ver se é o campo certo e se ele está preenchido.

## Como resolver
1. Oriente o parceiro a abrir a ação de envio dentro da automação (o "robô") do Bitrix24.
2. Peça ao parceiro pra confirmar que o campo do documento aponta pro anexo ou campo correto do negócio — aquele que realmente guarda o documento a ser assinado. É desse campo que sai o identificador; se ele estiver errado ou vazio, o CRMThink não tem como saber o que enviar.
3. Oriente o parceiro a corrigir o apontamento na ação e testar um envio em um negócio que tenha o documento preenchido, pra confirmar que o identificador passa a ser reconhecido.

## Quando escalar
Se a ação está apontando pro campo de documento correto, esse campo está preenchido no negócio testado e o erro persiste, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.send.document_id_invalid`, domínio do parceiro, o horário do evento e o negócio onde o envio foi disparado.
