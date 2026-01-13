import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedExercise {
  exercise_name: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  intensity: string;
  notes: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, userWeight } = await req.json();

    if (!description || typeof description !== "string") {
      return new Response(JSON.stringify({ error: "Description is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's AI provider settings
    const authHeader = req.headers.get("authorization");
    let aiProvider = "lovable_ai";
    let customApiKey = null;
    let customEndpoint = null;
    let weightKg = userWeight || 70;

    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("ai_provider, custom_api_key, custom_api_endpoint, weight_kg")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profile) {
          aiProvider = profile.ai_provider || "lovable_ai";
          customApiKey = profile.custom_api_key;
          customEndpoint = profile.custom_api_endpoint;
          if (profile.weight_kg) weightKg = profile.weight_kg;
        }
      }
    }

    let apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let apiKey = Deno.env.get("LOVABLE_API_KEY");
    let model = "google/gemini-3-flash-preview";

    if (aiProvider === "openai" && customApiKey) {
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

    console.log(`Parsing exercise with provider: ${aiProvider}, user weight: ${weightKg}kg`);

    const systemPrompt = `You are a fitness data extraction AI. Parse the user's exercise description and extract individual exercises with estimates.

IMPORTANT: Return ONLY valid JSON, no markdown formatting or extra text.

User's weight: ${weightKg} kg (use this for calorie calculations)

For each exercise, estimate:
- Duration in minutes (if not specified, make reasonable estimate)
- Calories burned based on MET values and user weight
- Intensity: "low", "medium", or "high"
- Exercise type: "cardio", "strength", "flexibility", "sports", or "other"

Common MET values (calories = MET × weight_kg × duration_hours):
- Walking (moderate): 3.5 MET
- Running (6 mph): 10 MET
- Cycling (moderate): 8 MET
- Swimming: 7 MET
- Yoga: 3 MET
- Weight training: 6 MET
- HIIT: 12 MET
- Dancing: 5 MET
- Skipping/Jump rope: 11 MET
- Cricket: 5 MET
- Badminton: 5.5 MET
- Push-ups: 8 MET
- Squats: 5 MET
- Planks: 4 MET

Return format (pure JSON array):
[
  {
    "exercise_name": "string",
    "exercise_type": "cardio|strength|flexibility|sports|other",
    "duration_minutes": number,
    "calories_burned": number,
    "intensity": "low|medium|high",
    "notes": "any additional context or null"
  }
]`;

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
          { role: "user", content: `Parse this exercise description: "${description}"` },
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

    // Parse the JSON response - handle markdown code blocks
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

    let parsedExercises: ParsedExercise[];
    try {
      parsedExercises = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", cleanedContent);
      throw new Error("Failed to parse exercise data from AI response");
    }

    // Validate and sanitize the parsed data
    const validatedExercises = parsedExercises.map((exercise) => ({
      exercise_name: String(exercise.exercise_name || "Unknown exercise"),
      exercise_type: String(exercise.exercise_type || "other"),
      duration_minutes: Math.round(Number(exercise.duration_minutes) || 30),
      calories_burned: Math.round(Number(exercise.calories_burned) || 100),
      intensity: String(exercise.intensity || "medium"),
      notes: exercise.notes || null,
    }));

    return new Response(JSON.stringify({ exercises: validatedExercises }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in parse-exercise function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
