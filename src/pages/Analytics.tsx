import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { BarChart3, TrendingUp, Target, Flame } from 'lucide-react';

interface DayData {
  date: string;
  day: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [weeklyData, setWeeklyData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    avgCalories: 0,
    avgProtein: 0,
    avgCarbs: 0,
    avgFat: 0,
    daysTracked: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

  async function fetchAnalytics() {
    if (!user) return;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data: foodLogs } = await supabase
        .from('food_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', user.id)
        .gte('logged_at', `${dateStr}T00:00:00`)
        .lte('logged_at', `${dateStr}T23:59:59`);

      const dayData = {
        date: dateStr,
        day: format(date, 'EEE'),
        calories: foodLogs?.reduce((sum, log) => sum + (Number(log.calories) || 0), 0) || 0,
        protein: foodLogs?.reduce((sum, log) => sum + (Number(log.protein_g) || 0), 0) || 0,
        carbs: foodLogs?.reduce((sum, log) => sum + (Number(log.carbs_g) || 0), 0) || 0,
        fat: foodLogs?.reduce((sum, log) => sum + (Number(log.fat_g) || 0), 0) || 0,
      };

      days.push(dayData);
    }

    setWeeklyData(days);

    const daysWithData = days.filter(d => d.calories > 0);
    const daysCount = daysWithData.length || 1;

    setTotalStats({
      avgCalories: Math.round(daysWithData.reduce((sum, d) => sum + d.calories, 0) / daysCount),
      avgProtein: Math.round(daysWithData.reduce((sum, d) => sum + d.protein, 0) / daysCount),
      avgCarbs: Math.round(daysWithData.reduce((sum, d) => sum + d.carbs, 0) / daysCount),
      avgFat: Math.round(daysWithData.reduce((sum, d) => sum + d.fat, 0) / daysCount),
      daysTracked: daysCount,
    });

    setLoading(false);
  }

  const macroData = [
    { name: t('home.protein'), value: totalStats.avgProtein, color: 'hsl(var(--primary))' },
    { name: t('home.carbs'), value: totalStats.avgCarbs, color: 'hsl(var(--golden))' },
    { name: t('home.fat'), value: totalStats.avgFat, color: 'hsl(var(--terracotta))' },
  ];

  const statCards = [
    { label: 'Avg Calories', value: totalStats.avgCalories, unit: 'kcal', icon: Flame, color: 'text-terracotta' },
    { label: 'Avg Protein', value: totalStats.avgProtein, unit: 'g', icon: Target, color: 'text-primary' },
    { label: 'Days Tracked', value: totalStats.daysTracked, unit: 'days', icon: TrendingUp, color: 'text-golden' },
  ];

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 pb-24 lg:pb-8 space-y-6 max-w-4xl mx-auto">
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
            {t('analytics.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('analytics.progress')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 animate-slide-up">
          {statCards.map((stat, index) => (
            <Card key={stat.label} className="border-0 shadow-md" style={{ animationDelay: `${index * 100}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="calories" className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calories">{t('analytics.caloriesTrend')}</TabsTrigger>
            <TabsTrigger value="macros">{t('analytics.macroBreakdown')}</TabsTrigger>
          </TabsList>

          <TabsContent value="calories" className="mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  {t('analytics.weekly')} {t('home.calories')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData}>
                      <defs>
                        <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="calories" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorCalories)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="macros" className="mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="font-display text-lg">
                  {t('analytics.macroBreakdown')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={macroData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {macroData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`${value}g`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  {macroData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                      <span className="text-sm font-medium">{item.value}g</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Weekly Bar Chart */}
        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {t('analytics.weekly')} Macros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="protein" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="carbs" fill="hsl(var(--golden))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fat" fill="hsl(var(--terracotta))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
