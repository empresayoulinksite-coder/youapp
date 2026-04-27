import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/modal-boas-vindas")({
  component: AdminWelcomeModal,
});

function AdminWelcomeModal() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-welcome-modal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("welcome_modal")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    is_active: false,
    title: "",
    description: "",
    image_url: "",
    cta_label: "",
    cta_url: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        is_active: data.is_active,
        title: data.title ?? "",
        description: data.description ?? "",
        image_url: data.image_url ?? "",
        cta_label: data.cta_label ?? "",
        cta_url: data.cta_url ?? "",
      });
    }
  }, [data]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `welcome-modal/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("store-images")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("store-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: pub.publicUrl }));
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        is_active: form.is_active,
        title: form.title || "Bem-vindo!",
        description: form.description || null,
        image_url: form.image_url || null,
        cta_label: form.cta_label || null,
        cta_url: form.cta_url || null,
      };
      if (data?.id) {
        const { error } = await supabase
          .from("welcome_modal")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("welcome_modal").insert(payload);
        if (error) throw error;
      }
      toast.success("Modal salvo");
      qc.invalidateQueries({ queryKey: ["admin-welcome-modal"] });
      qc.invalidateQueries({ queryKey: ["welcome-modal"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Modal de boas-vindas</h1>
        <p className="text-sm text-muted-foreground">
          Aparece para o usuário quando ele entra no app (uma vez por sessão).
        </p>
      </div>

      <div className="rounded-lg border bg-background p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Ativar modal</Label>
            <p className="text-xs text-muted-foreground">
              Quando desativado, o popup não aparece para ninguém.
            </p>
          </div>
          <Switch
            checked={form.is_active}
            onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Bem-vindo ao YouApp!"
          />
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Mensagem que vai aparecer no popup"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Imagem (opcional)</Label>
          {form.image_url && (
            <img
              src={form.image_url}
              alt="preview"
              className="h-40 w-full rounded-md object-cover"
            />
          )}
          <div className="flex items-center gap-2">
            <Input
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="URL da imagem"
            />
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-muted px-3 py-2 text-xs hover:bg-accent">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Texto do botão (opcional)</Label>
            <Input
              value={form.cta_label}
              onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
              placeholder="Explorar agora"
            />
          </div>
          <div className="space-y-2">
            <Label>Link do botão (opcional)</Label>
            <Input
              value={form.cta_url}
              onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
              placeholder="/cupons ou https://..."
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
