-- Create workout_plans table for AI-generated daily workout checklists
CREATE TABLE public.workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_date DATE NOT NULL,
  workouts JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_en TEXT,
  generated_bn TEXT,
  missed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_date)
);

-- Enable RLS
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own workout plans"
ON public.workout_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workout plans"
ON public.workout_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout plans"
ON public.workout_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout plans"
ON public.workout_plans FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_workout_plans_updated_at
BEFORE UPDATE ON public.workout_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();