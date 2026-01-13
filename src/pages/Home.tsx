import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Utensils, 
  Dumbbell, 
  Droplets, 
  BarChart3,
  Flame,
  Beef,
  Wheat,
  Cookie,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';

interface DailySummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

interface Profile {
  full_name: string | null;
  fitness_goal: string | null;
}

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    water: 0,
  });
  const [loading, setLoading] = useState(true);

  // Goals (could be personalized based on profile)
  const goals = {
    calories: 2000,
    protein: 60,
    carbs: 250,
    fat: 65,
    water: 2500,
  };

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, fitness_goal')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch today's food logs
      const { data: foodLogs } = await supabase
        .from('food_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`);

      // Fetch today's water logs
      const { data: waterLogs } = await supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`);

      const summary = {
        calories: foodLogs?.reduce((sum, log) => sum + (Number(log.calories) || 0), 0) || 0,
        protein: foodLogs?.reduce((sum, log) => sum + (Number(log.protein_g) || 0), 0) || 0,
        carbs: foodLogs?.reduce((sum, log) => sum + (Number(log.carbs_g) || 0), 0) || 0,
        fat: foodLogs?.reduce((sum, log) => sum + (Number(log.fat_g) || 0), 0) || 0,
        water: waterLogs?.reduce((sum, log) => sum + (log.amount_ml || 0), 0) || 0,
      };

      setDailySummary(summary);
      setLoading(false);
    }

    fetchData();
  }, [user]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const quickActions = [
    { 
      icon: Utensils, 
      label: t('home.logMeal'), 
      path: '/tracker',
      color: 'bg-terracotta/10 text-terracotta'
    },
    { 
      icon: Dumbbell, 
      label: t('home.logExercise'), 
      path: '/exercise',
      color: 'bg-primary/10 text-primary'
    },
    { 
      icon: Droplets, 
      label: t('home.logWater'), 
      path: '/tracker',
      color: 'bg-blue-500/10 text-blue-500'
    },
    { 
      icon: BarChart3, 
      label: t('home.viewAnalytics'), 
      path: '/analytics',
      color: 'bg-golden/10 text-golden'
    },
  ];

  const macros = [
    { 
      icon: Flame, 
      label: t('home.calories'), 
      value: dailySummary.calories, 
      goal: goals.calories, 
      unit: t('common.kcal'),
      color: 'text-terracotta'
    },
    { 
      icon: Beef, 
      label: t('home.protein'), 
      value: dailySummary.protein, 
      goal: goals.protein, 
      unit: t('common.g'),
      color: 'text-primary'
    },
    { 
      icon: Wheat, 
      label: t('home.carbs'), 
      value: dailySummary.carbs, 
      goal: goals.carbs, 
      unit: t('common.g'),
      color: 'text-golden'
    },
    { 
      icon: Cookie, 
      label: t('home.fat'), 
      value: dailySummary.fat, 
      goal: goals.fat, 
      unit: t('common.g'),
      color: 'text-sage'
    },
  ];

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 pb-24 lg:pb-8 space-y-6 max-w-4xl mx-auto">
        {/* Greeting */}
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
            {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Today's Summary */}
        <Card className="animate-slide-up border-0 shadow-lg bg-gradient-to-br from-primary/5 to-terracotta/5">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t('home.todaySummary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {macros.map((macro, index) => (
                <div 
                  key={macro.label}
                  className="p-4 rounded-xl bg-card border border-border"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <macro.icon className={`w-4 h-4 ${macro.color}`} />
                    <span className="text-sm text-muted-foreground">{macro.label}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">
                        {Math.round(macro.value)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {macro.goal} {macro.unit}
                      </span>
                    </div>
                    <Progress 
                      value={(macro.value / macro.goal) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Water intake */}
            <div className="mt-4 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">{t('home.water')}</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-foreground">
                    {dailySummary.water}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {' '}/ {goals.water} {t('tracker.ml')}
                  </span>
                </div>
              </div>
              <Progress 
                value={(dailySummary.water / goals.water) * 100} 
                className="h-2 mt-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <h2 className="font-display text-lg font-semibold mb-4">{t('home.quickActions')}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action, index) => (
              <Link
                key={action.label}
                to={action.path}
                className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className={`p-2 rounded-lg ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Food Doctor CTA */}
        <Link 
          to="/food-doctor"
          className="block animate-slide-up"
          style={{ animationDelay: '300ms' }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-xl transition-shadow">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-bold mb-1">
                  {t('nav.foodDoctor')}
                </h3>
                <p className="text-sm opacity-90">
                  {t('foodDoctor.subtitle')}
                </p>
              </div>
              <ChevronRight className="w-6 h-6" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </AppLayout>
  );
}
