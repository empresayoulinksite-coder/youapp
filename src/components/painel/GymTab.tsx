import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Save, X, Dumbbell, Users, Calendar, ListChecks, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { type GymPlan, type GymClass, type GymMember, type GymWorkout, type GymWorkoutExercise, WEEKDAY_LABELS, formatTime } from "@/lib/gym";

export function GymTab({ storeId }: { storeId: string }) {
  return (
    <Tabs defaultValue="plans" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="plans" className="gap-1.5"><Dumbbell className="h-4 w-4" /><span className="hidden sm:inline">Planos</span></TabsTrigger>
        <TabsTrigger value="classes" className="gap-1.5"><Calendar className="h-4 w-4" /><span className="hidden sm:inline">Aulas</span></TabsTrigger>
        <TabsTrigger value="members" className="gap-1.5"><Users className="h-4 w-4" /><span className="hidden sm:inline">Alunos</span></TabsTrigger>
        <TabsTrigger value="workouts" className="gap-1.5"><ListChecks className="h-4 w-4" /><span className="hidden sm:inline">Treinos</span></TabsTrigger>
      </TabsList>
      <TabsContent value="plans" className="mt-4"><PlansSection storeId={storeId} /></TabsContent>
      <TabsContent value="classes" className="mt-4"><ClassesSection storeId={storeId} /></TabsContent>
      <TabsContent value="members" className="mt-4"><MembersSection storeId={storeId} /></TabsContent>
      <TabsContent value="workouts" className="mt-4"><WorkoutsSection storeId={storeId} /></TabsContent>
    </Tabs>
  );
}

