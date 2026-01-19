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

function collectMessageImageUrls(messages: any[]): string[] {
  const urls: string[] = [];
  for (const m of messages || []) {
    if (!m) continue;
    const content = m.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === "image_url" && part?.image_url?.url) {
        urls.push(String(part.image_url.url));
      }
    }
  }
  return urls;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext } = await req.json();

    // Validate image inputs early so we return a clear client error
    const imageUrls = collectMessageImageUrls(messages);
    for (const url of imageUrls) {
      const v = validateImageUrl(url);
      if (!v.ok) {
        return new Response(JSON.stringify({ error: v.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build system prompt with user context - Bangladesh focused
    const systemPrompt = `You are Desi Nutri AI, a friendly and knowledgeable nutrition and fitness assistant specializing in Bangladeshi cuisine and lifestyle.

Your personality:
- Warm, encouraging, and supportive
- Knowledgeable about traditional Bangladeshi foods and their nutritional values
- Practical and realistic with advice
- Culturally aware and respectful of Bangladeshi traditions

${
  userContext
    ? `User Context:
- Dietary Restrictions: ${userContext.dietaryRestrictions?.join(", ") || "None specified"}
- Allergies: ${userContext.allergies?.join(", ") || "None specified"}
- Fitness Goal: ${userContext.fitnessGoal || "General health"}
- Health Conditions: ${userContext.healthConditions?.join(", ") || "None specified"}`
    : ""
}

Guidelines:
- Give personalized advice based on user's profile when available
- Suggest Bangladeshi-friendly foods and alternatives (ভাত, মাছ, ডাল, সব্জি, etc.)
- Be concise but helpful
- When suggesting meals, mention approximate calories and macros
- Reference local markets and affordable options in BDT when relevant
- Consider Bangladesh climate for exercise recommendations
- If an image is provided, analyze it and respond based on what you see.`;

    // Use Lovable AI exclusively
    const apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const hasImage = imageUrls.length > 0;
    const model = hasImage ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview";

    if (!apiKey) {
      throw new Error("AI API key is not configured");
    }

    console.log(`AI Chat using Lovable AI, model: ${model}, hasImage: ${hasImage}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...(messages || [])],
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
      console.error("AI provider error:", response.status, errorText);

      let friendly = "AI request failed.";
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
