import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Dumbbell, ChevronRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { type GymMember, type GymWorkout, type GymWorkoutExercise } from "@/lib/gym";

export const Route = createFileRoute("/meu-treino")({
  head: () => ({
    meta: [
      { title: "Meu treino" },
      { name: "description", content: "Acesse sua ficha de treino da academia." },
    ],
  }),
  component: MyWorkoutPage,
});

type MemberWithStore = GymMember & { store: { id: string; name: string; slug: string } | null };

function MyWorkoutPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<MemberWithStore[]>([]);
  const [workouts, setWorkouts] = useState<Record<string, GymWorkout[]>>({});
  const [openWorkout, setOpenWorkout] = useState<GymWorkout | null>(null);
  const [exercises, setExercises] = useState<GymWorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: members } = await supabase
        .from("gym_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);
      const baseList = (members ?? []) as GymMember[];

      // Busca dados das lojas
      const storeIds = Array.from(new Set(baseList.map((m) => m.store_id)));
      let storeMap: Record<string, { id: string; name: string; slug: string }> = {};
      if (storeIds.length) {
        const { data: stores } = await supabase
          .from("stores")
          .select("id, name, slug")
          .in("id", storeIds);
        storeMap = Object.fromEntries((stores ?? []).map((s) => [s.id, s]));
      }
      const list: MemberWithStore[] = baseList.map((m) => ({ ...m, store: storeMap[m.store_id] ?? null }));
      setMemberships(list);

      // Carrega fichas para cada vínculo
      const wMap: Record<string, GymWorkout[]> = {};
      for (const m of list) {
        const { data: ws } = await supabase
          .from("gym_workouts")
          .select("*")
          .eq("member_id", m.id)
          .eq("is_active", true)
          .order("position");
        wMap[m.id] = (ws ?? []) as GymWorkout[];
      }
      setWorkouts(wMap);
      setLoading(false);
    })();
  }, [user]);

  const openWorkoutDetail = async (w: GymWorkout) => {
    const { data } = await supabase
      .from("gym_workout_exercises")
      .select("*")
      .eq("workout_id", w.id)
      .order("position");
    setExercises((data ?? []) as GymWorkoutExercise[]);
    setOpenWorkout(w);
  };

  if (authLoading || loading) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>;
  }

  if (openWorkout) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-2">
          <button onClick={() => setOpenWorkout(null)} className="p-1 -ml-1 rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold truncate">{openWorkout.title}</h1>
        </header>
        <main className="p-4 space-y-3 max-w-md mx-auto">
          {openWorkout.description && (
            <p className="text-sm text-muted-foreground">{openWorkout.description}</p>
          )}
          {exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum exercício nesta ficha ainda.</p>
          ) : (
            exercises.map((ex, i) => (
              <div key={ex.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-brand">#{i + 1}</span>
                  <h3 className="font-semibold flex-1">{ex.name}</h3>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="bg-brand-soft text-brand rounded-full px-2 py-1 font-semibold">
                    {ex.sets} séries
                  </span>
                  <span className="bg-muted rounded-full px-2 py-1 font-semibold">
                    {ex.reps} reps
                  </span>
                  {ex.rest_seconds != null && (
                    <span className="bg-muted rounded-full px-2 py-1">
                      {ex.rest_seconds}s descanso
                    </span>
                  )}
                </div>
                {ex.notes && (
                  <p className="text-xs text-muted-foreground mt-2">{ex.notes}</p>
                )}
              </div>
            ))
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-2">
        <Link to="/" className="p-1 -ml-1 rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-bold flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-brand" /> Meu treino
        </h1>
      </header>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        {memberships.length === 0 ? (
          <div className="text-center py-16">
            <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold">Você ainda não é aluno de nenhuma academia</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quando uma academia te cadastrar com seu email, suas fichas aparecerão aqui.
            </p>
          </div>
        ) : (
          memberships.map((m) => (
            <section key={m.id}>
              <h2 className="font-bold mb-2">{m.stores?.name ?? "Academia"}</h2>
              {(workouts[m.id] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border bg-card p-4 text-center">
                  Nenhuma ficha cadastrada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {(workouts[m.id] ?? []).map((w) => (
                    <button
                      key={w.id}
                      onClick={() => openWorkoutDetail(w)}
                      className="w-full rounded-2xl border bg-card p-4 flex items-center gap-3 hover:bg-accent/40 transition-colors text-left"
                    >
                      <Dumbbell className="h-5 w-5 text-brand shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{w.title}</p>
                        {w.description && (
                          <p className="text-xs text-muted-foreground truncate">{w.description}</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
