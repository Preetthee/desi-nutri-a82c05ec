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

    // Get user's weight from profile if auth header is provided
    const authHeader = req.headers.get("authorization");
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
          .select("weight_kg")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profile?.weight_kg) {
          weightKg = profile.weight_kg;
        }
      }
    }

    // Use Lovable AI exclusively
    const apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const model = "google/gemini-3-flash-preview";

    if (!apiKey) {
      throw new Error("AI API key is not configured");
    }

    console.log(`Parse exercise using Lovable AI, model: ${model}, user weight: ${weightKg}kg`);

    const systemPrompt = `You are a fitness data extraction AI for Bangladesh users. Parse the user's exercise description and extract individual exercises with estimates.

IMPORTANT: Return ONLY valid JSON, no markdown formatting or extra text.

User's weight: ${weightKg} kg (use this for calorie calculations)

For each exercise, estimate:
- Duration in minutes (if not specified, make reasonable estimate)
- Calories burned based on MET values and user weight
- Intensity: "low", "medium", or "high"
- Exercise type: "cardio", "strength", "flexibility", "sports", or "other"

Common MET values (calories = MET × weight_kg × duration_hours):
- হাঁটা/Walking (moderate): 3.5 MET
- দৌড়ানো/Running (6 mph): 10 MET
- সাইকেল চালানো/Cycling (moderate): 8 MET
- সাঁতার কাটা/Swimming: 7 MET
- যোগব্যায়াম/Yoga: 3 MET
- ওজন প্রশিক্ষণ/Weight training: 6 MET
- HIIT: 12 MET
- নাচ/Dancing: 5 MET
- দড়ি লাফ/Jump rope: 11 MET
- ক্রিকেট/Cricket: 5 MET
- ব্যাডমিন্টন/Badminton: 5.5 MET
- ফুটবল/Football: 7 MET
- পুশ-আপ/Push-ups: 8 MET
- স্কোয়াট/Squats: 5 MET
- প্ল্যাংক/Planks: 4 MET
- সিঁড়ি ওঠা/Stair climbing: 8 MET

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
