import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Filter, Trash2, Save, X, Plus, Minus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PizzaBuilderDialog } from "@/components/PizzaBuilderDialog";
import { cn } from "@/lib/utils";

type PDVItem = {
  cartItemId: string;
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  pizza_flavors?: any[];
  pizza_crust_name?: string | null;
  pizza_addons?: any[];
  pizza_size_name?: string | null;
};

export function PDVManager({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  
  // Cart State
  const [cartItems, setCartItems] = useState<PDVItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerDoc, setCustomerDoc] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("pickup");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro / Balcão");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  
  // Pizza State
  const [pizzaBuilderItem, setPizzaBuilderItem] = useState<any>(null);

  // Queries
  const { data: store } = useQuery({
    queryKey: ["pdv-store", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("name, slug, emoji, image_url, payment_methods_list").eq("id", storeId).single();
      return data;
    }
  });

  const storePaymentMethods = Array.isArray(store?.payment_methods_list) 
    ? store!.payment_methods_list 
    : ["Dinheiro / Balcão", "Cartão de Crédito", "Cartão de Débito", "Pix"];

  const { data: pastCustomers = [] } = useQuery({
    queryKey: ["pdv-customers", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("customer_notes")
        .eq("store_id", storeId)
        .not("customer_notes", "is", null)
        .order("created_at", { ascending: false })
        .limit(300);
      
      const customers = new Map<string, { name: string, doc: string }>();
      (data || []).forEach((row: any) => {
        if (!row.customer_notes) return;
        const match = row.customer_notes.match(/Cliente: (.*?) \| Fone: (.*?) \| Doc: (.*?)(?:\n|$)/);
        if (match) {
          const [, name, phone, doc] = match;
          const cleanPhone = phone.replace(/\D/g, "");
          if (cleanPhone && !customers.has(cleanPhone)) {
            customers.set(cleanPhone, { name: name.trim(), doc: doc.trim() });
          }
        }
      });
      return Array.from(customers.entries()).map(([phone, info]) => ({ phone, ...info }));
    }
  });

  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val);
    const cleanPhone = val.replace(/\D/g, "");
    if (cleanPhone.length >= 10) {
      const found = pastCustomers.find(c => c.phone === cleanPhone);
      if (found) {
        if (!customerName && found.name) setCustomerName(found.name);
        if (!customerDoc && found.doc) setCustomerDoc(found.doc);
      }
    }
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["pdv-categories", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("position");
      if (error) throw error;
      return data;
    }
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["pdv-items", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("position");
      if (error) throw error;
      return data;
    }
  });

  // Memos
  const filteredItems = useMemo(() => {
    let res = items;
    if (filterCat !== "all") {
      res = res.filter(i => i.category_id === filterCat);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      res = res.filter(i => i.name.toLowerCase().includes(term));
    }
    return res;
  }, [items, filterCat, search]);

  const subtotal = cartItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const total = Math.max(0, subtotal - discount);

  // Handlers
  const addToCart = (item: any) => {
    const category = categories.find((c: any) => c.id === item.category_id);
    if (category?.is_pizza) {
      setPizzaBuilderItem(item);
      return;
    }

    // Basic add (ignoring variations for now, using base price)
    const existing = cartItems.find(c => c.menu_item_id === item.id);
    if (existing) {
      setCartItems(cartItems.map(c => c.cartItemId === existing.cartItemId ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCartItems([...cartItems, {
        cartItemId: Math.random().toString(36).substr(2, 9),
        menu_item_id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: 1
      }]);
    }
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCartItems(cartItems.map(c => {
      if (c.cartItemId === cartItemId) {
        return { ...c, quantity: Math.max(0, c.quantity + delta) };
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const removeItem = (cartItemId: string) => {
    setCartItems(cartItems.filter(c => c.cartItemId !== cartItemId));
  };

  // Mutation
  const createOrder = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      if (cartItems.length === 0) throw new Error("O pedido está vazio");

      // Insert Order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id, // Lojista
          store_id: storeId,
          store_name: store?.name ?? "Loja",
          store_slug: store?.slug ?? "",
          store_emoji: store?.emoji ?? null,
          total: total,
          discount: discount,
          delivery_address: orderType === "pickup" ? "Retirada Balcão" : "Endereço não informado",
          delivery_type: orderType === "pickup" ? "pickup" : "delivery",
          payment_method: paymentMethod,
          customer_notes: `Cliente: ${customerName} | Fone: ${customerPhone} | Doc: ${customerDoc}\nObs: ${notes}`,
          whatsapp_message: "Pedido manual via PDV",
          status: "em_analise", // Cria como em_analise para evitar possíveis restrições de RLS no Insert
        })
        .select("id")
        .single();
      
      if (orderError) throw orderError;

      // Insert Items
      const orderItemsRows = cartItems.map(i => ({
        order_id: order.id,
        menu_item_id: i.menu_item_id,
        name: i.name,
        quantity: i.quantity,
        unit_price: i.price,
        pizza_flavors: i.pizza_flavors || null,
        pizza_crust_name: i.pizza_crust_name || null,
        pizza_addons: i.pizza_addons || null,
        pizza_size_name: i.pizza_size_name || null
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItemsRows);
      if (itemsError) throw itemsError;

      // Avança o pedido para produção diretamente
      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: "em_producao" })
        .eq("id", order.id);
      
      if (updateError) throw updateError;

      return order;
    },
    onSuccess: () => {
      toast.success("Pedido criado com sucesso!");
      setCartItems([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerDoc("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["orders-manager", storeId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar pedido");
    }
  });

  return (
    <div className="flex h-full flex-col md:flex-row gap-4 bg-[#f5f6f8] text-slate-800">
      
      {/* Left side: Catalog */}
      <div className="flex flex-1 flex-col bg-white rounded-lg shadow-sm border overflow-hidden">
        
        {/* Top filters/search */}
        <div className="p-3 border-b flex flex-wrap gap-2 items-center bg-gray-50">
          <Button variant="outline" className="h-9 gap-2 font-medium" onClick={() => setFilterCat("all")}>
            <Filter className="h-4 w-4" /> [F] Filtros
          </Button>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              className="h-9 pl-9 bg-white" 
              placeholder="[P] Pesquisar" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-muted-foreground ml-auto hidden md:flex items-center gap-1">
            <span className="font-semibold text-slate-700">ENTER</span> Selecionar item
          </div>
        </div>

        {/* Categories Tab (Quick filter) */}
        <div className="flex gap-2 overflow-x-auto p-2 border-b bg-white no-scrollbar">
          <Button 
            variant={filterCat === "all" ? "default" : "outline"} 
            size="sm" 
            className={cn("h-8 rounded-full", filterCat === "all" && "bg-[#661f71] hover:bg-[#4c1554]")}
            onClick={() => setFilterCat("all")}
          >
            Todos
          </Button>
          {categories.map(c => (
            <Button 
              key={c.id} 
              variant={filterCat === c.id ? "default" : "outline"} 
              size="sm"
              className={cn("h-8 rounded-full", filterCat === c.id && "bg-[#661f71] hover:bg-[#4c1554]")}
              onClick={() => setFilterCat(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingItems ? (
            <div className="text-center text-muted-foreground mt-10">Carregando produtos...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10">Nenhum produto encontrado.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredItems.map(item => (
                <button 
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="flex flex-col items-center justify-center p-3 border rounded-xl hover:border-[#661f71] hover:shadow-md transition-all bg-white group"
                >
                  <div className="h-16 w-16 mb-2 rounded bg-gray-100 flex items-center justify-center text-2xl overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      item.emoji || "📦"
                    )}
                  </div>
                  <span className="text-xs font-semibold text-center line-clamp-2 w-full">{item.name}</span>
                  <span className="text-xs text-muted-foreground mt-1">R$ {(item.price || 0).toFixed(2).replace('.', ',')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Cart / PDV */}
      <div className="w-full md:w-[360px] lg:w-[400px] flex flex-col bg-white rounded-lg shadow-sm border overflow-hidden shrink-0">
        
        {/* PDV Header */}
        <div className="flex p-2 bg-[#661f71] text-white gap-1">
          <Button 
            variant="ghost" 
            className={cn("flex-1 h-9 rounded-sm text-xs font-bold hover:bg-white/20 hover:text-white", orderType === "pickup" && "bg-white/20")}
            onClick={() => setOrderType("pickup")}
          >
            [ D ] Delivery e Balcão
          </Button>
          <Button 
            variant="ghost" 
            className={cn("flex-1 h-9 rounded-sm text-xs font-bold hover:bg-white/20 hover:text-white", orderType === "delivery" && "bg-white/20")}
            onClick={() => setOrderType("delivery")}
          >
            [ M ] Mesas e Comandas
          </Button>
        </div>

        {/* Action bar */}
        <div className="flex border-b bg-gray-50 items-center p-1.5 gap-1">
          <Button variant="outline" size="sm" className="h-8 text-xs flex-1 text-[#661f71] border-[#661f71]/30 bg-[#661f71]/5">
            [ CTRL+X ] Rascunhos <span className="ml-1 rounded-full bg-[#661f71] text-white px-1.5 py-0.5 text-[10px]">0</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2 text-muted-foreground">
            Q Editar
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2 text-muted-foreground" onClick={() => setCartItems([])}>
            W Excluir
          </Button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50/50">
            <span className="text-xs font-bold text-slate-500">Itens do pedido</span>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
              <span>Subtotal</span>
              <Settings className="h-3.5 w-3.5 cursor-pointer hover:text-slate-800" />
            </div>
          </div>
          
          <div className="p-3 flex-1">
            {cartItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                Finalize o item ao lado, ele vai aparecer aqui
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map(item => (
                  <div key={item.cartItemId} className="flex items-start gap-2 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold truncate pr-2 text-slate-700">{item.quantity}x {item.name}</span>
                        <span className="text-sm font-semibold whitespace-nowrap">
                          R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      
                      {item.pizza_size_name && (
                        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 space-y-0.5 pb-1">
                          {item.pizza_flavors && item.pizza_flavors.length > 0 && (
                            <p>Sabores: {item.pizza_flavors.map((f: any) => f.name).join(' e ')}</p>
                          )}
                          <p>Tamanho: {item.pizza_size_name}</p>
                          {item.pizza_crust_name && <p>Borda: {item.pizza_crust_name}</p>}
                          {item.pizza_addons && item.pizza_addons.length > 0 && (
                            <p>Adicionais: {item.pizza_addons.map((a: any) => a.name).join(', ')}</p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center rounded-sm border bg-gray-50">
                          <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1 hover:bg-gray-200 text-slate-600"><Minus className="h-3 w-3" /></button>
                          <span className="text-xs font-bold px-2 w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.cartItemId, 1)} className="p-1 hover:bg-gray-200 text-slate-600"><Plus className="h-3 w-3" /></button>
                        </div>
                        <button onClick={() => removeItem(item.cartItemId)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t">
            <button className="text-xs font-medium text-[#661f71] flex items-center gap-1 hover:underline">
               ⚑ [0] Observação do pedido
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="border-t bg-gray-50 p-4">
          <div className="flex justify-between text-sm mb-1 text-slate-600">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
          </div>
          <div className="flex justify-between text-sm mb-3 text-slate-600">
            <span>Entrega</span>
            <span className="text-[#661f71] font-medium">{orderType === "pickup" ? "Grátis" : "A calcular"}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-gray-200 border-b mb-3">
            <span className="font-bold text-slate-700">Total</span>
            <span className="font-bold text-lg text-slate-800">R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>

          {/* Customer Inputs */}
          <div className="flex gap-2 mb-2">
            <Input 
              className="h-9 text-xs flex-1" 
              placeholder="(XX) X XXXX-XXXX" 
              value={customerPhone}
              onChange={e => handlePhoneChange(e.target.value)}
            />
            <Input 
              className="h-9 text-xs flex-1" 
              placeholder="Nome do cliente" 
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Button variant="outline" className="h-9 text-xs font-semibold text-[#661f71] border-[#661f71]/50 hover:bg-[#661f71]/10">
              [ E ] Entrega
            </Button>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-9 text-xs font-semibold text-[#661f71] border-[#661f71]/50 bg-white hover:bg-[#661f71]/10">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                {storePaymentMethods.map(pm => (
                  <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-9 text-xs font-semibold text-[#661f71] border-[#661f71]/50 hover:bg-[#661f71]/10">
              [ T ] CPF/CNPJ
            </Button>
            <Button variant="outline" className="h-9 text-xs font-semibold text-[#661f71] border-[#661f71]/50 hover:bg-[#661f71]/10">
              [ Y ] Ajustar valor
            </Button>
          </div>

          <div className="flex gap-2 mt-3">
            <Button 
              className="flex-1 h-12 bg-slate-400 hover:bg-slate-500 text-white font-bold text-sm"
              disabled={cartItems.length === 0 || createOrder.isPending}
              onClick={() => createOrder.mutate()}
            >
              {createOrder.isPending ? "Gerando..." : "[ ENTER ] Gerar pedido"}
            </Button>
            <Button variant="outline" className="h-12 w-12 shrink-0 bg-slate-400 hover:bg-slate-500 border-0 text-white">
              <Save className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {pizzaBuilderItem && (
        <PizzaBuilderDialog
          open={!!pizzaBuilderItem}
          onClose={() => setPizzaBuilderItem(null)}
          storeId={storeId}
          baseItem={{
            id: pizzaBuilderItem.id,
            name: pizzaBuilderItem.name,
            emoji: pizzaBuilderItem.emoji,
            image_url: pizzaBuilderItem.image_url,
            description: pizzaBuilderItem.description,
          }}
          flavorItems={items
            .filter((i: any) => i.category_id === pizzaBuilderItem.category_id)
            .map((i: any) => ({
              id: i.id,
              name: i.name,
              emoji: i.emoji,
              description: i.description,
              basePrice: Number(i.price),
            }))}
          onConfirm={(payloads) => {
            payloads.forEach(payload => {
              setCartItems(prev => [...prev, {
                cartItemId: Math.random().toString(36).substr(2, 9),
                menu_item_id: payload.baseMenuItemId,
                name: payload.flavors && payload.flavors.length > 1 ? `Pizza ${payload.sizeName || ''}`.trim() : payload.baseName,
                price: payload.unitPrice,
                quantity: 1,
                pizza_flavors: payload.flavors,
                pizza_crust_name: payload.crust?.name || null,
                pizza_addons: payload.addons,
                pizza_size_name: payload.sizeName
              }]);
            });
            setPizzaBuilderItem(null);
          }}
        />
      )}
    </div>
  );
}
