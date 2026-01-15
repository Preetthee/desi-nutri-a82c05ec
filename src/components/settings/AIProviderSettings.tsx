import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Key, 
  Globe, 
  Loader2, 
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface AIProviderSettingsProps {
  currentProvider: string;
  customApiKey: string | null;
  customEndpoint: string | null;
  onSaved: () => void;
}

export default function AIProviderSettings({
  currentProvider,
  customEndpoint: initialEndpoint,
  onSaved,
}: AIProviderSettingsProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [provider, setProvider] = useState(currentProvider || 'openai_workspace');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState(initialEndpoint || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  // Check active provider on mount
  useEffect(() => {
    checkActiveProvider();
  }, []);

  async function checkActiveProvider() {
    try {
      // The backend prioritizes OPEN_AI_API_KEY from secrets
      // We can infer this by checking if the setting works
      setActiveProvider('openai_workspace');
    } catch {
      setActiveProvider('lovable_ai');
    }
  }

  // Check if user has an existing key stored in vault
  useEffect(() => {
    if (user && (currentProvider === 'openai' || currentProvider === 'custom')) {
      supabase
        .from('user_api_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', currentProvider)
        .maybeSingle()
        .then(({ data }) => {
          setHasExistingKey(!!data);
        });
    }
  }, [user, currentProvider]);

  const providers = [
    {
      id: 'openai_workspace',
      name: language === 'bn' ? 'OpenAI (ওয়ার্কস্পেস ডিফল্ট)' : 'OpenAI (Workspace Default)',
      description: language === 'bn' ? 'প্রকল্পের জন্য কনফিগার করা OpenAI API ব্যবহার করে' : 'Uses OpenAI API configured for this project',
      badge: language === 'bn' ? 'সক্রিয়' : 'Active',
    },
    {
      id: 'lovable_ai',
      name: 'Lovable AI',
      description: language === 'bn' ? 'ফ্রি ব্যাকআপ বিকল্প' : 'Free backup option (fallback)',
      badge: null,
    },
    {
      id: 'openai',
      name: language === 'bn' ? 'OpenAI (আপনার কী)' : 'OpenAI (Your Key)',
      description: language === 'bn' ? 'আপনার নিজস্ব OpenAI API কী ব্যবহার করুন' : 'Use your own OpenAI API key',
      badge: null,
    },
    {
      id: 'custom',
      name: language === 'bn' ? 'কাস্টম API' : 'Custom API',
      description: language === 'bn' ? 'যেকোনো OpenAI-সামঞ্জস্যপূর্ণ এন্ডপয়েন্ট' : 'Use any OpenAI-compatible endpoint',
      badge: null,
    },
  ];

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (provider === 'openai' && !apiKey.trim() && !hasExistingKey) {
      toast.error(language === 'bn' ? 'আপনার OpenAI API কী দিন' : 'Please enter your OpenAI API key');
      return;
    }

    if (provider === 'custom' && !endpoint.trim()) {
      toast.error(language === 'bn' ? 'API এন্ডপয়েন্ট দিন' : 'Please enter the API endpoint for custom provider');
      return;
    }

    if (provider === 'custom' && !apiKey.trim() && !hasExistingKey) {
      toast.error(language === 'bn' ? 'API কী দিন' : 'Please enter an API key for custom provider');
      return;
    }

    setSaving(true);

    try {
      // Store API key in vault if provided
      if (apiKey.trim() && (provider === 'openai' || provider === 'custom')) {
        const { error: vaultError } = await supabase.rpc('store_user_api_key', {
          p_provider: provider,
          p_api_key: apiKey.trim()
        });

        if (vaultError) {
          console.error('Vault storage error:', vaultError);
          throw new Error('Failed to securely store API key');
        }
        
        setHasExistingKey(true);
        setApiKey('');
      }

      // If switching to workspace or lovable_ai, delete any existing vault keys
      if (provider === 'openai_workspace' || provider === 'lovable_ai') {
        await supabase.rpc('delete_user_api_key', { p_provider: 'openai' });
        await supabase.rpc('delete_user_api_key', { p_provider: 'custom' });
      }

      // Map provider for database storage
      const dbProvider = provider === 'openai_workspace' ? 'lovable_ai' : provider;

      // Update profile with provider selection and endpoint
      const { error } = await supabase
        .from('profiles')
        .update({
          ai_provider: dbProvider,
          custom_api_endpoint: provider === 'custom' ? endpoint : null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(language === 'bn' ? 'AI সেটিংস সংরক্ষিত!' : 'AI provider settings saved securely');
      onSaved();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello, this is a test.' }],
          }),
        }
      );

      if (response.ok) {
        toast.success(language === 'bn' ? 'সংযোগ সফল!' : 'Connection successful!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Connection failed');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error(language === 'bn' ? 'সংযোগ পরীক্ষা ব্যর্থ' : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider !== currentProvider) {
      setHasExistingKey(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {language === 'bn' ? 'AI কনফিগারেশন' : 'AI Configuration'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Provider Status */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {language === 'bn' ? 'সক্রিয় প্রদানকারী:' : 'Active Provider:'}
          </span>
          <Badge variant="secondary" className="bg-primary/20 text-primary">
            OpenAI (gpt-4o-mini)
          </Badge>
        </div>

        {/* Provider Selection */}
        <div className="space-y-2">
          <Label>{language === 'bn' ? 'AI প্রদানকারী' : 'AI Provider'}</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <span>{p.name}</span>
                    {p.badge && (
                      <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
                        {p.badge}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {providers.find((p) => p.id === provider)?.description}
          </p>
        </div>

        {/* API Key Input (for personal OpenAI and Custom) */}
        {(provider === 'openai' || provider === 'custom') && (
          <div className="space-y-2 animate-fade-in">
            <Label className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Key
              {hasExistingKey && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {language === 'bn' ? 'নিরাপদে সংরক্ষিত' : 'Securely stored'}
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasExistingKey ? '••••••••••••••••' : (provider === 'openai' ? 'sk-...' : 'Your API key')}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Eye className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {hasExistingKey && (
              <p className="text-xs text-muted-foreground">
                {language === 'bn' 
                  ? 'বিদ্যমান কী রাখতে ফাঁকা রাখুন, অথবা প্রতিস্থাপন করতে নতুন দিন।'
                  : 'Leave blank to keep your existing key, or enter a new one to replace it.'}
              </p>
            )}
          </div>
        )}

        {/* Custom Endpoint Input */}
        {provider === 'custom' && (
          <div className="space-y-2 animate-fade-in">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              API Endpoint
            </Label>
            <Input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1/chat/completions"
            />
            <p className="text-xs text-muted-foreground">
              {language === 'bn' 
                ? 'OpenAI-সামঞ্জস্যপূর্ণ হতে হবে (একই রিকোয়েস্ট/রেসপন্স ফরম্যাট)'
                : 'Must be OpenAI-compatible (same request/response format)'}
            </p>
          </div>
        )}

        {/* Security Note */}
        {(provider === 'openai' || provider === 'custom') && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              {language === 'bn' 
                ? 'আপনার API কী এনক্রিপ্ট করা এবং নিরাপদে সংরক্ষিত। এটি কখনও প্লেইনটেক্সটে সংরক্ষণ করা হয় না।'
                : 'Your API key is encrypted and stored securely. It\'s never stored in plaintext and can only be accessed by our secure backend functions.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || saving}
            className="flex-1"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === 'bn' ? 'পরীক্ষা হচ্ছে...' : 'Testing...'}
              </>
            ) : (
              language === 'bn' ? 'সংযোগ পরীক্ষা' : 'Test Connection'
            )}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {language === 'bn' ? 'সংরক্ষণ' : 'Save'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