/* ============== PLANOS ============== */
function PlansSection({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<GymPlan[]>([]);
  const [editing, setEditing] = useState<GymPlan | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("gym_plans").select("*").eq("store_id", storeId).order("position");
    setItems((data ?? []) as GymPlan[]);
  };
  useEffect(() => { load(); }, [storeId]);

  const blank = (): GymPlan => ({
    id: "", store_id: storeId, name: "", description: "", price: 0, billing_period: "mensal",
    highlight: "", features: [], position: items.length, is_active: true,
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Nome obrigatório");
    const payload = {
      store_id: storeId,
      name: editing.name,
      description: editing.description || null,
      price: editing.price,
      billing_period: editing.billing_period,
      highlight: editing.highlight || null,
      features: editing.features,
      position: editing.position,
      is_active: editing.is_active,
    };
    const res = editing.id
      ? await supabase.from("gym_plans").update(payload).eq("id", editing.id)
      : await supabase.from("gym_plans").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("gym_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Planos da academia</h3>
        <Button size="sm" onClick={() => { setEditing(blank()); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo plano
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum plano cadastrado.</p>
      ) : items.map((p) => (
        <div key={p.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{p.name} {!p.is_active && <span className="text-xs text-muted-foreground">(inativo)</span>}</p>
            <p className="text-xs text-muted-foreground">R$ {p.price.toFixed(2)} / {p.billing_period}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Plano Mensal" /></div>
              <div><Label>Descrição</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Período</Label>
                  <Select value={editing.billing_period} onValueChange={(v) => setEditing({ ...editing, billing_period: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                      <SelectItem value="avulso">Avulso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Destaque (opcional)</Label><Input value={editing.highlight ?? ""} onChange={(e) => setEditing({ ...editing, highlight: e.target.value })} placeholder='Ex: "Mais popular"' /></div>
              <div>
                <Label>Benefícios (um por linha)</Label>
                <Textarea
                  value={editing.features.join("\n")}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  rows={4}
                  placeholder="Acesso ilimitado&#10;Aulas coletivas&#10;Avaliação física"
                />
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativo</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== AULAS ============== */
function ClassesSection({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<GymClass[]>([]);
  const [editing, setEditing] = useState<GymClass | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("gym_classes").select("*").eq("store_id", storeId).order("weekday").order("starts_at");
    setItems((data ?? []) as GymClass[]);
  };
  useEffect(() => { load(); }, [storeId]);

  const blank = (): GymClass => ({
    id: "", store_id: storeId, name: "", instructor: "", weekday: 1, starts_at: "08:00", ends_at: "09:00",
    capacity: null, description: "", is_active: true, position: 0,
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Nome obrigatório");
    const payload = {
      store_id: storeId,
      name: editing.name,
      instructor: editing.instructor || null,
      weekday: editing.weekday,
      starts_at: editing.starts_at,
      ends_at: editing.ends_at,
      capacity: editing.capacity,
      description: editing.description || null,
      is_active: editing.is_active,
      position: editing.position,
    };
    const res = editing.id
      ? await supabase.from("gym_classes").update(payload).eq("id", editing.id)
      : await supabase.from("gym_classes").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    const { error } = await supabase.from("gym_classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Grade de aulas</h3>
        <Button size="sm" onClick={() => { setEditing(blank()); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova aula
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma aula cadastrada.</p>
      ) : items.map((c) => (
        <div key={c.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <span className="font-mono text-xs bg-brand-soft text-brand rounded-md px-2 py-1 shrink-0">{WEEKDAY_LABELS[c.weekday]} {formatTime(c.starts_at)}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{c.name}</p>
            {c.instructor && <p className="text-xs text-muted-foreground truncate">{c.instructor}</p>}
          </div>
          <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar aula" : "Nova aula"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Pilates" /></div>
              <div><Label>Instrutor(a)</Label><Input value={editing.instructor ?? ""} onChange={(e) => setEditing({ ...editing, instructor: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Dia</Label>
                  <Select value={String(editing.weekday)} onValueChange={(v) => setEditing({ ...editing, weekday: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_LABELS.map((l, i) => <SelectItem key={i} value={String(i)}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Início</Label><Input type="time" value={editing.starts_at.slice(0,5)} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="time" value={editing.ends_at.slice(0,5)} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} /></div>
              </div>
              <div><Label>Capacidade (vagas)</Label><Input type="number" value={editing.capacity ?? ""} onChange={(e) => setEditing({ ...editing, capacity: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label>Descrição</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativa</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== ALUNOS ============== */
function MembersSection({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<GymMember[]>([]);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [editing, setEditing] = useState<GymMember | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [m, p] = await Promise.all([
      supabase.from("gym_members").select("*").eq("store_id", storeId).order("full_name"),
      supabase.from("gym_plans").select("*").eq("store_id", storeId).eq("is_active", true).order("position"),
    ]);
    setItems((m.data ?? []) as GymMember[]);
    setPlans((p.data ?? []) as GymPlan[]);
  };
  useEffect(() => { load(); }, [storeId]);

  const blank = (): GymMember => ({
    id: "", store_id: storeId, user_id: null, full_name: "", email: "", phone: "",
    plan_id: null, notes: "", is_active: true, joined_at: new Date().toISOString().slice(0,10),
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.full_name.trim()) return toast.error("Nome obrigatório");

    // Tenta vincular pelo email se houver perfil
    let user_id = editing.user_id;
    if (!user_id && editing.email) {
      const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", editing.email).maybeSingle();
      if (profile?.user_id) user_id = profile.user_id;
    }

    const payload = {
      store_id: storeId,
      user_id,
      full_name: editing.full_name,
      email: editing.email || null,
      phone: editing.phone || null,
      plan_id: editing.plan_id,
      notes: editing.notes || null,
      is_active: editing.is_active,
      joined_at: editing.joined_at,
    };
    const res = editing.id
      ? await supabase.from("gym_members").update(payload).eq("id", editing.id)
      : await supabase.from("gym_members").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo");
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este aluno?")) return;
    const { error } = await supabase.from("gym_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Alunos</h3>
        <Button size="sm" onClick={() => { setEditing(blank()); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo aluno
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno cadastrado.</p>
      ) : items.map((m) => (
        <div key={m.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{m.full_name} {!m.is_active && <span className="text-xs text-muted-foreground">(inativo)</span>}</p>
            <p className="text-xs text-muted-foreground truncate">
              {m.email || m.phone || "—"}
              {m.user_id && " · vinculado ao app"}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar aluno" : "Novo aluno"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="email do app" /></div>
                <div><Label>Telefone</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Ao informar o email cadastrado no app, o aluno verá automaticamente sua ficha em "Meu treino".</p>
              <div><Label>Plano</Label>
                <Select value={editing.plan_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, plan_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem plano" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem plano</SelectItem>
                    {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início</Label><Input type="date" value={editing.joined_at} onChange={(e) => setEditing({ ...editing, joined_at: e.target.value })} /></div>
                <div className="flex items-center gap-2 self-end pb-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativo</Label></div>
              </div>
              <div><Label>Observações</Label><Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== TREINOS ============== */
function WorkoutsSection({ storeId }: { storeId: string }) {
  const [members, setMembers] = useState<GymMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<GymWorkout[]>([]);
  const [openMember, setOpenMember] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("gym_members").select("*").eq("store_id", storeId).eq("is_active", true).order("full_name");
      setMembers((data ?? []) as GymMember[]);
    })();
  }, [storeId]);

  const loadWorkouts = async (memberId: string) => {
    const { data } = await supabase.from("gym_workouts").select("*").eq("member_id", memberId).order("position");
    setWorkouts((data ?? []) as GymWorkout[]);
  };

  const openForMember = (id: string) => {
    setSelectedMemberId(id);
    setOpenMember(id);
    loadWorkouts(id);
  };

  if (selectedMemberId && openMember) {
    const member = members.find((m) => m.id === selectedMemberId);
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedMemberId(null); setOpenMember(null); }}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h3 className="font-semibold">Fichas de {member?.full_name}</h3>
        <MemberWorkouts
          storeId={storeId}
          memberId={selectedMemberId}
          workouts={workouts}
          onChange={() => loadWorkouts(selectedMemberId)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Selecione um aluno para gerenciar fichas</h3>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Cadastre alunos primeiro.</p>
      ) : members.map((m) => (
        <button
          key={m.id}
          onClick={() => openForMember(m.id)}
          className="w-full rounded-xl border bg-card p-3 flex items-center gap-3 hover:bg-accent/40 transition-colors text-left"
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{m.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{m.email || m.phone || "—"}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function MemberWorkouts({ storeId, memberId, workouts, onChange }: {
  storeId: string; memberId: string; workouts: GymWorkout[]; onChange: () => void;
}) {
  const [editingWorkout, setEditingWorkout] = useState<GymWorkout | null>(null);

  const newWorkout = async () => {
    const title = prompt("Nome da ficha (ex: Treino A - Peito)");
    if (!title?.trim()) return;
    const { error } = await supabase.from("gym_workouts").insert({
      store_id: storeId, member_id: memberId, title, position: workouts.length, is_active: true,
    });
    if (error) return toast.error(error.message);
    onChange();
  };

  const removeWorkout = async (id: string) => {
    if (!confirm("Excluir esta ficha?")) return;
    const { error } = await supabase.from("gym_workouts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  if (editingWorkout) {
    return (
      <ExercisesEditor
        workout={editingWorkout}
        onBack={() => { setEditingWorkout(null); onChange(); }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={newWorkout}><Plus className="h-4 w-4 mr-1" /> Nova ficha</Button>
      {workouts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ficha cadastrada.</p>
      ) : workouts.map((w) => (
        <div key={w.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{w.title}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditingWorkout(w)}>Exercícios</Button>
          <Button size="icon" variant="ghost" onClick={() => removeWorkout(w.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
    </div>
  );
}

function ExercisesEditor({ workout, onBack }: { workout: GymWorkout; onBack: () => void }) {
  const [items, setItems] = useState<GymWorkoutExercise[]>([]);
  const [editing, setEditing] = useState<GymWorkoutExercise | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("gym_workout_exercises").select("*").eq("workout_id", workout.id).order("position");
    setItems((data ?? []) as GymWorkoutExercise[]);
  };
  useEffect(() => { load(); }, [workout.id]);

  const blank = (): GymWorkoutExercise => ({
    id: "", workout_id: workout.id, name: "", sets: 3, reps: "10-12", rest_seconds: 60, notes: "", position: items.length,
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Nome obrigatório");
    const payload = {
      workout_id: workout.id, name: editing.name, sets: editing.sets, reps: editing.reps,
      rest_seconds: editing.rest_seconds, notes: editing.notes || null, position: editing.position,
    };
    const res = editing.id
      ? await supabase.from("gym_workout_exercises").update(payload).eq("id", editing.id)
      : await supabase.from("gym_workout_exercises").insert(payload);
    if (res.error) return toast.error(res.error.message);
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir exercício?")) return;
    const { error } = await supabase.from("gym_workout_exercises").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <Button size="sm" onClick={() => { setEditing(blank()); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Exercício</Button>
      </div>
      <p className="font-semibold">{workout.title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum exercício.</p>
      ) : items.map((ex) => (
        <div key={ex.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{ex.name}</p>
            <p className="text-xs text-muted-foreground">{ex.sets} × {ex.reps}{ex.rest_seconds ? ` · ${ex.rest_seconds}s desc.` : ""}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => { setEditing(ex); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => remove(ex.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} exercício</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Supino reto" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Séries</Label><Input type="number" value={editing.sets} onChange={(e) => setEditing({ ...editing, sets: Number(e.target.value) })} /></div>
                <div><Label>Repetições</Label><Input value={editing.reps} onChange={(e) => setEditing({ ...editing, reps: e.target.value })} placeholder="10-12" /></div>
                <div><Label>Descanso (s)</Label><Input type="number" value={editing.rest_seconds ?? ""} onChange={(e) => setEditing({ ...editing, rest_seconds: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div><Label>Observação</Label><Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
