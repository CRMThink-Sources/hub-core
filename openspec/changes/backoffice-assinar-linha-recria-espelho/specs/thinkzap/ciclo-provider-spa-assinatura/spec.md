## MODIFIED Requirements

### Requirement: A marca de assinado acompanha todo caminho de subscribe e é limpa no unsubscribe
Todo subscribe bem-sucedido feito pelo produto SHALL gravar a marca de assinado do recurso. Isso inclui o checkout Stripe, a linha adicional, o provisionamento via SPA, os gatilhos das SPAs 1146 e 1142 e a ação manual "assinar" do backoffice. Todo unsubscribe bem-sucedido, inclusive a ação manual "desassinar" do backoffice, SHALL limpar a marca. Regravar o espelho no provisionamento SHALL NOT apagar uma marca que já exista.

Quando a ação manual do backoffice for aceita pelo provider e o espelho do recurso não existir, o sistema SHALL recriar o espelho a partir do item (provider, credencial e assinatura pai) e SHALL gravar a marca em seguida. Se o item não tiver assinatura pai e o espelho não puder ser criado, o sistema SHALL informar ao chamador que o provider foi acionado mas a marca não foi registrada, e SHALL NOT responder como se a marca tivesse sido gravada.

#### Scenario: Checkout Stripe marca as linhas
- **WHEN** o checkout Stripe ativa uma assinatura e assina as linhas dela
- **THEN** cada linha recebe a marca de assinado, e um UPDATE posterior nesses itens não assina de novo

#### Scenario: Desassinatura e reativação
- **WHEN** um item é cancelado (unsubscribe) e depois volta para `active` com a assinatura ainda ativa
- **THEN** a marca foi limpa no cancelamento, e a reativação assina de novo e grava a marca de novo

#### Scenario: Assinar pelo backoffice com o espelho ausente
- **WHEN** o suporte aciona "assinar" numa linha Z-API ou HubMessage cujo espelho do recurso não existe no Redis, e o provider aceita
- **THEN** o espelho é recriado com a credencial e a assinatura pai do item, a marca de assinado é gravada e a listagem passa a mostrar o recurso como assinado

#### Scenario: Desassinar pelo backoffice com o espelho ausente
- **WHEN** o suporte aciona "desassinar" numa linha cujo espelho não existe, e o provider aceita
- **THEN** o espelho é recriado e a marca de desassinado é gravada

#### Scenario: Assinar pelo backoffice com o espelho presente
- **WHEN** o suporte aciona "assinar" numa linha cujo espelho existe
- **THEN** a marca de assinado é gravada no espelho existente, sem recriá-lo nem perder os demais campos

#### Scenario: Item sem assinatura pai
- **WHEN** o suporte aciona "assinar" num item sem assinatura pai e sem espelho, e o provider aceita
- **THEN** a resposta informa que o provider foi acionado e a marca não pôde ser registrada, e o motivo é logado como aviso

#### Scenario: Provider recusa
- **WHEN** o provider recusa a operação manual do backoffice
- **THEN** nenhuma marca é gravada nem o espelho é criado, e o erro chega ao chamador como hoje
