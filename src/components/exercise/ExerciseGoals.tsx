import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Target, Flame, Timer, Loader2, Save } from 'lucide-react';

interface ExerciseGoalsProps {
  todayDuration: number;
  todayCalories: number;
}

interface UserGoals {
  id: string;
  daily_exercise_minutes: number;
  daily_calories_burn: number;
  exercise_goal_enabled: boolean;
}

export default function ExerciseGoals({ todayDuration, todayCalories }: ExerciseGoalsProps) {
  const { user } = useAuth();
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [enabled, setEnabled] = useState(false);
  const [targetMinutes, setTargetMinutes] = useState('30');
  const [targetCalories, setTargetCalories] = useState('300');

  useEffect(() => {
    fetchGoals();
  }, [user]);

  async function fetchGoals() {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setGoals(data);
      setEnabled(data.exercise_goal_enabled);
      setTargetMinutes(String(data.daily_exercise_minutes));
      setTargetCalories(String(data.daily_calories_burn));
    }
    setLoading(false);
  }

  async function saveGoals() {
    if (!user) return;
    setSaving(true);

    const goalData = {
      user_id: user.id,
      exercise_goal_enabled: enabled,
      daily_exercise_minutes: parseInt(targetMinutes) || 30,
      daily_calories_burn: parseInt(targetCalories) || 300,
    };

    let error;
    if (goals) {
      // Update existing
      const result = await supabase
        .from('user_goals')
        .update(goalData)
        .eq('id', goals.id);
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('user_goals')
        .insert(goalData)
        .select()
        .single();
      error = result.error;
      if (result.data) setGoals(result.data);
    }

    if (error) {
      toast.error('Failed to save goals');
      console.error(error);
    } else {
      toast.success('Goals saved!');
      fetchGoals();
    }
    setSaving(false);
  }

  const minutesProgress = enabled && parseInt(targetMinutes) > 0 
    ? Math.min((todayDuration / parseInt(targetMinutes)) * 100, 100) 
    : 0;
  
  const caloriesProgress = enabled && parseInt(targetCalories) > 0 
    ? Math.min((todayCalories / parseInt(targetCalories)) * 100, 100) 
    : 0;

  const minutesGoalMet = todayDuration >= parseInt(targetMinutes);
  const caloriesGoalMet = todayCalories >= parseInt(targetCalories);

  if (loading) {
    return (
      <Card className="border-0 shadow-lg animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg animate-slide-up">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Daily Exercise Goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable Goals Checkbox */}
        <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
          <Checkbox
            id="enable-goals"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
          />
          <Label htmlFor="enable-goals" className="font-medium cursor-pointer">
            Enable daily exercise goal tracking
          </Label>
        </div>

        {enabled && (
          <>
            {/* Goal Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target-minutes" className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary" />
                  Target Minutes
                </Label>
                <Input
                  id="target-minutes"
                  type="number"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(e.target.value)}
                  placeholder="30"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-calories" className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-terracotta" />
                  Target Calories
                </Label>
                <Input
                  id="target-calories"
                  type="number"
                  value={targetCalories}
                  onChange={(e) => setTargetCalories(e.target.value)}
                  placeholder="300"
                  min="1"
                />
              </div>
            </div>

            {/* Progress Display */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Exercise Duration</span>
                  <span className={minutesGoalMet ? 'text-green-600 font-medium' : 'text-foreground'}>
                    {todayDuration} / {targetMinutes} min
                    {minutesGoalMet && ' ✓'}
                  </span>
                </div>
                <Progress value={minutesProgress} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Calories Burned</span>
                  <span className={caloriesGoalMet ? 'text-green-600 font-medium' : 'text-foreground'}>
                    {todayCalories} / {targetCalories} kcal
                    {caloriesGoalMet && ' ✓'}
                  </span>
                </div>
                <Progress value={caloriesProgress} className="h-2" />
              </div>
            </div>
          </>
        )}

        {/* Save Button */}
        <Button onClick={saveGoals} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Goals
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
