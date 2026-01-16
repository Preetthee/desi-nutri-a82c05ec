import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Sparkles, 
  Loader2, 
  Check, 
  X, 
  Dumbbell,
  Heart,
  Activity,
  Trophy,
  ChevronUp
} from 'lucide-react';
import VoiceInputButton from '@/components/shared/VoiceInputButton';

interface ParsedExercise {
  exercise_name: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  intensity: string;
  notes: string | null;
  selected: boolean;
}

interface AIExerciseInputProps {
  onExerciseAdded: () => void;
}

export default function AIExerciseInput({ onExerciseAdded }: AIExerciseInputProps) {
  const { user, session } = useAuth();
  const { t } = useLanguage();
  const [description, setDescription] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedExercises, setParsedExercises] = useState<ParsedExercise[]>([]);
  const [showParsed, setShowParsed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleVoiceTranscript = (text: string) => {
    setDescription(prev => prev ? `${prev} ${text}` : text);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cardio': return Heart;
      case 'strength': return Dumbbell;
      case 'flexibility': return Activity;
      case 'sports': return Trophy;
      default: return Dumbbell;
    }
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'low': return 'bg-sage/20 text-sage border-sage/30';
      case 'high': return 'bg-terracotta/20 text-terracotta border-terracotta/30';
      default: return 'bg-golden/20 text-golden border-golden/30';
    }
  };

  const handleParse = async () => {
    if (!description.trim() || !session) return;

    setParsing(true);
    setParsedExercises([]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-exercise`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            description: description.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 402) {
          toast.error('AI credits exhausted. Please add credits to continue.');
        } else {
          toast.error(errorData.error || 'Failed to parse exercise');
        }
        return;
      }

      const data = await response.json();
      
      if (data.exercises && data.exercises.length > 0) {
        const exercisesWithSelection = data.exercises.map((exercise: any) => ({
          ...exercise,
          selected: true,
        }));
        setParsedExercises(exercisesWithSelection);
        setShowParsed(true);
      } else {
        toast.error('Could not identify any exercises');
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to process exercise description');
    } finally {
      setParsing(false);
    }
  };

  // Function to sync logged exercises with today's workout plan
  const syncWithWorkoutPlan = async (exercises: ParsedExercise[]) => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch today's workout plan
    const { data: plan } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', today)
      .maybeSingle();

    if (!plan || !plan.workouts) return;

    const workouts = plan.workouts as Array<{
      id?: string;
      name: string;
      name_bn: string;
      duration: number;
      type: string;
      checked: boolean;
      completed_at: string | null;
      planned_duration?: number;
      completed_duration?: number;
      completion_percentage?: number;
    }>;

    let updated = false;

    // For each logged exercise, try to match with workout plan items
    for (const exercise of exercises) {
      const exerciseName = exercise.exercise_name.toLowerCase();
      const exerciseDuration = exercise.duration_minutes;

      // Find matching workout by name similarity
      for (let i = 0; i < workouts.length; i++) {
        const workout = workouts[i];
        const workoutName = workout.name.toLowerCase();
        const workoutNameBn = workout.name_bn.toLowerCase();

        // Check for fuzzy match
        const isMatch = 
          workoutName.includes(exerciseName) ||
          exerciseName.includes(workoutName) ||
          workoutName.split(' ').some(word => exerciseName.includes(word)) ||
          exerciseName.split(' ').some(word => workoutName.includes(word));

        if (isMatch && !workout.checked) {
          const plannedDuration = workout.duration || workout.planned_duration || 0;
          const previousCompleted = workout.completed_duration || 0;
          const newCompleted = previousCompleted + exerciseDuration;
          const percentage = plannedDuration > 0 ? Math.min(100, Math.round((newCompleted / plannedDuration) * 100)) : 100;

          workouts[i] = {
            ...workout,
            planned_duration: plannedDuration,
            completed_duration: newCompleted,
            completion_percentage: percentage,
            checked: newCompleted >= plannedDuration,
            completed_at: newCompleted >= plannedDuration ? new Date().toISOString() : null,
          };
          updated = true;
          break; // Move to next exercise
        }
      }
    }

    if (updated) {
      // Save updated workout plan
      await supabase
        .from('workout_plans')
        .update({ workouts: workouts as unknown as import('@/integrations/supabase/types').Json })
        .eq('id', plan.id);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const selectedExercises = parsedExercises.filter((e) => e.selected);
    if (selectedExercises.length === 0) {
      toast.error('Please select at least one exercise');
      return;
    }

    setSaving(true);

    try {
      const exercisesToInsert = selectedExercises.map((exercise) => ({
        user_id: user.id,
        exercise_name: exercise.exercise_name,
        exercise_type: exercise.exercise_type,
        duration_minutes: exercise.duration_minutes,
        calories_burned: exercise.calories_burned,
        intensity: exercise.intensity,
        notes: exercise.notes,
      }));

      const { error } = await supabase.from('exercise_logs').insert(exercisesToInsert);

      if (error) throw error;

      // Sync with workout plan
      await syncWithWorkoutPlan(selectedExercises);

      toast.success(`Logged ${selectedExercises.length} exercise${selectedExercises.length > 1 ? 's' : ''}`);
      setDescription('');
      setParsedExercises([]);
      setShowParsed(false);
      onExerciseAdded();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save exercises');
    } finally {
      setSaving(false);
    }
  };

  const toggleExerciseSelection = (index: number) => {
    setParsedExercises((prev) =>
      prev.map((exercise, i) =>
        i === index ? { ...exercise, selected: !exercise.selected } : exercise
      )
    );
  };

  const totalCalories = parsedExercises
    .filter((e) => e.selected)
    .reduce((sum, e) => sum + e.calories_burned, 0);

  const totalDuration = parsedExercises
    .filter((e) => e.selected)
    .reduce((sum, e) => sum + e.duration_minutes, 0);

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-display font-semibold text-foreground">
            AI Exercise Logger
          </span>
        </div>

        <div className="flex gap-2 items-start">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your workout... e.g., 'Morning jog for 30 mins, then 20 pushups and 15 squats'"
            className="min-h-[80px] resize-none bg-background/80 flex-1"
            disabled={parsing || saving}
          />
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            disabled={parsing || saving}
          />
        </div>

        {!showParsed && (
          <div className="flex gap-2 items-center">
            <Button
              onClick={handleParse}
              disabled={!description.trim() || parsing}
              className="flex-1 gap-2"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Log with AI
                </>
              )}
            </Button>
          </div>
        )}

        {/* Parsed Exercises Review */}
        {showParsed && parsedExercises.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Found {parsedExercises.length} exercise{parsedExercises.length > 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowParsed(false)}
                className="text-muted-foreground"
              >
                <ChevronUp className="w-4 h-4 mr-1" />
                Collapse
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {parsedExercises.map((exercise, index) => {
                const TypeIcon = getTypeIcon(exercise.exercise_type);
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      exercise.selected
                        ? 'bg-background/80 border border-primary/30'
                        : 'bg-muted/30 opacity-60'
                    }`}
                  >
                    <Checkbox
                      checked={exercise.selected}
                      onCheckedChange={() => toggleExerciseSelection(index)}
                      className="mt-1"
                    />
                    <div className="p-2 rounded-lg bg-primary/10">
                      <TypeIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {exercise.exercise_name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getIntensityColor(exercise.intensity)}`}>
                          {exercise.intensity}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{exercise.duration_minutes} min</span>
                        <span className="text-terracotta font-medium">
                          {exercise.calories_burned} kcal burned
                        </span>
                        <span className="text-primary">{exercise.exercise_type}</span>
                      </div>
                      {exercise.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {exercise.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary and actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="text-sm space-x-3">
                <span>
                  <span className="text-muted-foreground">Duration: </span>
                  <span className="font-semibold text-primary">{totalDuration} min</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Burned: </span>
                  <span className="font-semibold text-terracotta">{totalCalories} kcal</span>
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParsedExercises([]);
                    setShowParsed(false);
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !parsedExercises.some((e) => e.selected)}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1" />
                  )}
                  Log Selected
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
