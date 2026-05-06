
## O que vamos fazer

Criar um sistema de **áreas de entrega por bairro** no painel do lojista, onde cada bairro tem sua própria taxa de entrega, podendo ser ativado/desativado individualmente — similar ao Anota AI.

## O que muda para o lojista

- No painel, a seção de entrega ganha uma nova aba **"Áreas de entrega"** com:
  - Lista de bairros cadastrados com toggle de status (ativo/inativo), nome e valor da taxa
  - Botão **"+ Bairro"** para adicionar novo bairro com nome e taxa
  - Edição inline (lápis) e exclusão (lixeira) de cada bairro
  - Campo de busca para filtrar bairros
  - Contador de registros

## O que muda para o cliente

- No checkout, ao selecionar entrega, a taxa será calculada automaticamente com base no bairro do endereço do cliente
- Se o bairro não estiver cadastrado ou estiver inativo, o cliente verá uma mensagem informando que a entrega não está disponível para aquele bairro

## Detalhes técnicos

### 1. Nova tabela `store_delivery_areas`

```sql
CREATE TABLE public.store_delivery_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  neighborhood TEXT NOT NULL,
  fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, neighborhood)
);

ALTER TABLE public.store_delivery_areas ENABLE ROW LEVEL SECURITY;
```

RLS: leitura pública (para checkout), escrita apenas para owner/staff/admin.

### 2. Componente `StoreDeliveryAreasEditor`

Novo componente com:
- Lista com toggle, nome do bairro, valor formatado, botões editar/excluir
- Dialog para adicionar/editar bairro (nome + taxa)
- Busca por nome
- Integrado ao painel do lojista dentro da seção de entrega

### 3. Integração no `StoreDeliveryEditor`

Adicionar o componente de áreas abaixo das configurações gerais de entrega (quando entrega estiver habilitada).

### 4. Checkout — taxa dinâmica por bairro

No `CheckoutReviewDialog` e na sacola, ao calcular a taxa de entrega:
- Buscar o bairro do endereço do cliente na tabela `store_delivery_areas`
- Se encontrar e estiver ativo, usar a taxa do bairro
- Se não encontrar, usar a taxa padrão da loja (fallback) ou bloquear entrega
