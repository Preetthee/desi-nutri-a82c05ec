import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Target, Flame, Timer, Loader2, Save, Sparkles } from 'lucide-react';

interface ExerciseGoalsProps {
  todayDuration: number;
  todayCalories: number;
}

interface UserGoals {
  id: string;
  daily_exercise_minutes: number;
  daily_calories_burn: number;
}

interface Profile {
  fitness_goal: string | null;
}

export default function ExerciseGoals({ todayDuration, todayCalories }: ExerciseGoalsProps) {
  const { user, session } = useAuth();
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  
  // Form state
  const [targetMinutes, setTargetMinutes] = useState('30');
  const [targetCalories, setTargetCalories] = useState('300');

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;

    const [goalsResult, profileResult] = await Promise.all([
      supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('fitness_goal')
        .eq('user_id', user.id)
        .maybeSingle()
    ]);

    if (goalsResult.data) {
      setGoals(goalsResult.data);
      setTargetMinutes(String(goalsResult.data.daily_exercise_minutes || 30));
      setTargetCalories(String(goalsResult.data.daily_calories_burn || 300));
    }
    if (profileResult.data) {
      setProfile(profileResult.data);
    }
    setLoading(false);
    
    // Auto-fetch suggestion
    fetchSuggestion(profileResult.data?.fitness_goal);
  }

  async function fetchSuggestion(fitnessGoal: string | null | undefined) {
    if (!session) return;
    
    setLoadingSuggestion(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Give me ONE short daily exercise suggestion (max 15 words) based on my fitness goal: "${fitnessGoal || 'general health'}". Just the suggestion, no intro.`
            }],
          }),
        }
      );

      if (!response.ok) throw new Error('Failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let content = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6));
                const chunk = json.choices?.[0]?.delta?.content;
                if (chunk) {
                  content += chunk;
                  setSuggestion(content);
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting suggestion:', error);
    } finally {
      setLoadingSuggestion(false);
    }
  }

  async function saveGoals() {
    if (!user) return;
    setSaving(true);

    const goalData = {
      user_id: user.id,
      exercise_goal_enabled: true,
      daily_exercise_minutes: parseInt(targetMinutes) || 30,
      daily_calories_burn: parseInt(targetCalories) || 300,
    };

    let error;
    if (goals) {
      const result = await supabase
        .from('user_goals')
        .update(goalData)
        .eq('id', goals.id);
      error = result.error;
    } else {
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
    }
    setSaving(false);
  }

  const minutesProgress = parseInt(targetMinutes) > 0 
    ? Math.min((todayDuration / parseInt(targetMinutes)) * 100, 100) 
    : 0;
  
  const caloriesProgress = parseInt(targetCalories) > 0 
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
    <Card className="border-0 shadow-lg animate-slide-up bg-gradient-to-br from-primary/5 to-sage/10">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Daily Exercise Goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Daily Suggestion */}
        <div className="p-3 rounded-lg bg-golden/10 border border-golden/20">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-golden" />
            <span className="text-sm font-medium text-foreground">Today's Suggestion</span>
          </div>
          {loadingSuggestion ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Getting suggestion...
            </div>
          ) : (
            <p className="text-sm text-foreground">{suggestion || 'Try 20 minutes of brisk walking today!'}</p>
          )}
        </div>

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
              className="border-primary/20 focus:border-primary"
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
              className="border-terracotta/20 focus:border-terracotta"
            />
          </div>
        </div>

        {/* Progress Display */}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Exercise Duration</span>
              <span className={minutesGoalMet ? 'text-primary font-medium' : 'text-foreground'}>
                {todayDuration} / {targetMinutes} min
                {minutesGoalMet && ' ✓'}
              </span>
            </div>
            <Progress value={minutesProgress} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Calories Burned</span>
              <span className={caloriesGoalMet ? 'text-primary font-medium' : 'text-foreground'}>
                {todayCalories} / {targetCalories} kcal
                {caloriesGoalMet && ' ✓'}
              </span>
            </div>
            <Progress value={caloriesProgress} className="h-2" />
          </div>
        </div>

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