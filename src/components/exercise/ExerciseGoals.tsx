import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Target, Flame, Timer, Loader2, Save, Sparkles, RefreshCw } from 'lucide-react';

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

interface BilingualSuggestion {
  en: string;
  bn: string;
  date: string;
}

const CACHE_KEY = 'exercise_suggestion_bilingual';

function getCachedSuggestion(userId: string): BilingualSuggestion | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (!cached) return null;
    const data = JSON.parse(cached) as BilingualSuggestion;
    const today = new Date().toDateString();
    if (data.date === today) return data;
    return null;
  } catch {
    return null;
  }
}

function setCachedSuggestion(userId: string, suggestion: BilingualSuggestion) {
  localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(suggestion));
}

export default function ExerciseGoals({ todayDuration, todayCalories }: ExerciseGoalsProps) {
  const { user, session } = useAuth();
  const { language, t } = useLanguage();
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [bilingualSuggestion, setBilingualSuggestion] = useState<BilingualSuggestion | null>(null);
  
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
    
    // Check cache for suggestion
    const cached = getCachedSuggestion(user.id);
    if (cached) {
      setBilingualSuggestion(cached);
    } else {
      fetchSuggestion(profileResult.data?.fitness_goal);
    }
  }

  async function fetchSuggestion(fitnessGoal: string | null | undefined, forceRefresh = false) {
    if (!session || !user) return;
    
    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = getCachedSuggestion(user.id);
      if (cached) {
        setBilingualSuggestion(cached);
        return;
      }
    }
    
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
              content: `Give me ONE short daily exercise suggestion (max 15 words) for Bangladesh based on fitness goal: "${fitnessGoal || 'general health'}". 

Provide BOTH English and Bangla versions in this exact format:
[ENGLISH]
Your suggestion in English
[BANGLA]
আপনার বাংলা পরামর্শ

Just the suggestions, no extra text.`
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
                }
              } catch {}
            }
          }
        }
      }
      
      // Parse bilingual response
      if (content) {
        const englishMatch = content.match(/\[ENGLISH\]\s*([\s\S]*?)\s*\[BANGLA\]/i);
        const banglaMatch = content.match(/\[BANGLA\]\s*([\s\S]*?)$/i);
        
        const suggestionData: BilingualSuggestion = {
          en: englishMatch?.[1]?.trim() || content.trim(),
          bn: banglaMatch?.[1]?.trim() || content.trim(),
          date: new Date().toDateString()
        };
        
        setBilingualSuggestion(suggestionData);
        setCachedSuggestion(user.id, suggestionData);
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
      toast.error(language === 'bn' ? 'লক্ষ্য সংরক্ষণ করতে ব্যর্থ' : 'Failed to save goals');
      console.error(error);
    } else {
      toast.success(language === 'bn' ? 'লক্ষ্য সংরক্ষিত!' : 'Goals saved!');
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
  
  const displaySuggestion = bilingualSuggestion 
    ? (language === 'bn' ? bilingualSuggestion.bn : bilingualSuggestion.en)
    : null;

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
          {language === 'bn' ? 'দৈনিক ব্যায়াম লক্ষ্য' : 'Daily Exercise Goals'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Daily Suggestion - Bilingual */}
        <div className="p-3 rounded-lg bg-golden/10 border border-golden/20">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-golden" />
              <span className="text-sm font-medium text-foreground">
                {language === 'bn' ? 'আজকের পরামর্শ' : "Today's Suggestion"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchSuggestion(profile?.fitness_goal, true)}
              disabled={loadingSuggestion}
              className="h-6 w-6"
            >
              {loadingSuggestion ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
            </Button>
          </div>
          {loadingSuggestion && !displaySuggestion ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              {language === 'bn' ? 'পরামর্শ লোড হচ্ছে...' : 'Getting suggestion...'}
            </div>
          ) : (
            <p className="text-sm text-foreground">
              {displaySuggestion || (language === 'bn' 
                ? 'আজ ২০ মিনিট হাঁটার চেষ্টা করুন!' 
                : 'Try 20 minutes of brisk walking today!')}
            </p>
          )}
        </div>

        {/* Goal Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="target-minutes" className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              {language === 'bn' ? 'লক্ষ্য মিনিট' : 'Target Minutes'}
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
              {language === 'bn' ? 'লক্ষ্য ক্যালোরি' : 'Target Calories'}
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
              <span className="text-muted-foreground">
                {language === 'bn' ? 'ব্যায়ামের সময়কাল' : 'Exercise Duration'}
              </span>
              <span className={minutesGoalMet ? 'text-primary font-medium' : 'text-foreground'}>
                {todayDuration} / {targetMinutes} {language === 'bn' ? 'মিনিট' : 'min'}
                {minutesGoalMet && ' ✓'}
              </span>
            </div>
            <Progress value={minutesProgress} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {language === 'bn' ? 'ক্যালোরি পোড়ানো' : 'Calories Burned'}
              </span>
              <span className={caloriesGoalMet ? 'text-primary font-medium' : 'text-foreground'}>
                {todayCalories} / {targetCalories} {language === 'bn' ? 'কিলোক্যালোরি' : 'kcal'}
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
              {language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {language === 'bn' ? 'লক্ষ্য সংরক্ষণ করুন' : 'Save Goals'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
