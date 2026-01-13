import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import AIExerciseInput from '@/components/exercise/AIExerciseInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Plus, 
  Dumbbell,
  Timer,
  Flame,
  Trash2,
  Loader2,
  Activity,
  Heart,
  Zap,
  Trophy
} from 'lucide-react';

interface ExerciseLog {
  id: string;
  exercise_name: string;
  exercise_type: string | null;
  duration_minutes: number | null;
  calories_burned: number | null;
  intensity: string | null;
  logged_at: string;
}

export default function Exercise() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseType, setExerciseType] = useState('cardio');
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [intensity, setIntensity] = useState('medium');

  const exerciseTypes = [
    { id: 'cardio', label: t('exercise.cardio'), icon: Heart },
    { id: 'strength', label: t('exercise.strength'), icon: Dumbbell },
    { id: 'flexibility', label: t('exercise.flexibility'), icon: Activity },
    { id: 'sports', label: t('exercise.sports'), icon: Trophy },
  ];

  useEffect(() => {
    fetchLogs();
  }, [user]);

  async function fetchLogs() {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`)
      .order('logged_at', { ascending: false });

    if (data) setLogs(data);
    setLoading(false);
  }

  async function addExercise() {
    if (!user || !exerciseName.trim()) return;

    setAdding(true);
    const { error } = await supabase.from('exercise_logs').insert({
      user_id: user.id,
      exercise_name: exerciseName.trim(),
      exercise_type: exerciseType,
      duration_minutes: duration ? parseInt(duration) : null,
      calories_burned: calories ? parseFloat(calories) : null,
      intensity,
    });

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('common.success'));
      resetForm();
      setDialogOpen(false);
      fetchLogs();
    }
    setAdding(false);
  }

  async function deleteExercise(id: string) {
    const { error } = await supabase.from('exercise_logs').delete().eq('id', id);
    if (error) {
      toast.error(t('common.error'));
    } else {
      setLogs(logs.filter((log) => log.id !== id));
    }
  }

  function resetForm() {
    setExerciseName('');
    setExerciseType('cardio');
    setDuration('');
    setCalories('');
    setIntensity('medium');
  }

  const totalCalories = logs.reduce((sum, log) => sum + (Number(log.calories_burned) || 0), 0);
  const totalDuration = logs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);

  const getIntensityColor = (intensity: string | null) => {
    switch (intensity) {
      case 'low': return 'bg-sage/20 text-sage';
      case 'high': return 'bg-terracotta/20 text-terracotta';
      default: return 'bg-golden/20 text-golden';
    }
  };

  const getTypeIcon = (type: string | null) => {
    const exerciseType = exerciseTypes.find(t => t.id === type);
    return exerciseType?.icon || Dumbbell;
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 pb-24 lg:pb-8 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
              {t('exercise.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('common.today')}</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t('exercise.logWorkout')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('exercise.logWorkout')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Exercise Name *</Label>
                  <Input
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    placeholder="e.g., Morning Run, Yoga, Push-ups"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>{t('exercise.workoutType')}</Label>
                  <Select value={exerciseType} onValueChange={setExerciseType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {exerciseTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('exercise.duration')} ({t('exercise.minutes')})</Label>
                    <Input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('exercise.caloriesBurned')}</Label>
                    <Input
                      type="number"
                      value={calories}
                      onChange={(e) => setCalories(e.target.value)}
                      placeholder="200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('exercise.intensity')}</Label>
                  <Select value={intensity} onValueChange={setIntensity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('exercise.low')}</SelectItem>
                      <SelectItem value="medium">{t('exercise.medium')}</SelectItem>
                      <SelectItem value="high">{t('exercise.high')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={addExercise} 
                  className="w-full"
                  disabled={!exerciseName.trim() || adding}
                >
                  {adding ? (
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

        {/* AI Exercise Input */}
        <AIExerciseInput onExerciseAdded={fetchLogs} />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 animate-slide-up">
          <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">{t('exercise.duration')}</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {totalDuration} <span className="text-sm font-normal text-muted-foreground">{t('exercise.minutes')}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md bg-gradient-to-br from-terracotta/5 to-terracotta/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-terracotta" />
                <span className="text-sm text-muted-foreground">{t('exercise.caloriesBurned')}</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {totalCalories} <span className="text-sm font-normal text-muted-foreground">{t('common.kcal')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exercise Types Quick Add */}
        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Quick Add</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {exerciseTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setExerciseType(type.id);
                    setDialogOpen(true);
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <type.icon className="w-6 h-6 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">{type.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exercise History */}
        <Card className="border-0 shadow-lg animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {t('exercise.history')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <Dumbbell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No workouts logged today</p>
                <p className="text-sm text-muted-foreground/70">Start by adding your first exercise!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const TypeIcon = getTypeIcon(log.exercise_type);
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <TypeIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{log.exercise_name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {log.duration_minutes && (
                              <span>{log.duration_minutes} {t('exercise.minutes')}</span>
                            )}
                            {log.calories_burned && (
                              <span>• {log.calories_burned} {t('common.kcal')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.intensity && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getIntensityColor(log.intensity)}`}>
                            {log.intensity}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteExercise(log.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
