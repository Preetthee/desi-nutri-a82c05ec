import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  MessageSquare, 
  Send, 
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Menu,
  X,
  Bot
} from 'lucide-react';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export default function AIAssistant() {
  const { t } = useLanguage();
  const { session, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchConversations();
      supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setProfile(data));
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchConversations() {
    if (!user) return;
    
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (data) setConversations(data);
    setLoadingConversations(false);
  }

  async function loadConversation(conversationId: string) {
    setCurrentConversationId(conversationId);
    setSidebarOpen(false);
    
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })));
    }
  }

  async function createNewConversation() {
    if (!user) return null;

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: user.id, title: 'New Conversation' })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create conversation');
      return null;
    }

    setConversations([data, ...conversations]);
    setCurrentConversationId(data.id);
    setMessages([]);
    setSidebarOpen(false);
    return data.id;
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete conversation');
    } else {
      setConversations(conversations.filter(c => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    }
  }

  async function saveMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
    await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role, content });
  }

  async function updateConversationTitle(conversationId: string, firstMessage: string) {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    await supabase
      .from('chat_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, title, updated_at: new Date().toISOString() } : c
    ));
  }

  const handleSend = async () => {
    if (!input.trim() || !session) return;

    const userMessage = input.trim();
    setInput('');
    
    // Ensure we have a conversation
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation();
      if (!conversationId) return;
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    // Save user message
    await saveMessage(conversationId, 'user', userMessage);

    // Update title if first message
    if (messages.length === 0) {
      await updateConversationTitle(conversationId, userMessage);
    }

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

      // Save assistant message
      if (assistantContent) {
        await saveMessage(conversationId, 'assistant', assistantContent);
        // Update conversation's updated_at
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
    } catch (error) {
      console.error('Chat error:', error);
      if (!assistantContent) {
        const errorMsg = "Sorry, I couldn't process that. Please try again.";
        setMessages([...newMessages, { role: 'assistant', content: errorMsg }]);
        await saveMessage(conversationId, 'assistant', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)] lg:h-screen flex">
        {/* Sidebar - Conversation History */}
        <div className={`
          fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-card border-r border-border
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:block
        `}>
          <div className="flex flex-col h-full pt-16 lg:pt-0">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display font-semibold">Chat History</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={startNewChat}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Conversation List */}
            <ScrollArea className="flex-1 p-2">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-xs mt-1">Start chatting to create one!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`
                        w-full text-left p-3 rounded-lg transition-colors group
                        ${currentConversationId === conv.id 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-muted text-foreground'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{conv.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(conv.updated_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0"
                          onClick={(e) => deleteConversation(conv.id, e)}
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-background/80 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col p-4 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 animate-fade-in">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="p-2 rounded-full bg-primary/10">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
                AI Assistant
              </h1>
              <p className="text-muted-foreground text-sm">
                Your personal nutrition & fitness advisor
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center animate-fade-in">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  Start a conversation
                </h2>
                <p className="text-muted-foreground text-center max-w-md">
                  Ask me anything about nutrition, diet plans, exercise routines, or healthy recipes!
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    m.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-card border border-border rounded-tl-sm'
                  }`}>
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

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 mb-4 shrink-0">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              This is AI-generated advice. Consult a healthcare professional for medical decisions.
            </p>
          </div>

          {/* Input */}
          <div className="flex gap-2 shrink-0">
            <Input 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
              placeholder="Ask about nutrition, diet, or fitness..." 
              className="flex-1" 
              disabled={loading} 
            />
            <Button onClick={handleSend} disabled={!input.trim() || loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
