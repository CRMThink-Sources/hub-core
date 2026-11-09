## ADDED Requirements

### Requirement: Seleção de template no widget com caixa de pesquisa
No widget do CRM, quando a linha selecionada é do WhatsApp Oficial, o seletor de template SHALL oferecer uma caixa de pesquisa dentro da lista aberta. Ao digitar, a lista SHALL ser filtrada imediatamente, sem nova chamada à API, e SHALL mostrar apenas os templates aprovados cujo nome, idioma ou texto do corpo contenha o texto buscado. A busca SHALL ignorar maiúsculas/minúsculas e acentos. Quando o texto tiver várias palavras, o template SHALL casar somente se contiver todas elas, em qualquer ordem e em qualquer um dos campos. Texto buscado vazio ou só com espaços SHALL mostrar a lista completa.

Cada item da lista SHALL mostrar o nome e o idioma do template e um trecho do corpo, para distinguir templates de nome parecido.

#### Scenario: Busca por nome
- **WHEN** a linha tem os templates `promo_natal`, `promo_pascoa` e `boleto_vencido` e o operador digita "promo"
- **THEN** a lista mostra só `promo_natal` e `promo_pascoa`

#### Scenario: Busca pelo corpo do template
- **WHEN** o template `lembrete_1` tem o corpo "Seu boleto vence amanhã" e o operador digita "boleto"
- **THEN** `lembrete_1` aparece na lista

#### Scenario: Busca sem diferenciar acento e maiúscula
- **WHEN** o corpo de um template contém "Cobrança" e o operador digita "COBRANCA"
- **THEN** esse template aparece na lista

#### Scenario: Várias palavras
- **WHEN** o operador digita "promo natal"
- **THEN** a lista mostra só templates que contêm as duas palavras, mesmo que em campos diferentes (por exemplo, "promo" no nome e "natal" no corpo)

#### Scenario: Mesmo nome em idiomas diferentes
- **WHEN** a linha tem `boas_vindas` em `pt_BR` e em `en_US` e o operador digita "en_us"
- **THEN** a lista mostra só `boas_vindas` em `en_US`

#### Scenario: Limpar a busca
- **WHEN** o operador apaga o texto da caixa de pesquisa
- **THEN** a lista volta a mostrar todos os templates aprovados

### Requirement: Estado sem resultado na busca de template
Quando nenhum template casar com o texto buscado, a lista SHALL mostrar a mensagem "Nenhum template encontrado" no lugar dos itens, sem alterar o template já selecionado.

#### Scenario: Nada encontrado
- **WHEN** o operador digita um texto que nenhum template contém
- **THEN** a lista mostra "Nenhum template encontrado" e o template selecionado antes permanece selecionado

### Requirement: Escolha do template preserva o comportamento atual do widget
Escolher um template na lista com busca SHALL ter o mesmo efeito de escolher no seletor anterior: o template é identificado pelo par nome+idioma, as variáveis do corpo e dos botões do template anterior são descartadas, e a origem da imagem do cabeçalho é reavaliada. O seletor SHALL continuar desabilitado enquanto os templates carregam, enquanto o envio está em andamento ou quando a linha não tem templates aprovados, e SHALL continuar mostrando o template escolhido quando fechado. A lista SHALL poder ser usada apenas com o teclado (abrir, navegar pelos resultados, escolher e fechar) e em telas estreitas.

#### Scenario: Trocar de template descarta valores
- **WHEN** o operador preencheu variáveis de `promo_natal`, pesquisa "boleto" e escolhe `boleto_vencido`
- **THEN** o preview e os campos passam a ser os de `boleto_vencido` e os valores digitados antes são descartados

#### Scenario: Seletor desabilitado enquanto carrega
- **WHEN** os templates da linha ainda estão carregando
- **THEN** o seletor aparece desabilitado com o texto "Carregando templates..."

#### Scenario: Template escolhido visível fechado
- **WHEN** o operador escolheu `promo_natal` em `pt_BR` e fecha a lista
- **THEN** o seletor mostra "promo_natal - pt_BR"

#### Scenario: Uso só com teclado
- **WHEN** o operador abre a lista, digita parte do nome, navega com as setas e confirma com Enter
- **THEN** o template destacado é escolhido e a lista fecha
