import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Stethoscope, 
  Send, 
  Loader2,
  Sparkles,
  Apple,
  Carrot,
  Egg,
  Fish,
  AlertCircle
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function FoodDoctor() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestions = [
    { icon: Apple, text: 'Best foods for weight loss', textBn: 'ওজন কমানোর জন্য সেরা খাবার' },
    { icon: Egg, text: 'High protein Bengali dishes', textBn: 'উচ্চ প্রোটিন বাঙালি খাবার' },
    { icon: Carrot, text: 'Healthy snack ideas', textBn: 'স্বাস্থ্যকর স্ন্যাক আইডিয়া' },
    { icon: Fish, text: 'Fish recipes for muscle gain', textBn: 'মাংসপেশী বাড়ানোর জন্য মাছের রেসিপি' },
  ];

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // Simulate AI response (in production, this would call an edge function with AI)
    setTimeout(() => {
      const responses = [
        `Based on your question about "${userMessage}", I recommend focusing on a balanced diet with plenty of vegetables, lean proteins, and whole grains. Bengali cuisine offers many healthy options like dal (lentils), fish curry, and mixed vegetable dishes. Would you like specific recipes?`,
        `Great question! For "${userMessage}", consider incorporating more traditional Bengali foods like shukto (mixed vegetables), macher jhol (fish curry), and dal with vegetables. These are nutritious and delicious options that support your health goals.`,
        `Regarding "${userMessage}" - I suggest starting with a balanced approach. Include protein with every meal (fish, eggs, dal), plenty of vegetables, and moderate portions of rice. Bengali cuisine is naturally healthy when prepared with less oil.`,
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setMessages((prev) => [...prev, { role: 'assistant', content: randomResponse }]);
      setLoading(false);
    }, 1500);
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col p-4 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
        {/* Header */}
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

        {/* Chat Area */}
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
              
              {/* Quick Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion.text)}
                    className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
                  >
                    <suggestion.icon className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm text-foreground">{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] p-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-card border border-border rounded-tl-sm'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-card border border-border p-4 rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 mb-4">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">{t('foodDoctor.disclaimer')}</p>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
            placeholder={t('foodDoctor.askQuestion')}
            className="flex-1"
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={!input.trim() || loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
