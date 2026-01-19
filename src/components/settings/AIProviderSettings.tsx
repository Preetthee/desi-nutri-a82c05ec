import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, Check, ImageIcon, Zap } from 'lucide-react';

interface AIProviderSettingsProps {
  onSaved: () => void;
}

export default function AIProviderSettings({ onSaved }: AIProviderSettingsProps) {
  const { language } = useLanguage();
  const [detecting, setDetecting] = useState(true);
  const [activeModel, setActiveModel] = useState<string>('');
  const [testingText, setTestingText] = useState(false);
  const [testingImage, setTestingImage] = useState(false);

  useEffect(() => {
    detectActiveModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectActiveModel = async () => {
    setDetecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });

      if (!resp.ok || !resp.body) {
        setActiveModel('Unavailable');
        return;
      }

      // Read the first SSE data line to infer the model
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let model: string | undefined;

      while (!model) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed?.model) {
              model = parsed.model as string;
              break;
            }
          } catch {
            // ignore
          }
        }
      }

      try { reader.cancel(); } catch {}

      setActiveModel(model || 'Lovable AI');
    } catch (e) {
      console.error(e);
      setActiveModel('Lovable AI');
    } finally {
      setDetecting(false);
    }
  };

  const testText = async () => {
    setTestingText(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello, this is a test.' }],
        }),
      });

      if (response.ok) {
        toast.success(language === 'bn' ? 'টেক্সট টেস্ট সফল!' : 'Text test successful!');
        onSaved();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || (language === 'bn' ? 'টেস্ট ব্যর্থ' : 'Test failed'));
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error(language === 'bn' ? 'টেস্ট ব্যর্থ' : 'Test failed');
    } finally {
      setTestingText(false);
    }
  };

  const testImage = async () => {
    setTestingImage(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/JPEG_example_flower.jpg';

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe what is in this image in one short sentence.' },
                { type: 'image_url', image_url: { url: testImageUrl } },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        toast.success(language === 'bn' ? 'ইমেজ টেস্ট সফল!' : 'Image test successful!');
        onSaved();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || (language === 'bn' ? 'ইমেজ টেস্ট ব্যর্থ' : 'Image test failed'));
      }
    } catch (error) {
      console.error('Image test error:', error);
      toast.error(language === 'bn' ? 'ইমেজ টেস্ট ব্যর্থ' : 'Image test failed');
    } finally {
      setTestingImage(false);
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
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {language === 'bn' ? 'পাওয়ার্ড বাই:' : 'Powered by:'}
          </span>
          {detecting ? (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {language === 'bn' ? 'চেক হচ্ছে…' : 'Checking…'}
            </span>
          ) : (
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              {activeModel || 'Lovable AI'}
            </Badge>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {language === 'bn'
            ? 'নোট: ইমেজ আপলোড শুধুমাত্র JPG/PNG/WEBP/GIF সমর্থন করে (HEIC/SVG নয়)।'
            : 'Note: Image upload supports only JPG/PNG/WEBP/GIF (not HEIC/SVG).'}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={testText} disabled={testingText || testingImage} className="flex-1">
            {testingText ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === 'bn' ? 'পরীক্ষা…' : 'Testing…'}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {language === 'bn' ? 'টেক্সট টেস্ট' : 'Test text'}
              </>
            )}
          </Button>

          <Button onClick={testImage} disabled={testingText || testingImage} className="flex-1">
            {testingImage ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === 'bn' ? 'পরীক্ষা…' : 'Testing…'}
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4 mr-2" />
                {language === 'bn' ? 'ইমেজ টেস্ট' : 'Test image'}
              </>
            )}
          </Button>
        </div>

        <Button variant="ghost" onClick={detectActiveModel} disabled={detecting} className="w-full text-muted-foreground">
          {language === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
        </Button>
      </CardContent>
    </Card>
  );
}
