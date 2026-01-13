import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Plus, 
  Coffee, 
  Sun, 
  Moon, 
  Cookie, 
  Droplets,
  Trash2,
  Loader2
} from 'lucide-react';

interface FoodLog {
  id: string;
  meal_type: string;
  food_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  quantity: number | null;
  unit: string | null;
  logged_at: string;
}

interface WaterLog {
  id: string;
  amount_ml: number;
  logged_at: string;
}

export default function Tracker() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFood, setAddingFood] = useState(false);
  const [addingWater, setAddingWater] = useState(false);
  const [foodDialogOpen, setFoodDialogOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');

  // Form state for adding food
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [quantity, setQuantity] = useState('1');

  const waterGoal = 2500; // ml
  const totalWater = waterLogs.reduce((sum, log) => sum + log.amount_ml, 0);

  const mealTypes = [
    { id: 'breakfast', label: t('tracker.breakfast'), icon: Coffee },
    { id: 'lunch', label: t('tracker.lunch'), icon: Sun },
    { id: 'dinner', label: t('tracker.dinner'), icon: Moon },
    { id: 'snack', label: t('tracker.snacks'), icon: Cookie },
  ];

  useEffect(() => {
    fetchLogs();
  }, [user]);

  async function fetchLogs() {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    const [foodResponse, waterResponse] = await Promise.all([
      supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
        .order('logged_at', { ascending: true }),
      supabase
        .from('water_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
        .order('logged_at', { ascending: true }),
    ]);

    if (foodResponse.data) setFoodLogs(foodResponse.data);
    if (waterResponse.data) setWaterLogs(waterResponse.data);
    setLoading(false);
  }

  async function addFood() {
    if (!user || !foodName.trim()) return;

    setAddingFood(true);
    const { error } = await supabase.from('food_logs').insert({
      user_id: user.id,
      meal_type: selectedMealType,
      food_name: foodName.trim(),
      calories: calories ? parseFloat(calories) : null,
      protein_g: protein ? parseFloat(protein) : null,
      carbs_g: carbs ? parseFloat(carbs) : null,
      fat_g: fat ? parseFloat(fat) : null,
      quantity: quantity ? parseFloat(quantity) : 1,
    });

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('common.success'));
      resetFoodForm();
      setFoodDialogOpen(false);
      fetchLogs();
    }
    setAddingFood(false);
  }

  async function deleteFood(id: string) {
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    if (error) {
      toast.error(t('common.error'));
    } else {
      setFoodLogs(foodLogs.filter((log) => log.id !== id));
    }
  }

  async function addWater(amount: number) {
    if (!user) return;

    setAddingWater(true);
    const { error } = await supabase.from('water_logs').insert({
      user_id: user.id,
      amount_ml: amount,
    });

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(`+${amount}ml 💧`);
      fetchLogs();
    }
    setAddingWater(false);
  }

  function resetFoodForm() {
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setQuantity('1');
  }

  function getMealLogs(mealType: string) {
    return foodLogs.filter((log) => log.meal_type === mealType);
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 pb-24 lg:pb-8 space-y-6 max-w-4xl mx-auto">
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
            {t('tracker.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('common.today')}</p>
        </div>

        {/* Water Intake Card */}
        <Card className="animate-slide-up border-0 shadow-lg bg-gradient-to-br from-blue-500/5 to-blue-600/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-500" />
              {t('tracker.waterIntake')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-3xl font-bold text-foreground">{totalWater}</span>
                <span className="text-muted-foreground"> / {waterGoal} {t('tracker.ml')}</span>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                {Math.round((totalWater / waterGoal) * 100)}% {t('tracker.goal')}
              </div>
            </div>
            <Progress value={(totalWater / waterGoal) * 100} className="h-3" />
            <div className="flex gap-2">
              {[150, 250, 500].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => addWater(amount)}
                  disabled={addingWater}
                  className="flex-1"
                >
                  +{amount}ml
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Meal Sections */}
        {mealTypes.map((meal, index) => {
          const logs = getMealLogs(meal.id);
          const mealCalories = logs.reduce((sum, log) => sum + (Number(log.calories) || 0), 0);

          return (
            <Card 
              key={meal.id} 
              className="animate-slide-up border-0 shadow-md"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <meal.icon className="w-5 h-5 text-primary" />
                    {meal.label}
                    {mealCalories > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({mealCalories} {t('common.kcal')})
                      </span>
                    )}
                  </CardTitle>
                  <Dialog open={foodDialogOpen && selectedMealType === meal.id} onOpenChange={(open) => {
                    setFoodDialogOpen(open);
                    if (open) setSelectedMealType(meal.id);
                    else resetFoodForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedMealType(meal.id)}>
                        <Plus className="w-4 h-4 mr-1" />
                        {t('tracker.addFood')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('tracker.addFood')} - {meal.label}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Food Name *</Label>
                          <Input
                            value={foodName}
                            onChange={(e) => setFoodName(e.target.value)}
                            placeholder="e.g., Rice, Dal, Roti"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{t('home.calories')} ({t('common.kcal')})</Label>
                            <Input
                              type="number"
                              value={calories}
                              onChange={(e) => setCalories(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              placeholder="1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>{t('home.protein')} ({t('common.g')})</Label>
                            <Input
                              type="number"
                              value={protein}
                              onChange={(e) => setProtein(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('home.carbs')} ({t('common.g')})</Label>
                            <Input
                              type="number"
                              value={carbs}
                              onChange={(e) => setCarbs(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('home.fat')} ({t('common.g')})</Label>
                            <Input
                              type="number"
                              value={fat}
                              onChange={(e) => setFat(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <Button 
                          onClick={addFood} 
                          className="w-full"
                          disabled={!foodName.trim() || addingFood}
                        >
                          {addingFood ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              {t('common.add')}
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No food logged yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group"
                      >
                        <div>
                          <p className="font-medium text-foreground">{log.food_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.calories && `${log.calories} kcal`}
                            {log.protein_g && ` • ${log.protein_g}g protein`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteFood(log.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
