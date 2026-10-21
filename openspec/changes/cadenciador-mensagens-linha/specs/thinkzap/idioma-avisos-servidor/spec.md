# Spec Delta

## MODIFIED Requirements

### Requirement: Avisos do chat do canal aberto
Os avisos que o servidor posta no chat do canal aberto para o operador SHALL seguir o idioma da instalação:

- o aviso de janela de 24h fechada da linha oficial;
- o aviso de falha no envio de botões pela tela do canal aberto. A parte fixa do texto é traduzida; o motivo vindo da validação de botões SHALL aparecer como veio;
- o aviso de recusa da Meta depois do aceite, em todas as variantes: por código da Meta, por texto reconhecido, sem motivo informado e a genérica. Na variante genérica, o retorno do provedor SHALL aparecer como veio;
- o resumo do bot na transferência: o título e o texto de "cliente não respondeu nada". Os rótulos definidos pelo autor do fluxo e as respostas do contato SHALL aparecer como foram escritos;
- o aviso de que a resposta do operador aguarda a janela de envio da cadência, com o horário previsto de saída.

#### Scenario: Janela de 24h fechada em inglês
- **WHEN** a instalação está em `en` e o operador responde um contato fora da janela de 24h numa linha oficial
- **THEN** o aviso de janela fechada no chat sai em inglês

#### Scenario: Recusa da Meta por código em espanhol
- **WHEN** a instalação está em `es` e a Meta recusa uma mensagem com o código 131026
- **THEN** o aviso no chat sai em espanhol, com o motivo de número sem WhatsApp

#### Scenario: Recusa genérica preserva o retorno do provedor
- **WHEN** a instalação está em `en` e a Meta recusa com um código sem variante própria
- **THEN** a parte fixa do aviso sai em inglês e o retorno do provedor aparece como veio

#### Scenario: Resumo do bot com rótulos do autor
- **WHEN** a instalação está em `en` e o bot transfere uma conversa em que coletou "Nome: Maria"
- **THEN** o título do resumo sai em inglês e a linha "Nome: Maria" aparece como foi escrita

#### Scenario: Aviso de espera da cadência em inglês
- **WHEN** a instalação está em `en` e a resposta do operador é adiada pela cadência da linha
- **THEN** o aviso de espera no chat sai em inglês, com o horário previsto de saída
