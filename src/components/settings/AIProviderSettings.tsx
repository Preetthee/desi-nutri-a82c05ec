import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Key, 
  Globe, 
  Loader2, 
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck
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
  const [provider, setProvider] = useState(currentProvider || 'lovable_ai');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState(initialEndpoint || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // Check if user has an existing key stored in vault
  useState(() => {
    if (user && (currentProvider === 'openai' || currentProvider === 'custom')) {
      // We can't read the key, but we can check if one exists by checking user_api_keys
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
  });

  const providers = [
    {
      id: 'lovable_ai',
      name: 'Lovable AI (Default)',
      description: 'Free tier included, no API key required',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'Use your own OpenAI API key',
    },
    {
      id: 'custom',
      name: 'Custom API',
      description: 'Use any OpenAI-compatible endpoint',
    },
  ];

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (provider === 'openai' && !apiKey.trim() && !hasExistingKey) {
      toast.error('Please enter your OpenAI API key');
      return;
    }

    if (provider === 'custom' && !endpoint.trim()) {
      toast.error('Please enter the API endpoint for custom provider');
      return;
    }

    if (provider === 'custom' && !apiKey.trim() && !hasExistingKey) {
      toast.error('Please enter an API key for custom provider');
      return;
    }

    setSaving(true);

    try {
      // Store API key in vault if provided
      if (apiKey.trim() && provider !== 'lovable_ai') {
        const { error: vaultError } = await supabase.rpc('store_user_api_key', {
          p_provider: provider,
          p_api_key: apiKey.trim()
        });

        if (vaultError) {
          console.error('Vault storage error:', vaultError);
          throw new Error('Failed to securely store API key');
        }
        
        setHasExistingKey(true);
        setApiKey(''); // Clear the input after successful storage
      }

      // If switching to lovable_ai, delete any existing vault keys
      if (provider === 'lovable_ai') {
        // Delete openai key if exists
        await supabase.rpc('delete_user_api_key', { p_provider: 'openai' });
        // Delete custom key if exists
        await supabase.rpc('delete_user_api_key', { p_provider: 'custom' });
      }

      // Update profile with provider selection and endpoint (not the key)
      const { error } = await supabase
        .from('profiles')
        .update({
          ai_provider: provider,
          custom_api_endpoint: provider === 'custom' ? endpoint : null,
          // Clear the deprecated columns
          custom_api_key: null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('AI provider settings saved securely');
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
        toast.success('Connection successful!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Connection failed');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    // Reset the existing key flag when changing providers
    if (newProvider !== currentProvider) {
      setHasExistingKey(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label>AI Provider</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex flex-col">
                    <span>{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {providers.find((p) => p.id === provider)?.description}
          </p>
        </div>

        {/* API Key Input (for OpenAI and Custom) */}
        {provider !== 'lovable_ai' && (
          <div className="space-y-2 animate-fade-in">
            <Label className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Key
              {hasExistingKey && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Securely stored
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
                Leave blank to keep your existing key, or enter a new one to replace it.
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
              Must be OpenAI-compatible (same request/response format)
            </p>
          </div>
        )}

        {/* Security Note */}
        {provider !== 'lovable_ai' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Your API key is encrypted and stored securely using Supabase Vault. 
              It's never stored in plaintext and can only be accessed by our secure backend functions.
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
                Testing...
              </>
            ) : (
              'Test Connection'
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
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
