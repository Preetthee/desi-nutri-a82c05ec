import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { 
  Stethoscope, 
  MessageSquare,
  Apple,
  Carrot,
  Egg,
  Fish,
  AlertTriangle,
  ChevronRight,
  Flame,
  Target,
  Heart,
  Sparkles,
  AlertCircle
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

export default function FoodDoctor() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(true);

  // Goals based on common recommendations
  const goals = {
    calories: 2000,
    protein: 60,
    carbs: 250,
    fat: 65,
  };

  useEffect(() => {
    fetchData();
  }, [user]);

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

  const calculateBMI = () => {
    if (!profile?.height_cm || !profile?.weight_kg) return null;
    const heightM = profile.height_cm / 100;
    return profile.weight_kg / (heightM * heightM);
  };

  const bmi = calculateBMI();

  const nutritionTips = [
    {
      icon: Apple,
      title: 'Eat More Fruits',
      description: 'Aim for 2-3 servings of fresh fruits daily for vitamins and fiber.',
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: Fish,
      title: 'Include Protein',
      description: 'Each meal should have a protein source like fish, eggs, or dal.',
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Carrot,
      title: 'Colorful Vegetables',
      description: 'Fill half your plate with vegetables of different colors.',
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
    },
    {
      icon: Egg,
      title: 'Smart Cooking',
      description: 'Use less oil and prefer steaming, grilling over deep frying.',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  const getGoalBasedAdvice = () => {
    switch (profile?.fitness_goal) {
      case 'weight_loss':
        return {
          title: 'Weight Loss Tips',
          tips: [
            'Focus on high-protein, low-calorie meals',
            'Avoid fried Bengali snacks like singara and pakora',
            'Choose roti over rice for dinner',
            'Drink water before meals to reduce appetite',
          ],
        };
      case 'weight_gain':
        return {
          title: 'Weight Gain Tips',
          tips: [
            'Add healthy fats like ghee and nuts',
            'Include calorie-dense foods like khichuri with ghee',
            'Snack on mishti doi and bananas',
            'Eat larger portions of rice with fish curry',
          ],
        };
      case 'muscle_gain':
        return {
          title: 'Muscle Building Tips',
          tips: [
            'Eat protein with every meal (eggs, fish, chicken)',
            'Include dal in your lunch and dinner',
            'Add paneer or chhena to your diet',
            'Post-workout: have a banana shake with eggs',
          ],
        };
      default:
        return {
          title: 'General Health Tips',
          tips: [
            'Balance your macros throughout the day',
            'Include a variety of foods in your diet',
            'Stay hydrated with water and coconut water',
            'Limit processed foods and excess sugar',
          ],
        };
    }
  };

  const goalAdvice = getGoalBasedAdvice();

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
          <Card className="border-0 shadow-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-xl transition-shadow">
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
        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '100ms' }}>
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
            
            {dailySummary.calories > goals.calories && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-sm">You've exceeded your calorie goal for today. Consider lighter options for your next meal.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Health Profile Summary */}
        {(profile?.health_conditions?.length || profile?.allergies?.length || profile?.dietary_restrictions?.length) && (
          <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '150ms' }}>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Your Health Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile?.health_conditions?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Health Conditions</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.health_conditions.map((condition, i) => (
                      <Badge key={i} variant="outline" className="bg-red-500/10 text-red-700 border-red-200">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile?.allergies?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Allergies</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.allergies.map((allergy, i) => (
                      <Badge key={i} variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-200">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile?.dietary_restrictions?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Dietary Restrictions</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.dietary_restrictions.map((restriction, i) => (
                      <Badge key={i} variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">
                        {restriction}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Goal-Based Advice */}
        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              {goalAdvice.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {goalAdvice.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1">•</span>
                  <span className="text-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Quick Nutrition Tips */}
        <div className="animate-slide-up" style={{ animationDelay: '250ms' }}>
          <h2 className="font-display text-lg font-semibold mb-4">Nutrition Tips</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nutritionTips.map((tip, index) => (
              <Card key={index} className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${tip.bgColor}`}>
                      <tip.icon className={`w-5 h-5 ${tip.color}`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{tip.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{tip.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-4 rounded-lg bg-muted/50 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">{t('foodDoctor.disclaimer')}</p>
        </div>
      </div>
    </AppLayout>
  );
}
