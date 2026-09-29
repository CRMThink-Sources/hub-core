# thinkzap/destinos-crm Specification

## Purpose

Define quais telefones o ThinkZap oferece e usa como destino a partir de um Contato ou de uma Empresa do CRM do Bitrix24 — tanto na lista de destinos do widget de CRM quanto nos robôs do Bizproc executados sobre esses documentos.

## Requirements

### Requirement: Destinos a partir de um Contato
Ao resolver os destinos de um Contato, o sistema SHALL usar somente os telefones do próprio contato. O sistema NÃO SHALL incluir os telefones de empresas vinculadas ao contato, de outros contatos dessas empresas, nem do lead vinculado ao contato — independentemente de quantas empresas estejam vinculadas.

A regra SHALL valer igualmente para a lista de destinos do widget de CRM aberto na ficha do Contato e para os robôs do Bizproc (disparo, botão interativo e template) executados sobre um documento de Contato.

#### Scenario: Contato vinculado a várias empresas lista só os próprios telefones
- **WHEN** o operador abre o widget na ficha de um contato que tem os telefones A e B e está vinculado às empresas X e Y, cada uma com outros contatos com telefone
- **THEN** a lista de destinos contém exatamente os telefones A e B, identificados como do contato

#### Scenario: Contato com lead vinculado não traz o lead
- **WHEN** o operador abre o widget na ficha de um contato vinculado a um lead que tem telefone próprio
- **THEN** o telefone do lead não aparece na lista de destinos

#### Scenario: Contato sem telefone
- **WHEN** o operador abre o widget na ficha de um contato sem nenhum telefone, vinculado a uma empresa cujos contatos têm telefone
- **THEN** a lista de destinos fica vazia

#### Scenario: Robô de disparo em Contato atinge só o contato
- **WHEN** um robô de disparo do ThinkZap roda sobre um documento de Contato vinculado a uma empresa com outros contatos
- **THEN** a mensagem é enviada apenas para os telefones do próprio contato

#### Scenario: Telefones repetidos no contato
- **WHEN** o contato tem o mesmo telefone cadastrado mais de uma vez
- **THEN** o telefone aparece uma única vez na lista de destinos

### Requirement: Destinos a partir de uma Empresa
Ao resolver os destinos de uma Empresa, o sistema SHALL usar os telefones da própria empresa e os telefones de cada contato vinculado a ela. Um telefone que se repita entre a empresa e seus contatos SHALL aparecer uma única vez. A falha ao carregar um dos contatos vinculados NÃO SHALL impedir que os demais destinos sejam retornados.

A regra SHALL valer igualmente para a lista de destinos do widget de CRM aberto na ficha da Empresa e para os robôs do Bizproc executados sobre um documento de Empresa.

#### Scenario: Empresa com contatos vinculados
- **WHEN** o operador abre o widget na ficha de uma empresa com telefone E, vinculada aos contatos C1 (telefone T1) e C2 (telefone T2)
- **THEN** a lista de destinos contém E (identificado como da empresa), T1 e T2 (identificados como dos respectivos contatos)

#### Scenario: Empresa sem contatos vinculados
- **WHEN** o operador abre o widget na ficha de uma empresa com telefone E e nenhum contato vinculado
- **THEN** a lista de destinos contém somente E

#### Scenario: Telefone compartilhado entre empresa e contato
- **WHEN** a empresa e um de seus contatos têm o mesmo telefone
- **THEN** esse telefone aparece uma única vez na lista de destinos

#### Scenario: Um contato da empresa falha ao carregar
- **WHEN** a empresa está vinculada aos contatos C1 e C2 e a leitura de C2 no Bitrix falha
- **THEN** a lista de destinos contém os telefones da empresa e de C1
