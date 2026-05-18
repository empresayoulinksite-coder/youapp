# Entregas no painel do lojista

Hoje, no painel `Gestor de Pedidos` (`/pedidos-loja/$storeId`), o submenu **Entregas** abre os itens, mas eles linkam para as páginas do admin (`/admin/entregas/*`), que mostram todas as lojas. Vamos criar versões dessas páginas dentro do próprio painel da loja, já com o `storeId` da loja logada.

## O que será feito

### 1. Novas rotas escopadas pela loja
Criar 3 arquivos de rota no padrão TanStack (flat dot-separated), filhas do painel da loja:

```
src/routes/pedidos-loja.$storeId.entregas.cadastro.tsx   -> /pedidos-loja/:storeId/entregas/cadastro
src/routes/pedidos-loja.$storeId.entregas.relatorio.tsx  -> /pedidos-loja/:storeId/entregas/relatorio
src/routes/pedidos-loja.$storeId.entregas.areas.tsx      -> /pedidos-loja/:storeId/entregas/areas
```

Cada uma:
- Lê `storeId` via `Route.useParams()`.
- Valida no carregamento se o usuário é dono/staff dessa loja (mesma checagem já usada em `pedidos-loja.$storeId.tsx`). Se não for, redireciona para `/painel`.
- Renderiza o conteúdo já escopado nessa loja — sem listagem de "todas as lojas".

### 2. Conteúdo de cada página
- **Áreas de entrega**: reutiliza o `<StoreDeliveryAreasEditor storeId={storeId} />` já redesenhado no estilo Anota AI, com o header (ícone roxo, título, subtítulo) e o cabeçalho com a logo/nome da loja em cima — mesmo visual do `/admin/entregas/areas` quando uma loja está selecionada, porém pulando o passo de selecionar (já está fixo na loja do lojista).
- **Cadastro entregadores** e **Relatório entregadores**: mantêm o mesmo conteúdo placeholder atual das versões admin (texto explicativo), porém com título contextualizado à loja. A funcionalidade interna desses dois é o conteúdo atual do admin (ainda placeholder) — quando você quiser implementar de verdade, fazemos depois.

### 3. Sidebar do painel do lojista
Em `src/routes/pedidos-loja.$storeId.tsx` (linhas 398-401), trocar os 3 `to` para as novas rotas escopadas, passando `params={{ storeId }}`:

```
/pedidos-loja/$storeId/entregas/cadastro
/pedidos-loja/$storeId/entregas/relatorio
/pedidos-loja/$storeId/entregas/areas
```

Os 3 links continuam dentro do mesmo grupo colapsável "Entregas" e mantêm os mesmos ícones (UserPlus, FileText, MapPin) e estilo atual.

### 4. Admin permanece igual
`/admin/entregas/cadastro`, `/admin/entregas/relatorio` e `/admin/entregas/areas` não são alterados — o admin segue vendo/gerenciando todas as lojas como hoje.

## Banco de dados / RLS
Nada a alterar. A tabela `store_delivery_areas` já tem política que permite ao dono da loja (`is_store_owner`) gerenciar suas áreas, então o `StoreDeliveryAreasEditor` filtrado por `storeId` do lojista funcionará sem novas migrations.

## Fora do escopo
- Implementar de fato o cadastro/relatório de entregadores (continuam como tela placeholder, igual ao admin hoje).
- Mexer em permissões — o dono já tem acesso.
