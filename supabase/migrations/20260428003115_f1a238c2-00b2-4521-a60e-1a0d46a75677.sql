
-- =========================================
-- ACADEMIA: planos, aulas, alunos e treinos
-- =========================================

-- 1) Planos da academia (mensalidades / pacotes)
CREATE TABLE public.gym_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'mensal', -- mensal, trimestral, semestral, anual, avulso
  highlight TEXT, -- ex: "Mais popular"
  features TEXT[] NOT NULL DEFAULT '{}'::text[],
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active gym plans viewable by everyone"
  ON public.gym_plans FOR SELECT
  USING (is_active = true OR is_store_owner(auth.uid(), store_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Store owners manage their gym_plans"
  ON public.gym_plans FOR ALL
  USING (is_store_owner(auth.uid(), store_id))
  WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE POLICY "Admins manage gym_plans"
  ON public.gym_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_gym_plans_updated
  BEFORE UPDATE ON public.gym_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gym_plans_store ON public.gym_plans(store_id);


-- 2) Grade de aulas coletivas
CREATE TABLE public.gym_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  instructor TEXT,
  weekday SMALLINT NOT NULL, -- 0=domingo .. 6=sábado
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  capacity INTEGER,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active gym classes viewable by everyone"
  ON public.gym_classes FOR SELECT
  USING (is_active = true OR is_store_owner(auth.uid(), store_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Store owners manage their gym_classes"
  ON public.gym_classes FOR ALL
  USING (is_store_owner(auth.uid(), store_id))
  WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE POLICY "Admins manage gym_classes"
  ON public.gym_classes FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_gym_classes_updated
  BEFORE UPDATE ON public.gym_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gym_classes_store ON public.gym_classes(store_id);


-- 3) Alunos vinculados à academia
CREATE TABLE public.gym_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  user_id UUID, -- preenchido se o aluno tiver conta no app
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  plan_id UUID, -- referencia gym_plans (sem FK estrita por padrão do projeto)
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

ALTER TABLE public.gym_members ENABLE ROW LEVEL SECURITY;

-- Aluno vê o próprio vínculo
CREATE POLICY "Members view their own membership"
  ON public.gym_members FOR SELECT
  USING (auth.uid() = user_id);

-- Donos da academia gerenciam seus alunos
CREATE POLICY "Store owners manage their gym_members"
  ON public.gym_members FOR ALL
  USING (is_store_owner(auth.uid(), store_id))
  WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE POLICY "Admins manage gym_members"
  ON public.gym_members FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_gym_members_updated
  BEFORE UPDATE ON public.gym_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gym_members_store ON public.gym_members(store_id);
CREATE INDEX idx_gym_members_user ON public.gym_members(user_id);


-- 4) Fichas de treino criadas pelo professor
CREATE TABLE public.gym_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  member_id UUID NOT NULL, -- referencia gym_members.id
  title TEXT NOT NULL,             -- ex: "Treino A - Peito e Tríceps"
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_workouts ENABLE ROW LEVEL SECURITY;

-- O aluno vinculado vê suas fichas
CREATE POLICY "Members view their own workouts"
  ON public.gym_workouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gym_members m
      WHERE m.id = gym_workouts.member_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners manage their gym_workouts"
  ON public.gym_workouts FOR ALL
  USING (is_store_owner(auth.uid(), store_id))
  WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE POLICY "Admins manage gym_workouts"
  ON public.gym_workouts FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_gym_workouts_updated
  BEFORE UPDATE ON public.gym_workouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gym_workouts_member ON public.gym_workouts(member_id);
CREATE INDEX idx_gym_workouts_store ON public.gym_workouts(store_id);


-- 5) Exercícios de cada ficha
CREATE TABLE public.gym_workout_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL, -- referencia gym_workouts.id
  name TEXT NOT NULL,            -- ex: "Supino reto"
  sets INTEGER NOT NULL DEFAULT 3,
  reps TEXT NOT NULL DEFAULT '10', -- string para aceitar "10-12", "Até falha", etc
  rest_seconds INTEGER,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_workout_exercises ENABLE ROW LEVEL SECURITY;

-- Aluno vê exercícios de uma ficha que pertence a ele
CREATE POLICY "Members view their own workout exercises"
  ON public.gym_workout_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.gym_workouts w
      JOIN public.gym_members m ON m.id = w.member_id
      WHERE w.id = gym_workout_exercises.workout_id
        AND m.user_id = auth.uid()
    )
  );

-- Donos da academia gerenciam exercícios das fichas das suas lojas
CREATE POLICY "Store owners manage their workout_exercises"
  ON public.gym_workout_exercises FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.gym_workouts w
      WHERE w.id = gym_workout_exercises.workout_id
        AND is_store_owner(auth.uid(), w.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gym_workouts w
      WHERE w.id = gym_workout_exercises.workout_id
        AND is_store_owner(auth.uid(), w.store_id)
    )
  );

CREATE POLICY "Admins manage workout_exercises"
  ON public.gym_workout_exercises FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_gym_workout_exercises_updated
  BEFORE UPDATE ON public.gym_workout_exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_workout_exercises_workout ON public.gym_workout_exercises(workout_id);


-- 6) Adiciona categoria "academia" na home
INSERT INTO public.home_categories (slug, label, icon, tint, matches, position, is_active, is_ecommerce)
VALUES (
  'academia',
  'Academia',
  'Sparkles',
  'bg-indigo-50 text-indigo-600',
  ARRAY['Academia']::text[],
  100,
  true,
  false
)
ON CONFLICT DO NOTHING;
