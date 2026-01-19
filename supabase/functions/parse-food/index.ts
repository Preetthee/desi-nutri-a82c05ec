import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

function validateImageUrl(url: string): { ok: true } | { ok: false; error: string } {
  if (!url || typeof url !== "string") {
    return { ok: false, error: "Invalid image payload." };
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { ok: true };
  }

  const m = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (!m) {
    return { ok: false, error: "Unsupported image format. Please upload JPG/PNG/WEBP/GIF." };
  }

  const mime = m[1];
  if (!SUPPORTED_IMAGE_MIME.includes(mime as any)) {
    return { ok: false, error: "Unsupported image type. Please upload JPG/PNG/WEBP/GIF (not HEIC/SVG)." };
  }

  return { ok: true };
}

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
    const { description, defaultMealType, image } = await req.json();

    if (!description && !image) {
      return new Response(JSON.stringify({ error: "Description or image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (image) {
      const v = validateImageUrl(String(image));
      if (!v.ok) {
        return new Response(JSON.stringify({ error: v.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Use Lovable AI exclusively
    const apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const model = image ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview";

    if (!apiKey) {
      throw new Error("AI API key is not configured");
    }

    console.log(`Parse food using Lovable AI, model: ${model}, hasImage: ${!!image}`);

    const systemPrompt = `You are a nutrition data extraction AI specializing in Bangladeshi cuisine. 
Parse the user's food description (or analyze the food image) and extract individual food items with nutritional estimates.

IMPORTANT: Return ONLY valid JSON, no markdown formatting or extra text.

For each food item, estimate realistic nutritional values based on typical serving sizes for Bangladeshi foods.

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

    // Build the user message content
    let userContent: any;
    if (image) {
      userContent = [
        {
          type: "text",
          text: `${
            description
              ? `Parse this food description: "${description}"`
              : "Analyze this food image and identify the foods shown."
          }${defaultMealType ? ` (Default meal type: ${defaultMealType})` : ""}`,
        },
        { type: "image_url", image_url: { url: image } },
      ];
    } else {
      userContent = `Parse this food description: "${description}"${
        defaultMealType ? ` (Default meal type: ${defaultMealType})` : ""
      }`;
    }

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
          { role: "user", content: userContent },
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
      console.error("AI provider error:", response.status, errorText);

      let friendly = "Failed to parse food.";
      try {
        const parsed = JSON.parse(errorText);
        const code = parsed?.error?.code;
        if (code === "image_parse_error") {
          friendly = "Unsupported image. Please upload JPG/PNG/WEBP/GIF (under 4MB).";
        } else if (parsed?.error?.message) {
          friendly = parsed.error.message;
        }
      } catch {
        // ignore
      }

      return new Response(JSON.stringify({ error: friendly }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response - handle markdown code blocks
    let cleanedContent = String(content).trim();
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
      food_name: String((food as any).food_name || "Unknown food"),
      quantity: Number((food as any).quantity) || 1,
      unit: String((food as any).unit || "serving"),
      calories: Math.round(Number((food as any).calories) || 0),
      protein_g: Math.round(Number((food as any).protein_g) || 0),
      carbs_g: Math.round(Number((food as any).carbs_g) || 0),
      fat_g: Math.round(Number((food as any).fat_g) || 0),
      fiber_g: Math.round(Number((food as any).fiber_g) || 0),
      meal_type: (food as any).meal_type || defaultMealType || null,
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
