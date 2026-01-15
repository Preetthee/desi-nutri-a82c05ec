import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { 
  Stethoscope, 
  MessageSquare,
  ChevronRight,
  Flame,
  Target,
  Sparkles,
  AlertCircle,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Apple,
  Wallet,
  Ban,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface Profile {
  full_name: string | null;
  fitness_goal: string | null;
  health_conditions: string[] | null;
  dietary_restrictions: string[] | null;
  allergies: string[] | null;
  height_cm: number | null;
  weight_kg: number | null;
}

interface DailySummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const CACHE_KEY = 'food_doctor_cache_v2';

interface BilingualContent {
  en: string;
  bn: string;
}

interface CachedData {
  mealPlan: Record<string, BilingualContent>;
  recommended: BilingualContent | null;
  budget: BilingualContent | null;
  avoid: BilingualContent | null;
}

function getCachedData(userId: string): CachedData | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (!cached) return null;
    const { data, date } = JSON.parse(cached);
    const today = new Date().toDateString();
    if (date === today) return data;
    return null;
  } catch {
    return null;
  }
}

function setCachedData(userId: string, data: CachedData) {
  localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify({
    data,
    date: new Date().toDateString()
  }));
}

export default function FoodDoctor() {
  const { t, language } = useLanguage();
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(true);
  
  // AI-generated content states - bilingual
  const [mealPlan, setMealPlan] = useState<Record<string, BilingualContent>>({});
  const [loadingMeal, setLoadingMeal] = useState<string | null>(null);
  const [recommendedFoods, setRecommendedFoods] = useState<BilingualContent | null>(null);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [budgetFoods, setBudgetFoods] = useState<BilingualContent | null>(null);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [avoidFoods, setAvoidFoods] = useState<BilingualContent | null>(null);
  const [loadingAvoid, setLoadingAvoid] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Goals based on common recommendations
  const goals = {
    calories: 2000,
    protein: 60,
    carbs: 250,
    fat: 65,
  };

  const mealTabs = [
    { id: 'breakfast', label: 'Breakfast', icon: Coffee },
    { id: 'lunch', label: 'Lunch', icon: Sun },
    { id: 'dinner', label: 'Dinner', icon: Moon },
    { id: 'snacks', label: 'Snacks', icon: Cookie },
  ];

  useEffect(() => {
    fetchData();
  }, [user]);

  // Auto-generate all content when profile is loaded (with caching)
  useEffect(() => {
    if (profile && session && user && !initialLoadDone) {
      const cached = getCachedData(user.id);
      if (cached) {
        setMealPlan(cached.mealPlan || {});
        setRecommendedFoods(cached.recommended);
        setBudgetFoods(cached.budget);
        setAvoidFoods(cached.avoid);
        setInitialLoadDone(true);
      } else {
        generateAll();
        setInitialLoadDone(true);
      }
    }
  }, [profile, session, user, initialLoadDone]);

  // Save to cache whenever data changes
  useEffect(() => {
    if (user && initialLoadDone && (Object.keys(mealPlan).length > 0 || recommendedFoods || budgetFoods || avoidFoods)) {
      setCachedData(user.id, {
        mealPlan,
        recommended: recommendedFoods,
        budget: budgetFoods,
        avoid: avoidFoods
      });
    }
  }, [mealPlan, recommendedFoods, budgetFoods, avoidFoods, user, initialLoadDone]);

  async function fetchData() {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    const [profileResult, foodLogsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, fitness_goal, health_conditions, dietary_restrictions, allergies, height_cm, weight_kg')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('food_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
    ]);

    if (profileResult.data) setProfile(profileResult.data);
    
    if (foodLogsResult.data) {
      setDailySummary({
        calories: foodLogsResult.data.reduce((sum, log) => sum + (Number(log.calories) || 0), 0),
        protein: foodLogsResult.data.reduce((sum, log) => sum + (Number(log.protein_g) || 0), 0),
        carbs: foodLogsResult.data.reduce((sum, log) => sum + (Number(log.carbs_g) || 0), 0),
        fat: foodLogsResult.data.reduce((sum, log) => sum + (Number(log.fat_g) || 0), 0),
      });
    }
    
    setLoading(false);
  }

  async function generateAll() {
    // Generate all sections in parallel
    await Promise.all([
      generateMealSuggestion('breakfast'),
      generateRecommendedFoods(),
      generateBudgetFoods(),
      generateAvoidFoods()
    ]);
  }

  async function generateMealSuggestion(mealType: string) {
    if (!session || !profile) return;
    
    setLoadingMeal(mealType);
    try {
      const response = await fetchAIBilingual(`Suggest 2 simple ${mealType} options for ${profile.fitness_goal || 'general health'}. Allergies: ${profile.allergies?.join(', ') || 'none'}. One line each, no long descriptions.`);
      
      setMealPlan(prev => ({ ...prev, [mealType]: response }));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingMeal(null);
    }
  }

  async function generateRecommendedFoods() {
    if (!session || !profile) return;
    
    setLoadingRecommended(true);
    try {
      const response = await fetchAIBilingual(`List only 3 recommended foods for ${profile.fitness_goal || 'general health'}. One line each with brief benefit.`);
      
      setRecommendedFoods(response);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingRecommended(false);
    }
  }

  async function generateBudgetFoods() {
    if (!session || !profile) return;
    
    setLoadingBudget(true);
    try {
      const response = await fetchAIBilingual(`List only 3 budget-friendly healthy foods. One line each with cost benefit. Keep it very short.`);
      
      setBudgetFoods(response);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingBudget(false);
    }
  }

  async function generateAvoidFoods() {
    if (!session || !profile) return;
    
    setLoadingAvoid(true);
    try {
      const bmi = profile.height_cm && profile.weight_kg 
        ? profile.weight_kg / Math.pow(profile.height_cm / 100, 2)
        : null;
        
      const response = await fetchAIBilingual(`List only 3 foods to AVOID for BMI ${bmi?.toFixed(1) || 'unknown'}, ${profile.health_conditions?.join(', ') || 'no conditions'}. One line each with brief reason.`);
      
      setAvoidFoods(response);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingAvoid(false);
    }
  }

  async function fetchAIBilingual(prompt: string): Promise<BilingualContent> {
    const bilingualPrompt = `${prompt}

IMPORTANT: Respond in BOTH English AND Bangla. Use this EXACT format:
[ENGLISH]
Your English response here
[BANGLA]
আপনার বাংলা প্রতিক্রিয়া এখানে`;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: bilingualPrompt }],
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
              if (chunk) content += chunk;
            } catch {}
          }
        }
      }
    }

    // Parse bilingual response
    const englishMatch = content.match(/\[ENGLISH\]([\s\S]*?)(?=\[BANGLA\]|$)/i);
    const banglaMatch = content.match(/\[BANGLA\]([\s\S]*?)$/i);
    
    return {
      en: englishMatch?.[1]?.trim() || content.trim(),
      bn: banglaMatch?.[1]?.trim() || content.trim()
    };
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 pb-24 lg:pb-8 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Stethoscope className="w-6 h-6 text-primary" />
            </div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
              {t('foodDoctor.title')}
            </h1>
          </div>
          <p className="text-muted-foreground">{t('foodDoctor.subtitle')}</p>
        </div>

        {/* AI Assistant CTA */}
        <Link to="/ai-assistant" className="block animate-slide-up">
          <Card className="border-0 shadow-lg bg-gradient-to-r from-primary to-forest text-primary-foreground hover:shadow-xl transition-shadow">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary-foreground/20">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold mb-1">
                    Chat with AI Assistant
                  </h3>
                  <p className="text-sm opacity-90">
                    Get personalized nutrition advice and ask any health questions
                  </p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6" />
            </CardContent>
          </Card>
        </Link>

        {/* Today's Nutrition Overview */}
        <Card className="border-0 shadow-lg animate-slide-up bg-gradient-to-br from-sage/10 to-primary/5" style={{ animationDelay: '100ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Today's Nutrition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-terracotta" />
                  <span className="text-sm text-muted-foreground">Calories</span>
                </div>
                <p className="text-xl font-bold">{Math.round(dailySummary.calories)} <span className="text-sm font-normal text-muted-foreground">/ {goals.calories}</span></p>
                <Progress value={(dailySummary.calories / goals.calories) * 100} className="h-1.5 mt-2" />
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Protein</span>
                </div>
                <p className="text-xl font-bold">{Math.round(dailySummary.protein)}g <span className="text-sm font-normal text-muted-foreground">/ {goals.protein}g</span></p>
                <Progress value={(dailySummary.protein / goals.protein) * 100} className="h-1.5 mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Meal Plan */}
        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '150ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Coffee className="w-5 h-5 text-golden" />
              Daily Meal Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="breakfast" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                {mealTabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
                    <tab.icon className="w-4 h-4 mr-1 hidden sm:inline" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {mealTabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-4">
                  {mealPlan[tab.id] ? (
                    <div className="space-y-2">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{mealPlan[tab.id][language]}</p>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => generateMealSuggestion(tab.id)}
                          disabled={loadingMeal === tab.id}
                          className="h-7 w-7"
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingMeal === tab.id ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {language === 'en' ? `Generating ${tab.label.toLowerCase()} ideas...` : 'তৈরি হচ্ছে...'}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Recommended Foods */}
        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Apple className="w-5 h-5 text-primary" />
                Recommended Foods
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={generateRecommendedFoods}
                disabled={loadingRecommended}
                className="h-8 w-8"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRecommended ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recommendedFoods ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{recommendedFoods[language]}</p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === 'en' ? 'Getting recommendations...' : 'সুপারিশ পাওয়া যাচ্ছে...'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget-Friendly Foods */}
        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '250ms' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Wallet className="w-5 h-5 text-golden" />
                Budget-Friendly Foods
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={generateBudgetFoods}
                disabled={loadingBudget}
                className="h-8 w-8"
              >
                <RefreshCw className={`w-4 h-4 ${loadingBudget ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {budgetFoods ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{budgetFoods[language]}</p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === 'en' ? 'Getting budget options...' : 'বাজেট বিকল্প পাওয়া যাচ্ছে...'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Foods to Avoid */}
        <Card className="border-0 shadow-lg animate-slide-up bg-gradient-to-br from-terracotta/5 to-destructive/5" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Ban className="w-5 h-5 text-terracotta" />
                Foods to Avoid
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={generateAvoidFoods}
                disabled={loadingAvoid}
                className="h-8 w-8"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAvoid ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {avoidFoods ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{avoidFoods[language]}</p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === 'en' ? 'Getting foods to avoid...' : 'এড়িয়ে চলা খাবার পাওয়া যাচ্ছে...'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-4 rounded-lg bg-muted/50 animate-slide-up" style={{ animationDelay: '350ms' }}>
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">{t('foodDoctor.disclaimer')}</p>
        </div>
      </div>
    </AppLayout>
  );
}