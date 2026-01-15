import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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

interface BilingualTip {
  en: string;
  bn: string;
  date: string;
}

const CACHE_KEY = 'bmi_daily_tip_bilingual';

function getCachedTip(userId: string): BilingualTip | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (!cached) return null;
    const data = JSON.parse(cached) as BilingualTip;
    const today = new Date().toDateString();
    if (data.date === today) return data;
    return null;
  } catch {
    return null;
  }
}

function setCachedTip(userId: string, tip: BilingualTip) {
  localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(tip));
}

export default function BMICard() {
  const { user, session } = useAuth();
  const { language, t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTip, setLoadingTip] = useState(false);
  const [bilingualTip, setBilingualTip] = useState<BilingualTip | null>(null);

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
    
    // Check cache first, only fetch if no cached tip for today
    if (data?.height_cm && data?.weight_kg) {
      const cachedTip = getCachedTip(user.id);
      if (cachedTip) {
        setBilingualTip(cachedTip);
      } else {
        fetchDailyTip(data);
      }
    }
  }

  const calculateBMI = () => {
    if (!profile?.height_cm || !profile?.weight_kg) return null;
    const heightM = profile.height_cm / 100;
    return profile.weight_kg / (heightM * heightM);
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: language === 'bn' ? 'কম ওজন' : 'Underweight', color: 'bg-sage/20 text-sage' };
    if (bmi < 25) return { label: language === 'bn' ? 'স্বাভাবিক' : 'Normal', color: 'bg-primary/20 text-primary' };
    if (bmi < 30) return { label: language === 'bn' ? 'অতিরিক্ত ওজন' : 'Overweight', color: 'bg-golden/20 text-golden' };
    return { label: language === 'bn' ? 'স্থূলতা' : 'Obese', color: 'bg-terracotta/20 text-terracotta' };
  };

  async function fetchDailyTip(profileData?: Profile, forceRefresh = false) {
    if (!session || !user) return;
    
    const data = profileData || profile;
    if (!data) return;

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cachedTip = getCachedTip(user.id);
      if (cachedTip) {
        setBilingualTip(cachedTip);
        return;
      }
    }
    
    setLoadingTip(true);

    try {
      const bmi = data.height_cm && data.weight_kg 
        ? data.weight_kg / Math.pow(data.height_cm / 100, 2)
        : null;
      const categoryLabel = bmi && bmi < 18.5 ? 'Underweight' : bmi && bmi < 25 ? 'Normal' : bmi && bmi < 30 ? 'Overweight' : 'Obese';

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
              content: `Give me ONE short, actionable daily food tip for Bangladesh (max 25 words, 3 lines) based on:
- BMI: ${bmi?.toFixed(1)} (${categoryLabel})
- Goal: ${data.fitness_goal || 'general health'}

Provide BOTH English and Bangla versions in this exact format:
[ENGLISH]
Your tip in English here
[BANGLA]
আপনার বাংলা টিপ এখানে

Just the tips, no extra text.`
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
        
        const tipData: BilingualTip = {
          en: englishMatch?.[1]?.trim() || content.trim(),
          bn: banglaMatch?.[1]?.trim() || content.trim(),
          date: new Date().toDateString()
        };
        
        setBilingualTip(tipData);
        setCachedTip(user.id, tipData);
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
  const displayTip = bilingualTip ? (language === 'bn' ? bilingualTip.bn : bilingualTip.en) : null;

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
            <p className="text-sm">
              {language === 'bn' 
                ? 'আপনার BMI দেখতে সেটিংসে উচ্চতা ও ওজন যোগ করুন' 
                : 'Add your height and weight in Settings to see your BMI'}
            </p>
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
          {language === 'bn' ? 'আপনার BMI' : 'Your BMI'}
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
            <p>{profile.weight_kg} {t('common.kg')}</p>
            <p>{profile.height_cm} {t('common.cm')}</p>
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

        {/* Daily Food Tip - Bilingual */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-golden" />
              <span className="text-sm font-medium text-foreground">
                {t('home.dailyTip')}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchDailyTip(undefined, true)}
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
            {loadingTip && !displayTip ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {language === 'bn' ? 'টিপ লোড হচ্ছে...' : 'Getting your tip...'}
              </div>
            ) : (
              <p className="text-sm text-foreground line-clamp-3">
                {displayTip || (language === 'bn' 
                  ? 'রিফ্রেশ করে টিপ পান!' 
                  : 'Click refresh to get a personalized food tip!')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
