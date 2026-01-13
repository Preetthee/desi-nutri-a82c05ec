import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Leaf, ChevronRight, ChevronLeft, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Onboarding() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [healthConditions, setHealthConditions] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [allergies, setAllergies] = useState('');

  const totalSteps = 3;

  const fitnessGoals = [
    { id: 'weight_loss', label: t('profile.weightLoss'), emoji: '🏃' },
    { id: 'weight_gain', label: t('profile.weightGain'), emoji: '💪' },
    { id: 'maintenance', label: t('profile.maintenance'), emoji: '⚖️' },
    { id: 'muscle_gain', label: t('profile.muscleGain'), emoji: '🏋️' },
  ];

  async function completeOnboarding() {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        fitness_goal: fitnessGoal || null,
        health_conditions: healthConditions ? healthConditions.split(',').map(s => s.trim()) : null,
        dietary_restrictions: dietaryRestrictions ? dietaryRestrictions.split(',').map(s => s.trim()) : null,
        allergies: allergies ? allergies.split(',').map(s => s.trim()) : null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success('Profile setup complete!');
      navigate('/');
    }
    setSaving(false);
  }

  const canProceed = () => {
    if (step === 1) return fullName.trim().length > 0;
    if (step === 2) return true; // Optional fields
    if (step === 3) return true; // Optional fields
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-green-light via-background to-terracotta-light p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
            <Leaf className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Welcome to Desi Nutri
          </h1>
          <p className="text-muted-foreground mt-1">Let's set up your profile</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "w-16 h-1.5 rounded-full transition-colors",
                s <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <Card className="border-0 shadow-xl bg-card/90 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl">
              {step === 1 && 'Basic Information'}
              {step === 2 && 'Your Goals'}
              {step === 3 && 'Health Details'}
            </CardTitle>
            <CardDescription>
              {step === 1 && 'Tell us a bit about yourself'}
              {step === 2 && 'What are you hoping to achieve?'}
              {step === 3 && 'Help us personalize your experience'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>{t('auth.fullName')} *</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('profile.age')}</Label>
                    <Input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('profile.gender')}</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t('profile.male')}</SelectItem>
                        <SelectItem value="female">{t('profile.female')}</SelectItem>
                        <SelectItem value="other">{t('profile.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('profile.height')} ({t('common.cm')})</Label>
                    <Input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="170"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('profile.weight')} ({t('common.kg')})</Label>
                    <Input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="65"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Label className="text-base">{t('profile.fitnessGoal')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {fitnessGoals.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => setFitnessGoal(goal.id)}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left transition-all",
                        fitnessGoal === goal.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="text-2xl">{goal.emoji}</span>
                      <p className="font-medium text-foreground mt-2">{goal.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>{t('profile.healthConditions')}</Label>
                  <Input
                    value={healthConditions}
                    onChange={(e) => setHealthConditions(e.target.value)}
                    placeholder="e.g., Diabetes, Thyroid (comma separated)"
                  />
                  <p className="text-xs text-muted-foreground">Optional - helps us provide better recommendations</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('profile.dietaryRestrictions')}</Label>
                  <Input
                    value={dietaryRestrictions}
                    onChange={(e) => setDietaryRestrictions(e.target.value)}
                    placeholder="e.g., Vegetarian, Vegan (comma separated)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('profile.allergies')}</Label>
                  <Input
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g., Nuts, Dairy (comma separated)"
                  />
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              
              {step < totalSteps ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={completeOnboarding}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Complete Setup
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Skip option */}
            {step > 1 && (
              <button
                onClick={completeOnboarding}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Skip for now
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
