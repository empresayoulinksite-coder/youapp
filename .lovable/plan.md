
## O que será feito

Implementar o módulo "Pedidos salão" (que já existe como item de navegação mas mostra "em desenvolvimento") com um sistema de **Mesas e Comandas** inspirado no Anota Aí, conforme as imagens de referência.

### Layout e funcionalidades

1. **Abas superiores**: "Mesas" e "Comandas" (toggle entre os dois modos)

2. **Barra de filtros**:
   - Campo de busca (Nº da mesa / Nº da comanda)
   - Filtro por status: Todos, Livre, Ocupada, Fechando conta
   - Legenda com indicadores coloridos (verde = Livre, laranja = Ocupada, cinza = Fechando conta)

3. **Grid de cards** (3 colunas):
   - Cada card mostra: número da mesa/comanda, botão "+ Pedido", botão dropdown com opções
   - Barra colorida no rodapé indicando status (verde = Livre, etc.)
   - Ao clicar "+ Pedido", abre o PDV vinculado àquela mesa/comanda

4. **Menu dropdown** de cada card:
   - "+ Novo Pedido" — abre o PDV vinculado à mesa
   - "Imprimir QR Code" — gera e exibe QR Code da mesa (link para o cardápio digital da loja com parâmetro de mesa)

5. **Botões de ação no topo**:
   - "+ Criar comanda" / "+ Criar mesa"
   - "+ Novo pedido"

6. **QR Code da mesa**:
   - Gera um QR Code com a URL do cardápio digital da loja + parâmetro `?mesa=N`
   - Dialog para visualizar e imprimir

### Detalhes técnicos

**Banco de dados** (nova tabela):
- `store_tables` — id, store_id, number, label (ex: "Mesa #1"), type (mesa/comanda), status (livre/ocupada/fechando_conta), created_at
- RLS: donos e staff da loja podem gerenciar

**Componente**: `src/components/painel/TablesManager.tsx`
- Grid responsivo de cards
- Integração com PDVManager para criar pedidos vinculados a mesas
- QR Code gerado via biblioteca `qrcode.react`

**Atualização**: `src/routes/pedidos-loja.$storeId.tsx`
- "Pedidos salão" passa a renderizar `TablesManager`

**Dependência**: `qrcode.react` para geração do QR Code
