# Impressão automática de pedidos

## O que será feito

Quando um pedido mudar para **"Em produção"** (aceito manual ou pelo "Aceitar pedidos automaticamente"), o painel da loja imprime automaticamente um cupom térmico.

A impressão acontece **no navegador do painel** (computador/tablet do balcão), pois impressoras USB/Bluetooth só são acessíveis localmente.

## Como funciona para o lojista

1. Em **Painel → Pedidos**, aparece um novo botão **"Configurar impressora"**.
2. Ao clicar, o navegador pede para conectar a impressora (USB ou Bluetooth). A escolha fica salva no aparelho.
3. Um switch **"Imprimir automaticamente ao aceitar"** liga/desliga o comportamento.
4. Botão **"Imprimir cupom"** em cada card de pedido para reimpressão manual.
5. Botão **"Imprimir teste"** nas configurações para validar.

## Layout do cupom (58mm/80mm térmico)

```
========================================
        NOME DA LOJA
        Pedido #123
        14/05/2026 19:42
        Mesa 5  /  Delivery
----------------------------------------
CLIENTE: João Silva
Tel: (11) 99999-9999
End: Rua X, 100 - Bairro
----------------------------------------
ITENS
2x Pizza Calabresa (Grande)
   Borda: Catupiry
   Obs: sem cebola
1x Refrigerante 2L
----------------------------------------
Subtotal:           R$ 89,90
Entrega:            R$  5,00
Desconto:          -R$  4,00
TOTAL:              R$ 90,90

Pagamento: Dinheiro
Troco para: R$ 100,00 (R$ 9,10)
========================================
```

## Disparo automático

- O `OrdersManager` já escuta mudanças em `orders` via realtime.
- Adicionamos um listener: quando um pedido muda para `em_producao` (e o switch está ligado), envia o cupom para a impressora conectada.
- Funciona tanto para aceite manual quanto para o trigger `apply_auto_accept_on_order` que já existe.

## Detalhes técnicos

**Sem mudança de schema.** Toda a lógica é frontend:

- Nova lib `src/lib/thermal-printer.ts`:
  - `connectPrinter()` — usa **Web Bluetooth** (`navigator.bluetooth.requestDevice`) ou **Web Serial** (`navigator.serial.requestPort`) para impressoras USB. Faz fallback para imprimir via diálogo nativo do navegador (`window.print()` em iframe oculto) quando a API não estiver disponível (ex.: iOS).
  - `printOrder(order, items)` — gera comandos **ESC/POS** (CP858, corte de papel, alinhamento) e envia para a impressora.
  - Persiste o `deviceId` em `localStorage` para reconectar.
- Nova lib `src/lib/receipt-template.ts` — monta o conteúdo (texto + comandos ESC/POS) a partir de `orders` + `order_items` + `profiles`.
- Atualização em `src/components/painel/OrdersManager.tsx`:
  - Botões "Configurar impressora", "Imprimir teste", switch "Imprimir automaticamente".
  - Preferências (auto-print on/off, deviceId) salvas em `localStorage` por `store_id`.
  - No `onUpdate` do realtime, se `old.status !== 'em_producao' && new.status === 'em_producao'` e auto-print ligado → busca itens + cliente e chama `printOrder`.
  - Botão "Imprimir cupom" em cada card.

**Compatibilidade:**
- Web Bluetooth funciona em **Chrome/Edge desktop e Android**.
- Web Serial (USB) funciona em **Chrome/Edge desktop**.
- iOS/Safari não suportam — nesses casos cai para o diálogo de impressão nativa (cupom em HTML formatado para 58/80mm).

## Verificação

1. Abrir Painel → Pedidos → Configurar impressora → conectar.
2. Clicar "Imprimir teste" → cupom sai.
3. Ligar "Imprimir automaticamente".
4. Fazer um pedido como cliente → aceitar no painel → cupom imprime sozinho.
5. Repetir com "Aceitar pedidos automaticamente" ligado → cupom imprime ao chegar pedido novo.
