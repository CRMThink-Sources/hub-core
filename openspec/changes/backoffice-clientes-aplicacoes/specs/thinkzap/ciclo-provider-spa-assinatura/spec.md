# Spec Delta

## MODIFIED Requirements

### Requirement: A marca de assinado acompanha todo caminho de subscribe e é limpa no unsubscribe
Todo subscribe bem-sucedido feito pelo produto SHALL gravar a marca de assinado do recurso. Isso inclui:
- o checkout Stripe;
- a linha adicional;
- o provisionamento via SPA;
- os gatilhos das SPAs 1146 e 1142;
- as ações do backoffice: "Assinar no provider" por linha e "Assinar todas no provider".

Todo unsubscribe bem-sucedido SHALL limpar a marca e gravar a de desassinado. Isso inclui o "Desassinar no provider" por linha do backoffice. Regravar o espelho no provisionamento SHALL NOT apagar uma marca que já exista.

As ações por linha do backoffice SHALL chamar o provider mesmo quando a marca já indica o estado pedido. Depois do sucesso, elas SHALL regravar a marca, para que marca e provider voltem a concordar.

#### Scenario: Checkout Stripe marca as linhas
- **WHEN** o checkout Stripe ativa uma assinatura e assina as linhas dela
- **THEN** cada linha recebe a marca de assinado, e um UPDATE posterior nesses itens não assina de novo

#### Scenario: Desassinatura e reativação
- **WHEN** um item é cancelado (unsubscribe) e depois volta para `active` com a assinatura ainda ativa
- **THEN** a marca foi limpa no cancelamento, e a reativação assina de novo e grava a marca de novo

#### Scenario: Assinar pelo backoffice marca a linha
- **WHEN** o suporte usa "Assinar no provider" numa linha sem marca
- **THEN** o subscribe é chamado e a linha recebe a marca de assinado
- **AND** um UPDATE posterior do item não assina de novo

#### Scenario: Desassinar pelo backoffice marca a linha
- **WHEN** o suporte usa "Desassinar no provider" numa linha assinada de uma assinatura ativa
- **THEN** o unsubscribe é chamado e a linha passa a ter a marca de desassinado
- **AND** um UPDATE posterior da SPA 1142 com a assinatura `cancelled` não chama o provider de novo para essa linha
