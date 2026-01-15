import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext } = await req.json();
    
    // Get user's AI provider settings if authorization is provided
    const authHeader = req.headers.get("authorization");
    let aiProvider = "lovable_ai";
    let customApiKey = null;
    let customEndpoint = null;
    
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        // Get profile for provider selection and endpoint
        const { data: profile } = await supabase
          .from("profiles")
          .select("ai_provider, custom_api_endpoint, dietary_restrictions, allergies, fitness_goal, health_conditions")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profile) {
          aiProvider = profile.ai_provider || "lovable_ai";
          customEndpoint = profile.custom_api_endpoint;
          
          // Get API key from vault using secure function (for openai or custom providers)
          if (aiProvider === "openai" || aiProvider === "custom") {
            const { data: vaultKey, error: vaultError } = await supabase
              .rpc("get_user_api_key", { 
                p_user_id: user.id, 
                p_provider: aiProvider 
              });
            
            if (vaultError) {
              console.error("Error retrieving API key from vault:", vaultError);
            } else {
              customApiKey = vaultKey;
            }
          }
        }
      }
    }

    // Build system prompt with user context - Bangladesh focused
    const systemPrompt = `You are Desi Nutri AI, a friendly and knowledgeable nutrition and fitness assistant specializing in Bangladeshi cuisine and lifestyle.

Your personality:
- Warm, encouraging, and supportive
- Knowledgeable about traditional Bangladeshi foods and their nutritional values
- Practical and realistic with advice
- Culturally aware and respectful of Bangladeshi traditions

${userContext ? `User Context:
- Dietary Restrictions: ${userContext.dietaryRestrictions?.join(", ") || "None specified"}
- Allergies: ${userContext.allergies?.join(", ") || "None specified"}
- Fitness Goal: ${userContext.fitnessGoal || "General health"}
- Health Conditions: ${userContext.healthConditions?.join(", ") || "None specified"}` : ""}

Guidelines:
- Give personalized advice based on user's profile when available
- Suggest Bangladeshi-friendly foods and alternatives (ভাত, মাছ, ডাল, সব্জি, etc.)
- Include nutritional estimates when discussing foods
- Be concise but helpful
- When suggesting meals, mention approximate calories and macros
- Reference local markets and affordable options in BDT when relevant
- Consider Bangladesh climate for exercise recommendations`;

    // Check for OpenAI API key in secrets first (priority)
    const openaiKey = Deno.env.get("OPEN_AI_API_KEY");
    
    let apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let apiKey = Deno.env.get("LOVABLE_API_KEY");
    let model = "google/gemini-3-flash-preview";

    // Priority: OpenAI secret key > User's custom key > Lovable AI
    if (openaiKey) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = openaiKey;
      model = "gpt-4o-mini";
    } else if (aiProvider === "openai" && customApiKey) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = customApiKey;
      model = "gpt-4o-mini";
    } else if (aiProvider === "custom" && customApiKey && customEndpoint) {
      apiUrl = customEndpoint;
      apiKey = customApiKey;
      model = "gpt-4o-mini";
    }

    if (!apiKey) {
      throw new Error("AI API key is not configured");
    }

    console.log(`Using AI provider: ${openaiKey ? 'OpenAI (secret)' : aiProvider}, model: ${model}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error in ai-chat function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
