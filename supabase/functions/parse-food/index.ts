import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedFood {
  food_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meal_type: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, defaultMealType } = await req.json();

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

    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("ai_provider, custom_api_key, custom_api_endpoint")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profile) {
          aiProvider = profile.ai_provider || "lovable_ai";
          customApiKey = profile.custom_api_key;
          customEndpoint = profile.custom_api_endpoint;
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

    console.log(`Parsing food with provider: ${aiProvider}`);

    const systemPrompt = `You are a nutrition data extraction AI specializing in South Asian (especially Indian and Bengali) cuisine. 
Parse the user's food description and extract individual food items with nutritional estimates.

IMPORTANT: Return ONLY valid JSON, no markdown formatting or extra text.

For each food item, estimate realistic nutritional values based on typical serving sizes for Indian/Bengali foods.

Common reference values:
- Roti (1 piece): ~80 cal, 3g protein, 15g carbs, 1g fat
- Rice (1 cup cooked): ~200 cal, 4g protein, 45g carbs, 0.5g fat
- Dal (1 cup): ~150 cal, 9g protein, 25g carbs, 3g fat
- Chicken curry (1 cup): ~280 cal, 25g protein, 10g carbs, 15g fat
- Fish curry (1 cup): ~200 cal, 22g protein, 8g carbs, 10g fat
- Egg (1 whole): ~70 cal, 6g protein, 0.5g carbs, 5g fat
- Paratha (1 piece): ~150 cal, 4g protein, 20g carbs, 7g fat
- Biryani (1 plate): ~400 cal, 15g protein, 55g carbs, 15g fat

Meal type should be one of: "breakfast", "lunch", "dinner", "snack" - infer from context or time mentioned.

Return format (pure JSON array):
[
  {
    "food_name": "string",
    "quantity": number,
    "unit": "serving|piece|cup|plate|bowl|glass",
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "meal_type": "breakfast|lunch|dinner|snack" or null if unclear
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
          { role: "user", content: `Parse this food description: "${description}"${defaultMealType ? ` (Default meal type: ${defaultMealType})` : ""}` },
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

    let parsedFoods: ParsedFood[];
    try {
      parsedFoods = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", cleanedContent);
      throw new Error("Failed to parse food data from AI response");
    }

    // Validate and sanitize the parsed data
    const validatedFoods = parsedFoods.map((food) => ({
      food_name: String(food.food_name || "Unknown food"),
      quantity: Number(food.quantity) || 1,
      unit: String(food.unit || "serving"),
      calories: Math.round(Number(food.calories) || 0),
      protein_g: Math.round(Number(food.protein_g) || 0),
      carbs_g: Math.round(Number(food.carbs_g) || 0),
      fat_g: Math.round(Number(food.fat_g) || 0),
      fiber_g: Math.round(Number(food.fiber_g) || 0),
      meal_type: food.meal_type || defaultMealType || null,
    }));

    return new Response(JSON.stringify({ foods: validatedFoods }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in parse-food function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
