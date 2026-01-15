import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  ClipboardList, 
  Loader2, 
  RefreshCw, 
  Sparkles,
  AlertTriangle,
  Timer,
  Heart,
  Dumbbell,
  Activity,
  Trophy
} from 'lucide-react';

interface Workout {
  id?: string;
  name: string;
  name_bn: string;
  duration: number;
  type: string;
  checked: boolean;
  completed_at: string | null;
}

interface BilingualMissed {
  en: string;
  bn: string;
}

interface WorkoutPlan {
  id: string;
  workouts: Workout[];
  generated_en: string;
  generated_bn: string;
  missed_count: number;
}

export default function WorkoutChecklist() {
  const { user, session } = useAuth();
  const { language, t } = useLanguage();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [missedWorkouts, setMissedWorkouts] = useState<BilingualMissed[] | null>(null);
  const [fitnessGoal, setFitnessGoal] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPlan();
    }
  }, [user]);

  async function fetchProfile() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('fitness_goal')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setFitnessGoal(data.fitness_goal);
  }

  async function fetchPlan(forceRegenerate = false) {
    if (!session) return;
    
    if (forceRegenerate) {
      setRegenerating(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-workout-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            fitnessGoal,
            forceRegenerate 
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch workout plan');
      }

      const data = await response.json();
      setPlan(data.plan);
      setMissedWorkouts(data.missedWorkouts);
    } catch (error) {
      console.error('Error fetching plan:', error);
      toast.error(language === 'bn' ? 'ওয়ার্কআউট প্ল্যান লোড করতে ব্যর্থ' : 'Failed to load workout plan');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  async function toggleWorkout(index: number) {
    if (!plan || !user) return;

    const updatedWorkouts = [...plan.workouts];
    updatedWorkouts[index] = {
      ...updatedWorkouts[index],
      checked: !updatedWorkouts[index].checked,
      completed_at: !updatedWorkouts[index].checked ? new Date().toISOString() : null,
    };

    // Optimistic update
    setPlan({ ...plan, workouts: updatedWorkouts });

    // Save to database
    const { error } = await supabase
      .from('workout_plans')
      .update({ workouts: updatedWorkouts as unknown as import('@/integrations/supabase/types').Json })
      .eq('id', plan.id);

    if (error) {
      console.error('Error updating workout:', error);
      toast.error(language === 'bn' ? 'অগ্রগতি সংরক্ষণ করতে ব্যর্থ' : 'Failed to save progress');
      // Revert on error
      setPlan(plan);
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cardio': return Heart;
      case 'strength': return Dumbbell;
      case 'flexibility': return Activity;
      case 'sports': return Trophy;
      default: return Activity;
    }
  };

  const completedCount = plan?.workouts.filter(w => w.checked).length || 0;
  const totalCount = plan?.workouts.length || 0;
  const allComplete = completedCount === totalCount && totalCount > 0;

  // Format missed workouts for display
  const missedDisplay = missedWorkouts 
    ? missedWorkouts.map(m => language === 'bn' ? m.bn : m.en).join(', ')
    : null;

  if (loading) {
    return (
      <Card className="border-0 shadow-lg animate-pulse">
        <CardContent className="p-6">
          <div className="h-48 bg-muted rounded flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg animate-slide-up bg-gradient-to-br from-primary/5 to-sage/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            {t('exercise.workoutPlan')}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchPlan(true)}
            disabled={regenerating}
            className="h-8 w-8"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Missed Workouts Alert */}
        {missedDisplay && (
          <div className="p-3 rounded-lg bg-terracotta/10 border border-terracotta/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-terracotta" />
              <span className="text-sm font-medium text-foreground">
                {t('exercise.missedYesterday')}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {missedDisplay}
            </p>
          </div>
        )}

        {/* AI Suggestion */}
        {plan && (
          <div className="p-3 rounded-lg bg-golden/10 border border-golden/20">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-golden" />
              <span className="text-sm font-medium text-foreground">
                {t('exercise.todaysTip')}
              </span>
            </div>
            <p className="text-sm text-foreground">
              {language === 'bn' ? plan.generated_bn : plan.generated_en}
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('exercise.progress')}
          </span>
          <span className={allComplete ? 'text-primary font-medium' : 'text-foreground'}>
            {completedCount}/{totalCount} {allComplete ? '✓' : ''}
          </span>
        </div>

        {/* Workout Checklist */}
        {plan && plan.workouts.length > 0 ? (
          <div className="space-y-2">
            {plan.workouts.map((workout, index) => {
              const TypeIcon = getTypeIcon(workout.type);
              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    workout.checked 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    checked={workout.checked}
                    onCheckedChange={() => toggleWorkout(index)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <div className="p-1.5 rounded-md bg-background">
                    <TypeIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${workout.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {language === 'bn' ? workout.name_bn : workout.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Timer className="w-3 h-3" />
                    {workout.duration} {t('common.min')}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>{t('exercise.noPlan')}</p>
          </div>
        )}

        {/* All Complete Message */}
        {allComplete && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-primary font-medium">
              🎉 {t('exercise.allComplete')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
