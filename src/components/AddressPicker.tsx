import { useEffect, useState } from "react";
import {
  MapPin,
  Home,
  Briefcase,
  Star,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Navigation,
  X,
  Check,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useAddress, type SavedAddress } from "@/contexts/AddressContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LocationAdjuster, type AdjustedLocation } from "@/components/LocationAdjuster";

const ICONS = [
  { id: "home", label: "Casa", Icon: Home },
  { id: "work", label: "Trabalho", Icon: Briefcase },
  { id: "other", label: "Outro", Icon: Star },
] as const;

function IconFor({ icon, className }: { icon: string; className?: string }) {
  const found = ICONS.find((i) => i.id === icon);
  const Cmp = found?.Icon ?? MapPin;
  return <Cmp className={className} />;
}

export function AddressPicker({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const {
    addresses,
    active,
    gpsLocation,
    gpsStatus,
    detectGps,
    selectSaved,
  } = useAddress();
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [creating, setCreating] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjusted, setAdjusted] = useState<AdjustedLocation | null>(null);

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setAdjusted(null);
  };

  const startAdjust = () => {
    if (!gpsLocation && gpsStatus !== "loading") detectGps();
    setAdjusting(true);
  };

  // Quando o sheet fecha, resetamos estados internos
  useEffect(() => {
    if (!open) {
      setAdjusting(false);
      setAdjusted(null);
      setEditing(null);
      setCreating(false);
    }
  }, [open]);

  const showList = !editing && !creating && !adjusting;
  const showAdjuster = adjusting && !creating;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl p-0 max-h-[90vh] overflow-y-auto"
      >
        {showList && (
          <>
            <SheetHeader className="px-5 pt-5 pb-3 text-left">
              <SheetTitle>Onde entregar?</SheetTitle>
            </SheetHeader>

            <div className="px-5 pb-2">
              <button
                onClick={startAdjust}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border hover:bg-accent transition-colors"
              >
                <span className="h-10 w-10 rounded-full bg-brand-soft flex items-center justify-center text-brand">
                  {gpsStatus === "loading" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Navigation className="h-5 w-5" />
                  )}
                </span>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-sm">Usar minha localização</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {gpsLocation?.label ??
                      (gpsStatus === "denied"
                        ? "Permissão negada — toque para tentar"
                        : "Ajustar no mapa e completar endereço")}
                  </p>
                </div>
                {active?.source === "gps" && <Check className="h-5 w-5 text-brand" />}
              </button>
            </div>

            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Meus endereços
              </p>
              <button
                onClick={() => setCreating(true)}
                className="text-xs font-bold text-brand flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Novo
              </button>
            </div>

            <div className="px-5 pb-5 space-y-2">
              {addresses.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Você ainda não salvou nenhum endereço.
                </p>
              )}
              {addresses.map((a) => {
                const isActive = active?.source === "saved" && active.id === a.id;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                      isActive ? "border-brand bg-brand-soft/40" : "border-border"
                    }`}
                  >
                    <button
                      onClick={() => {
                        selectSaved(a.id);
                        onOpenChange(false);
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <span className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-foreground">
                        <IconFor icon={a.icon} className="h-5 w-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          {a.label}
                          {a.is_default && (
                            <span className="text-[10px] font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded">
                              PADRÃO
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[a.street, a.number].filter(Boolean).join(", ")}
                          {a.neighborhood ? ` — ${a.neighborhood}` : ""}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => setEditing(a)}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {showAdjuster && (
          <AdjusterGate
            initialLat={gpsLocation?.lat}
            initialLng={gpsLocation?.lng}
            gpsStatus={gpsStatus}
            onCancel={() => setAdjusting(false)}
            onConfirm={(loc) => {
              setAdjusted(loc);
              setAdjusting(false);
              setCreating(true);
            }}
          />
        )}

        {(editing || creating) && !adjusting && (
          <AddressForm
            initial={editing ?? undefined}
            prefill={adjusted ?? undefined}
            onClose={closeForm}
            onSaved={() => {
              closeForm();
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function AdjusterGate({
  initialLat,
  initialLng,
  gpsStatus,
  onCancel,
  onConfirm,
}: {
  initialLat?: number;
  initialLng?: number;
  gpsStatus: string;
  onCancel: () => void;
  onConfirm: (loc: AdjustedLocation) => void;
}) {
  if (initialLat == null || initialLng == null) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        {gpsStatus === "loading" ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="text-sm text-muted-foreground">Detectando sua localização...</p>
          </>
        ) : (
          <>
            <MapPin className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-semibold">
              {gpsStatus === "denied"
                ? "Permissão de localização negada"
                : "Não conseguimos detectar sua localização"}
            </p>
            <p className="text-xs text-muted-foreground">
              Você pode adicionar o endereço manualmente.
            </p>
            <button
              onClick={onCancel}
              className="mt-2 px-5 py-2 rounded-full bg-brand text-brand-foreground font-semibold text-sm"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    );
  }
  return (
    <LocationAdjuster
      initialLat={initialLat}
      initialLng={initialLng}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function AddressForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: SavedAddress;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { refresh, removeAddress, gpsLocation, selectSaved } = useAddress();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: initial?.label ?? "Casa",
    icon: initial?.icon ?? "home",
    cep: initial?.cep ?? "",
    street: initial?.street ?? gpsLocation?.street ?? "",
    number: initial?.number ?? "",
    complement: initial?.complement ?? "",
    neighborhood: initial?.neighborhood ?? gpsLocation?.neighborhood ?? "",
    city: initial?.city ?? gpsLocation?.city ?? "",
    state: initial?.state ?? gpsLocation?.state ?? "",
    reference: initial?.reference ?? "",
    is_default: initial?.is_default ?? false,
  });

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Busca CEP
  useEffect(() => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    const ctrl = new AbortController();
    fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.erro) return;
        setForm((f) => ({
          ...f,
          street: f.street || d.logradouro || "",
          neighborhood: f.neighborhood || d.bairro || "",
          city: f.city || d.localidade || "",
          state: f.state || d.uf || "",
        }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [form.cep]);

  const handleSave = async () => {
    if (!user || !form.street.trim()) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      label: form.label.trim() || "Endereço",
      icon: form.icon,
      cep: form.cep || null,
      street: form.street.trim(),
      number: form.number || null,
      complement: form.complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      reference: form.reference || null,
      is_default: form.is_default,
      lat: !initial ? gpsLocation?.lat ?? null : initial.lat,
      lng: !initial ? gpsLocation?.lng ?? null : initial.lng,
    };

    let savedId = initial?.id;
    if (initial) {
      await supabase.from("user_addresses").update(payload).eq("id", initial.id);
    } else {
      const { data } = await supabase
        .from("user_addresses")
        .insert(payload)
        .select("id")
        .single();
      savedId = data?.id;
    }
    await refresh();
    if (savedId) selectSaved(savedId);
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (!confirm("Remover este endereço?")) return;
    await removeAddress(initial.id);
    onClose();
  };

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-border sticky top-0 bg-background z-10">
        <button onClick={onClose} className="p-1 -ml-1" aria-label="Voltar">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-semibold flex-1">
          {initial ? "Editar endereço" : "Novo endereço"}
        </h2>
      </header>

      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Salvar como</label>
          <div className="flex gap-2 mt-2">
            {ICONS.map(({ id, label, Icon }) => {
              const active = form.icon === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    update("icon", id);
                    if (!initial) update("label", label);
                  }}
                  className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl border transition-colors ${
                    active ? "border-brand bg-brand-soft text-brand" : "border-border"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Apelido</label>
          <Input
            value={form.label}
            onChange={(e) => update("label", e.target.value)}
            placeholder="Ex.: Casa da mãe"
            className="mt-1"
            maxLength={40}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">CEP</label>
            <Input
              value={form.cep}
              onChange={(e) => update("cep", e.target.value)}
              placeholder="00000-000"
              className="mt-1"
              maxLength={9}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Estado</label>
            <Input
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              placeholder="UF"
              className="mt-1"
              maxLength={2}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Rua *</label>
          <Input
            value={form.street}
            onChange={(e) => update("street", e.target.value)}
            placeholder="Nome da rua"
            className="mt-1"
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Número</label>
            <Input
              value={form.number}
              onChange={(e) => update("number", e.target.value)}
              placeholder="123"
              className="mt-1"
              maxLength={10}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Complemento</label>
            <Input
              value={form.complement}
              onChange={(e) => update("complement", e.target.value)}
              placeholder="Apto, bloco..."
              className="mt-1"
              maxLength={60}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Bairro</label>
          <Input
            value={form.neighborhood}
            onChange={(e) => update("neighborhood", e.target.value)}
            className="mt-1"
            maxLength={60}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Cidade</label>
          <Input
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            className="mt-1"
            maxLength={60}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Ponto de referência
          </label>
          <Input
            value={form.reference}
            onChange={(e) => update("reference", e.target.value)}
            placeholder="Ex.: Em frente à praça"
            className="mt-1"
            maxLength={120}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => update("is_default", e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--brand))]"
          />
          Definir como endereço padrão
        </label>

        <div className="flex gap-2 pt-2">
          {initial && (
            <button
              onClick={handleDelete}
              className="px-4 py-3 rounded-full border border-destructive text-destructive font-semibold text-sm flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </button>
          )}
          <button
            disabled={saving || !form.street.trim()}
            onClick={handleSave}
            className="flex-1 bg-brand text-brand-foreground font-bold py-3 rounded-full disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar endereço"}
          </button>
        </div>
      </div>
    </div>
  );
}
