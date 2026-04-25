import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Link as LinkIcon,
  Image as ImageIcon,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
  Download,
  Sparkles,
  CheckCircle2,
  ImagePlus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  importMenuFromImage,
  importMenuFromUrl,
  type ParsedCategory,
  type ParsedItem,
} from "@/server/menu-import.functions";

export const Route = createFileRoute("/admin/importar-cardapio")({
  component: ImportMenuPage,
});

type StoreType = "food" | "ecommerce" | "service";

function ImportMenuPage() {
  const qc = useQueryClient();
  const [storeType, setStoreType] = useState<StoreType>("food");
  const [storeId, setStoreId] = useState("");
  const [categories, setCategories] = useState<ParsedCategory[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: stores = [] } = useQuery({
    queryKey: ["import-stores", storeType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id,name")
        .eq("store_type", storeType)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const totalItems = useMemo(
    () => categories.reduce((acc, c) => acc + c.items.length, 0),
    [categories],
  );

  const handleParsed = (cats: ParsedCategory[]) => {
    const cleaned = cats
      .map((c) => ({
        name: c.name?.trim() || "Cardápio",
        items: (c.items || [])
          .filter((i) => i?.name?.trim())
          .map((i) => ({
            name: i.name.trim(),
            description: i.description?.trim() || null,
            price: Number(i.price) || 0,
            original_price: i.original_price ? Number(i.original_price) : null,
          })),
      }))
      .filter((c) => c.items.length > 0);
    if (cleaned.length === 0) {
      toast.error("Nenhum item encontrado no cardápio");
      return;
    }
    setCategories(cleaned);
    toast.success(`Cardápio extraído: ${cleaned.length} categorias, ${cleaned.reduce((a, c) => a + c.items.length, 0)} itens`);
  };

  const updateItem = (ci: number, ii: number, patch: Partial<ParsedItem>) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i !== ci ? c : { ...c, items: c.items.map((it, j) => (j !== ii ? it : { ...it, ...patch })) },
      ),
    );
  };
  const removeItem = (ci: number, ii: number) => {
    setCategories((prev) =>
      prev.map((c, i) => (i !== ci ? c : { ...c, items: c.items.filter((_, j) => j !== ii) })),
    );
  };
  const removeCategory = (ci: number) => setCategories((prev) => prev.filter((_, i) => i !== ci));
  const addItem = (ci: number) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i !== ci
          ? c
          : { ...c, items: [...c.items, { name: "", description: null, price: 0, original_price: null }] },
      ),
    );
  };
  const updateCategoryName = (ci: number, name: string) =>
    setCategories((prev) => prev.map((c, i) => (i !== ci ? c : { ...c, name })));
  const appendItemsToCategory = (ci: number, items: ParsedItem[]) => {
    const cleaned = items
      .filter((i) => i?.name?.trim())
      .map((i) => ({
        name: i.name.trim(),
        description: i.description?.trim() || null,
        price: Number(i.price) || 0,
        original_price: i.original_price ? Number(i.original_price) : null,
      }));
    if (cleaned.length === 0) {
      toast.error("Nenhum item novo encontrado");
      return;
    }
    setCategories((prev) =>
      prev.map((c, i) => (i !== ci ? c : { ...c, items: [...c.items, ...cleaned] })),
    );
    toast.success(`${cleaned.length} itens adicionados a "${categories[ci]?.name}"`);
  };

  const saveAll = async () => {
    if (!storeId) {
      toast.error("Selecione uma loja");
      return;
    }
    if (categories.length === 0) return;
    setSaving(true);
    try {
      const { data: existingCats } = await supabase
        .from("menu_categories")
        .select("id,name,position")
        .eq("store_id", storeId);
      const existingByName = new Map(
        (existingCats ?? []).map((c) => [c.name.toLowerCase(), c]),
      );
      let nextPos = (existingCats ?? []).reduce((m, c) => Math.max(m, c.position + 1), 0);

      let createdItems = 0;
      for (const cat of categories) {
        let categoryId: string;
        const existing = existingByName.get(cat.name.toLowerCase());
        if (existing) {
          categoryId = existing.id;
        } else {
          const { data: newCat, error: catErr } = await supabase
            .from("menu_categories")
            .insert({ store_id: storeId, name: cat.name, position: nextPos++ })
            .select("id")
            .single();
          if (catErr) throw catErr;
          categoryId = newCat.id;
        }

        const { count } = await supabase
          .from("menu_items")
          .select("id", { count: "exact", head: true })
          .eq("category_id", categoryId);
        let pos = count ?? 0;

        const rows = cat.items
          .filter((i) => i.name.trim())
          .map((i) => ({
            store_id: storeId,
            category_id: categoryId,
            name: i.name.trim(),
            description: i.description || null,
            price: i.price,
            original_price: i.original_price,
            emoji: "🍽️",
            position: pos++,
            is_available: true,
          }));
        if (rows.length === 0) continue;
        const { error: itemErr } = await supabase.from("menu_items").insert(rows);
        if (itemErr) throw itemErr;
        createdItems += rows.length;
      }

      toast.success(`${createdItems} produtos importados com sucesso!`);
      setCategories([]);
      qc.invalidateQueries({ queryKey: ["admin-cats", storeId] });
      qc.invalidateQueries({ queryKey: ["admin-items", storeId] });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/produtos"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Importar cardápio</h1>
          <p className="text-sm text-muted-foreground">
            Importe produtos via URL, foto ou planilha. Tudo passa por uma revisão antes de salvar.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Tipo de loja</Label>
            <Select value={storeType} onValueChange={(v) => { setStoreType(v as StoreType); setStoreId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="service">Serviços</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Loja de destino</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {categories.length === 0 ? (
        <Tabs defaultValue="url">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4" />URL</TabsTrigger>
            <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4" />Foto</TabsTrigger>
            <TabsTrigger value="csv"><FileSpreadsheet className="mr-2 h-4 w-4" />Planilha</TabsTrigger>
          </TabsList>
          <TabsContent value="url"><UrlImporter onParsed={handleParsed} /></TabsContent>
          <TabsContent value="image"><ImageImporter onParsed={handleParsed} /></TabsContent>
          <TabsContent value="csv"><CsvImporter onParsed={handleParsed} /></TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Pronto para revisar</p>
                <p className="text-xs text-muted-foreground">
                  {categories.length} categorias · {totalItems} produtos. Edite o que precisar antes de salvar.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCategories([])} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={saveAll} disabled={saving || !storeId}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar tudo
              </Button>
            </div>
          </div>

          {categories.map((cat, ci) => (
            <div key={ci} className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b p-3">
                <Input
                  value={cat.name}
                  onChange={(e) => updateCategoryName(ci, e.target.value)}
                  className="font-semibold"
                />
                <Button size="sm" variant="ghost" onClick={() => addItem(ci)} title="Adicionar item em branco">
                  <Plus className="h-4 w-4" />
                </Button>
                <AddMoreImageDialog onParsed={(items) => appendItemsToCategory(ci, items)} />
                <Button size="sm" variant="ghost" onClick={() => removeCategory(ci)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="divide-y">
                {cat.items.map((it, ii) => (
                  <div key={ii} className="grid grid-cols-12 gap-2 p-3">
                    <Input
                      className="col-span-12 md:col-span-4"
                      placeholder="Nome"
                      value={it.name}
                      onChange={(e) => updateItem(ci, ii, { name: e.target.value })}
                    />
                    <Textarea
                      className="col-span-12 md:col-span-4 min-h-9"
                      placeholder="Descrição (opcional)"
                      value={it.description ?? ""}
                      onChange={(e) => updateItem(ci, ii, { description: e.target.value || null })}
                      rows={1}
                    />
                    <Input
                      className="col-span-5 md:col-span-1"
                      type="number"
                      step="0.01"
                      placeholder="Preço"
                      value={it.price || ""}
                      onChange={(e) => updateItem(ci, ii, { price: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      className="col-span-5 md:col-span-2"
                      type="number"
                      step="0.01"
                      placeholder="De (opcional)"
                      value={it.original_price ?? ""}
                      onChange={(e) =>
                        updateItem(ci, ii, {
                          original_price: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="col-span-2 md:col-span-1"
                      onClick={() => removeItem(ci, ii)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UrlImporter({ onParsed }: { onParsed: (c: ParsedCategory[]) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(importMenuFromUrl);
  const submit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fn({ data: { url: url.trim() } });
      onParsed(res.categories);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <Label>URL do cardápio</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Linktree, Goomer, Anota.ai, site próprio da loja, etc. Evite iFood/Rappi (bloqueiam acesso).
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="https://exemplo.com/cardapio"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button onClick={submit} disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Importar com IA
        </Button>
      </div>
    </div>
  );
}

function ImageImporter({ onParsed }: { onParsed: (c: ParsedCategory[]) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fn = useServerFn(importMenuFromImage);

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 6MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Paste from clipboard (Ctrl+V / Cmd+V) anywhere on the page while this importer is mounted
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (preview || loading) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onFile(file);
            toast.success("Imagem colada");
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [preview, loading]);

  const submit = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await fn({ data: { imageDataUrl: preview } });
      onParsed(res.categories);
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <Label>Foto do cardápio</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Tire, envie, cole (Ctrl+V) ou arraste uma foto/print nítido do cardápio. A IA vai ler os itens e preços.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {preview ? (
        <div className="space-y-3">
          <img src={preview} alt="Preview" className="max-h-80 rounded-md border" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview(null)} disabled={loading}>
              Trocar foto
            </Button>
            <Button onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Extrair com IA
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
          }`}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Escolher foto, colar (Ctrl+V) ou arrastar</p>
          <p className="text-xs text-muted-foreground">PNG, JPG até 6MB</p>
        </div>
      )}
    </div>
  );
}

function CsvImporter({ onParsed }: { onParsed: (c: ParsedCategory[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csv = "categoria,nome,descricao,preco,preco_original\nLanches,X-Burger,Pão brioche e queijo,25.90,\nLanches,X-Salada,Com alface e tomate,28.90,32.00\nBebidas,Coca-Cola 350ml,,7.50,\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-cardapio.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const grouped = new Map<string, ParsedItem[]>();
        for (const row of results.data) {
          const cat = (row.categoria || row.category || "Cardápio").trim();
          const name = (row.nome || row.name || "").trim();
          if (!name) continue;
          const item: ParsedItem = {
            name,
            description: (row.descricao || row.description || "").trim() || null,
            price: parseFloat((row.preco || row.price || "0").replace(",", ".")) || 0,
            original_price: row.preco_original
              ? parseFloat(row.preco_original.replace(",", ".")) || null
              : null,
          };
          if (!grouped.has(cat)) grouped.set(cat, []);
          grouped.get(cat)!.push(item);
        }
        const cats: ParsedCategory[] = Array.from(grouped.entries()).map(([name, items]) => ({
          name,
          items,
        }));
        if (cats.length === 0) {
          toast.error("Planilha sem itens válidos");
          return;
        }
        onParsed(cats);
      },
      error: (err) => toast.error(`Erro ao ler CSV: ${err.message}`),
    });
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <Label>Planilha CSV</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Colunas: <code className="rounded bg-muted px-1">categoria, nome, descricao, preco, preco_original</code>.
          Baixe o modelo abaixo.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div className="flex gap-2">
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" /> Baixar modelo
        </Button>
        <Button onClick={() => inputRef.current?.click()}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Enviar CSV
        </Button>
      </div>
    </div>
  );
}
