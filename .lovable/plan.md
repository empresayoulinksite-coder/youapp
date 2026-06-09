## Objetivo

Adicionar uma aba **"Gestão"** na barra de abas do `/admin/loja/$storeId` (junto a Informações, Horários, Serviços, Agendamentos, Feed, YouFlow) que abre o painel completo de gestão da loja (`/painel`) — onde o dono abre/fecha caixa, faz sangria/suprimento, vê clientes e relatórios.

O painel `/painel` (arquivo `src/routes/painel.tsx`) já existe e já tem tudo: caixa, Visão geral, Agendamentos, Serviços, Cupons, Clientes, Academia. Só falta o atalho visível.

## Mudanças

**Arquivo único:** `src/routes/admin.loja.$storeId.tsx`

1. Importar o ícone `LayoutDashboard` do `lucide-react`.
2. Adicionar uma nova `<TabsTrigger value="gestao">` com o ícone, no final da lista de abas (depois de YouFlow, antes do bloco Admin Stories/Cupons).
3. Adicionar o `<TabsContent value="gestao">` correspondente, renderizando um card de destaque com botão grande "Abrir painel de gestão" que navega para `/painel` (a rota detecta automaticamente as lojas do dono).
4. Aba visível para todos os tipos de loja (food, ecommerce, service) já que `/painel` atende todos.

## Fora de escopo

- Mudar o painel em si.
- Mudar permissões (a rota `/painel` já valida via `useAuth` + `store_owners`).
- Embed do painel inteiro como aba (manteríamos rota separada porque ele tem layout próprio com seleção de loja, caixa no topo, etc.).
