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
  Loader2, 
  Sparkles,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface Profile {
  height_cm: number | null;
  weight_kg: number | null;
  fitness_goal: string | null;
  health_conditions: string[] | null;
}

export default function BMICard() {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTip, setLoadingTip] = useState(false);
  const [dailyTip, setDailyTip] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('height_cm, weight_kg, fitness_goal, health_conditions')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) setProfile(data);
    setLoading(false);
    
    // Auto-fetch daily tip
    if (data?.height_cm && data?.weight_kg) {
      fetchDailyTip(data);
    }
  }

  const calculateBMI = () => {
    if (!profile?.height_cm || !profile?.weight_kg) return null;
    const heightM = profile.height_cm / 100;
    return profile.weight_kg / (heightM * heightM);
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Underweight', color: 'bg-sage/20 text-sage' };
    if (bmi < 25) return { label: 'Normal', color: 'bg-primary/20 text-primary' };
    if (bmi < 30) return { label: 'Overweight', color: 'bg-golden/20 text-golden' };
    return { label: 'Obese', color: 'bg-terracotta/20 text-terracotta' };
  };

  async function fetchDailyTip(profileData?: Profile) {
    if (!session) return;
    
    const data = profileData || profile;
    if (!data) return;
    
    setLoadingTip(true);

    try {
      const bmi = data.height_cm && data.weight_kg 
        ? data.weight_kg / Math.pow(data.height_cm / 100, 2)
        : null;
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
              content: `Give me ONE short, actionable daily food tip (max 25 words, 3 lines) based on:
- BMI: ${bmi?.toFixed(1)} (${category?.label})
- Goal: ${data.fitness_goal || 'general health'}

Just the tip, no intro or explanation.`
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
                  setDailyTip(content);
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting tip:', error);
      toast.error('Failed to get food tip');
    } finally {
      setLoadingTip(false);
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
    <Card className="border-0 shadow-lg animate-slide-up bg-gradient-to-br from-primary/5 to-sage/10">
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
        <div className="relative h-2 bg-gradient-to-r from-sage via-primary via-golden to-terracotta rounded-full">
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

        {/* Daily Food Tip - Short 3 line version */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-golden" />
              <span className="text-sm font-medium text-foreground">Daily Food Tip</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchDailyTip()}
              disabled={loadingTip}
              className="h-7 w-7"
            >
              {loadingTip ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
            </Button>
          </div>
          <div className="p-3 rounded-lg bg-golden/10 border border-golden/20">
            {loadingTip && !dailyTip ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Getting your tip...
              </div>
            ) : (
              <p className="text-sm text-foreground line-clamp-3">
                {dailyTip || 'Click refresh to get a personalized food tip!'}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}