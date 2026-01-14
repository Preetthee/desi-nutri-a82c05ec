import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Scale, 
  AlertTriangle, 
  Loader2, 
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Profile {
  height_cm: number | null;
  weight_kg: number | null;
  fitness_goal: string | null;
  health_conditions: string[] | null;
}

interface FoodLog {
  food_name: string;
  calories: number;
}

export default function BMICard() {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentFoods, setRecentFoods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;

    // Fetch profile and recent foods in parallel
    const [profileResult, foodsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('height_cm, weight_kg, fitness_goal, health_conditions')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('food_logs')
        .select('food_name, calories')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(20)
    ]);

    if (profileResult.data) setProfile(profileResult.data);
    if (foodsResult.data) {
      const uniqueFoods = [...new Set(foodsResult.data.map(f => f.food_name))];
      setRecentFoods(uniqueFoods.slice(0, 10));
    }
    setLoading(false);
  }

  const calculateBMI = () => {
    if (!profile?.height_cm || !profile?.weight_kg) return null;
    const heightM = profile.height_cm / 100;
    return profile.weight_kg / (heightM * heightM);
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Underweight', color: 'bg-blue-500/10 text-blue-600', severity: 'warning' };
    if (bmi < 25) return { label: 'Normal', color: 'bg-green-500/10 text-green-600', severity: 'success' };
    if (bmi < 30) return { label: 'Overweight', color: 'bg-yellow-500/10 text-yellow-600', severity: 'warning' };
    return { label: 'Obese', color: 'bg-red-500/10 text-red-600', severity: 'error' };
  };

  async function getFoodAdvice() {
    if (!session) return;
    
    setLoadingAdvice(true);
    setShowAdvice(true);

    try {
      const bmi = calculateBMI();
      const category = bmi ? getBMICategory(bmi) : null;

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
              content: `Based on my BMI of ${bmi?.toFixed(1)} (${category?.label}), fitness goal: "${profile?.fitness_goal || 'general health'}", and these foods I've eaten recently: ${recentFoods.join(', ')}. 
              
Please provide a brief, actionable list of:
1. 3-4 specific foods from my recent meals I should AVOID or eat less of
2. 3-4 healthier alternatives I could try instead

Keep it concise and specific to Bengali/South Asian cuisine if relevant.`
            }],
            userContext: {
              healthConditions: profile?.health_conditions,
              fitnessGoal: profile?.fitness_goal,
            },
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to get advice');

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
                  setAdvice(content);
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting advice:', error);
      toast.error('Failed to get food advice');
      setAdvice('Unable to load advice. Please try again.');
    } finally {
      setLoadingAdvice(false);
    }
  }

  const bmi = calculateBMI();
  const bmiCategory = bmi ? getBMICategory(bmi) : null;

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!profile?.height_cm || !profile?.weight_kg) {
    return (
      <Card className="border-0 shadow-lg bg-muted/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">Add your height and weight in Settings to see your BMI</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg animate-slide-up">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          Your BMI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* BMI Display */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-foreground">
              {bmi?.toFixed(1)}
            </div>
            <Badge className={bmiCategory?.color}>
              {bmiCategory?.label}
            </Badge>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{profile.weight_kg} kg</p>
            <p>{profile.height_cm} cm</p>
          </div>
        </div>

        {/* BMI Scale Visual */}
        <div className="relative h-2 bg-gradient-to-r from-blue-400 via-green-400 via-yellow-400 to-red-400 rounded-full">
          <div 
            className="absolute -top-1 w-4 h-4 bg-foreground rounded-full border-2 border-background shadow-md"
            style={{ 
              left: `${Math.min(Math.max(((bmi || 18.5) - 15) / 25 * 100, 0), 100)}%`,
              transform: 'translateX(-50%)'
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>15</span>
          <span>18.5</span>
          <span>25</span>
          <span>30</span>
          <span>40</span>
        </div>

        {/* Food Advice Section */}
        <div className="pt-2 border-t border-border">
          <Button 
            variant="outline" 
            className="w-full justify-between"
            onClick={() => advice ? setShowAdvice(!showAdvice) : getFoodAdvice()}
            disabled={loadingAdvice}
          >
            <span className="flex items-center gap-2">
              {loadingAdvice ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
              {advice ? 'Foods to Avoid' : 'Get AI Food Suggestions'}
            </span>
            {advice && (showAdvice ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
          </Button>

          {showAdvice && advice && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
              <p className="whitespace-pre-wrap text-foreground">{advice}</p>
              <div className="flex items-start gap-2 mt-3 pt-2 border-t border-border">
                <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  This is AI-generated advice. Consult a healthcare professional for medical decisions.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
