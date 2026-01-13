import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Stethoscope, 
  Send, 
  Loader2,
  Sparkles,
  Apple,
  Carrot,
  Egg,
  Fish,
  AlertCircle,
  Plus
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function FoodDoctor() {
  const { t } = useLanguage();
  const { session, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    { icon: Apple, text: 'Best foods for weight loss' },
    { icon: Egg, text: 'High protein Bengali dishes' },
    { icon: Carrot, text: 'Healthy snack ideas' },
    { icon: Fish, text: 'Fish recipes for muscle gain' },
  ];

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setProfile(data));
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !session) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    let assistantContent = '';

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            userContext: profile ? {
              dietaryRestrictions: profile.dietary_restrictions,
              allergies: profile.allergies,
              fitnessGoal: profile.fitness_goal,
              healthConditions: profile.health_conditions,
            } : null,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 402) {
          toast.error('AI credits exhausted. Please add credits.');
        }
        throw new Error('AI request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  assistantContent += content;
                  setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      if (!assistantContent) {
        setMessages([...newMessages, { role: 'assistant', content: "Sorry, I couldn't process that. Please try again." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col p-4 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
        <div className="animate-fade-in mb-6">
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

        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center animate-fade-in">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                Ask me anything about nutrition!
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Get personalized advice about Bengali foods, diet plans, healthy recipes, and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setInput(s.text)}
                    className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all text-left">
                    <s.icon className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm text-foreground">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[85%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))
          )}
          {loading && !messages.find(m => m.role === 'assistant' && messages.indexOf(m) === messages.length - 1) && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-card border border-border p-4 rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 mb-4">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">{t('foodDoctor.disclaimer')}</p>
        </div>

        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
            placeholder={t('foodDoctor.askQuestion')} className="flex-1" disabled={loading} />
          <Button onClick={handleSend} disabled={!input.trim() || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
