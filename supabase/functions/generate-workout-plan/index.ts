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
    const { fitnessGoal, forceRegenerate } = await req.json();

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid authorization");
    }

    const today = new Date().toISOString().split('T')[0];

    // Check for existing plan today (unless force regenerate)
    if (!forceRegenerate) {
      const { data: existingPlan } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_date', today)
        .maybeSingle();

      if (existingPlan) {
        return new Response(JSON.stringify({ plan: existingPlan }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check for yesterday's incomplete workouts
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdayPlan } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', yesterdayStr)
      .maybeSingle();

    let missedCount = 0;
    let missedWorkouts: string[] = [];
    
    if (yesterdayPlan) {
      const workouts = yesterdayPlan.workouts as Array<{ name: string; checked: boolean }>;
      missedWorkouts = workouts.filter(w => !w.checked).map(w => w.name);
      missedCount = missedWorkouts.length;
    }

    // Use OpenAI API key from secrets, fallback to Lovable AI
    const openaiKey = Deno.env.get("OPEN_AI_API_KEY");
    let apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let apiKey = Deno.env.get("LOVABLE_API_KEY");
    let model = "google/gemini-3-flash-preview";

    if (openaiKey) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = openaiKey;
      model = "gpt-4o-mini";
    }

    if (!apiKey) {
      throw new Error("AI API key is not configured");
    }

    console.log(`Generating workout plan with provider: ${openaiKey ? 'OpenAI' : 'Lovable AI'}`);

    const systemPrompt = `You are a Bangladeshi fitness coach. Generate workout plans suitable for Bangladesh climate and lifestyle.

Generate a daily workout checklist with 4-5 simple exercises. Return BOTH English AND Bangla versions.

User's fitness goal: ${fitnessGoal || 'general health'}
${missedCount > 0 ? `User missed ${missedCount} workouts yesterday: ${missedWorkouts.join(', ')}. Consider including some of these.` : ''}

IMPORTANT: Return ONLY valid JSON, no markdown formatting.

Return format:
{
  "workouts": [
    { "name": "Exercise name", "name_bn": "বাংলা নাম", "duration": 10, "type": "cardio|strength|flexibility|sports" }
  ],
  "suggestion_en": "One line daily motivation in English",
  "suggestion_bn": "এক লাইন দৈনিক অনুপ্রেরণা বাংলায়"
}

Keep exercises simple and doable at home. Include a mix of cardio, strength, and flexibility.`;

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
          { role: "user", content: "Generate today's workout plan." },
        ],
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("AI response:", content);

    // Parse the JSON response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", cleanedContent);
      throw new Error("Failed to parse workout plan from AI");
    }

    // Format workouts with checked status
    const workouts = (parsed.workouts || []).map((w: any) => ({
      name: w.name,
      name_bn: w.name_bn || w.name,
      duration: w.duration || 10,
      type: w.type || 'other',
      checked: false,
      completed_at: null,
    }));

    // Delete existing plan for today if force regenerating
    if (forceRegenerate) {
      await supabase
        .from('workout_plans')
        .delete()
        .eq('user_id', user.id)
        .eq('plan_date', today);
    }

    // Save the new plan
    const { data: newPlan, error: insertError } = await supabase
      .from('workout_plans')
      .insert({
        user_id: user.id,
        plan_date: today,
        workouts: workouts,
        generated_en: parsed.suggestion_en || "Stay consistent with your workouts!",
        generated_bn: parsed.suggestion_bn || "আপনার ব্যায়ামে সামঞ্জস্য বজায় রাখুন!",
        missed_count: missedCount,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving plan:", insertError);
      throw new Error("Failed to save workout plan");
    }

    return new Response(JSON.stringify({ 
      plan: newPlan,
      missedWorkouts: missedWorkouts.length > 0 ? missedWorkouts : null 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-workout-plan function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
