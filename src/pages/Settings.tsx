import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Settings as SettingsIcon, 
  Globe, 
  User, 
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Loader2,
  Camera,
  Trash2
} from 'lucide-react';

interface Profile {
  full_name: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  fitness_goal: string | null;
  health_conditions: string[] | null;
  dietary_restrictions: string[] | null;
  allergies: string[] | null;
  disliked_foods: string[] | null;
  avatar_url: string | null;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // Editable profile fields
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [gender, setGender] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');

  useEffect(() => {
    fetchProfile();
  }, [user]);

  async function fetchProfile() {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setProfile(data);
      setFullName(data.full_name || '');
      setAge(data.age?.toString() || '');
      setHeightCm(data.height_cm?.toString() || '');
      setWeightKg(data.weight_kg?.toString() || '');
      setGender(data.gender || '');
      setFitnessGoal(data.fitness_goal || '');
    }
    setLoading(false);
  }

  async function saveProfile() {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        age: age ? parseInt(age) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        gender: gender || null,
        fitness_goal: fitnessGoal || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('profile.saved'));
      setProfileDialogOpen(false);
      fetchProfile();
    }
    setSaving(false);
  }

  const handleLogout = async () => {
    await signOut();
    toast.success(t('auth.logoutSuccess'));
    navigate('/auth');
  };

  const settingsGroups = [
    {
      title: 'Account',
      items: [
        {
          icon: User,
          label: t('settings.editProfile'),
          action: () => setProfileDialogOpen(true),
          type: 'dialog',
        },
        {
          icon: Globe,
          label: t('settings.language'),
          value: language === 'en' ? 'English' : 'বাংলা',
          type: 'language',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: Bell,
          label: t('settings.notifications'),
          type: 'switch',
          defaultValue: true,
        },
      ],
    },
    {
      title: 'More',
      items: [
        {
          icon: HelpCircle,
          label: t('settings.help'),
          type: 'link',
        },
        {
          icon: Shield,
          label: t('settings.privacy'),
          type: 'link',
        },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 pb-24 lg:pb-8 space-y-6 max-w-2xl mx-auto">
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
            {t('settings.title')}
          </h1>
        </div>

        {/* Profile Card */}
        <Card className="border-0 shadow-lg animate-slide-up">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {profile?.full_name || 'User'}
                </h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                {profile?.fitness_goal && (
                  <p className="text-xs text-primary mt-1">
                    Goal: {profile.fitness_goal.replace('_', ' ')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Groups */}
        {settingsGroups.map((group, groupIndex) => (
          <div key={group.title} className="animate-slide-up" style={{ animationDelay: `${(groupIndex + 1) * 100}ms` }}>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">{group.title}</h3>
            <Card className="border-0 shadow-md">
              <CardContent className="p-0">
                {group.items.map((item, itemIndex) => (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between p-4 ${
                      itemIndex !== group.items.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{item.label}</span>
                    </div>
                    
                    {item.type === 'dialog' && (
                      <Button variant="ghost" size="icon" onClick={item.action}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                    
                    {item.type === 'language' && (
                      <Select value={language} onValueChange={(val) => setLanguage(val as 'en' | 'bn')}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="bn">বাংলা</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    
                    {item.type === 'switch' && (
                      <Switch defaultChecked={item.defaultValue} />
                    )}
                    
                    {item.type === 'link' && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Logout Button */}
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full justify-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 animate-slide-up"
          style={{ animationDelay: '400ms' }}
        >
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </Button>

        {/* Edit Profile Dialog */}
        <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('settings.editProfile')}</DialogTitle>
              <DialogDescription>
                Update your profile information below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{t('auth.fullName')}</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('profile.age')} ({t('common.years')})</Label>
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

              <div className="space-y-2">
                <Label>{t('profile.fitnessGoal')}</Label>
                <Select value={fitnessGoal} onValueChange={setFitnessGoal}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your goal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight_loss">{t('profile.weightLoss')}</SelectItem>
                    <SelectItem value="weight_gain">{t('profile.weightGain')}</SelectItem>
                    <SelectItem value="maintenance">{t('profile.maintenance')}</SelectItem>
                    <SelectItem value="muscle_gain">{t('profile.muscleGain')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={saveProfile} className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  t('profile.saveChanges')
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
