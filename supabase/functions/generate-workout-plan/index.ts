import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated exercise library with natural bilingual names
const EXERCISE_LIBRARY = [
  // Cardio
  { id: 'brisk_walk', name_en: 'Brisk Walking', name_bn: 'দ্রুত হাঁটা', type: 'cardio', duration: 15 },
  { id: 'spot_jogging', name_en: 'Spot Jogging', name_bn: 'এক জায়গায় জগিং', type: 'cardio', duration: 10 },
  { id: 'jumping_jacks', name_en: 'Jumping Jacks', name_bn: 'জাম্পিং জ্যাক', type: 'cardio', duration: 5 },
  { id: 'high_knees', name_en: 'High Knees', name_bn: 'হাই নিজ', type: 'cardio', duration: 5 },
  { id: 'stair_climbing', name_en: 'Stair Climbing', name_bn: 'সিঁড়ি ওঠা-নামা', type: 'cardio', duration: 10 },
  { id: 'dancing', name_en: 'Dancing', name_bn: 'নাচ', type: 'cardio', duration: 15 },
  { id: 'skipping', name_en: 'Skipping/Jump Rope', name_bn: 'দড়ি লাফ', type: 'cardio', duration: 10 },
  
  // Strength
  { id: 'pushups', name_en: 'Push-ups', name_bn: 'পুশ-আপ', type: 'strength', duration: 5 },
  { id: 'squats', name_en: 'Squats', name_bn: 'স্কোয়াট', type: 'strength', duration: 5 },
  { id: 'lunges', name_en: 'Lunges', name_bn: 'লাঞ্জ', type: 'strength', duration: 5 },
  { id: 'plank', name_en: 'Plank Hold', name_bn: 'প্ল্যাঙ্ক', type: 'strength', duration: 3 },
  { id: 'wall_sit', name_en: 'Wall Sit', name_bn: 'ওয়াল সিট', type: 'strength', duration: 3 },
  { id: 'crunches', name_en: 'Crunches', name_bn: 'ক্রাঞ্চ', type: 'strength', duration: 5 },
  { id: 'leg_raises', name_en: 'Leg Raises', name_bn: 'লেগ রেইজ', type: 'strength', duration: 5 },
  { id: 'burpees', name_en: 'Burpees', name_bn: 'বার্পি', type: 'strength', duration: 5 },
  
  // Flexibility
  { id: 'stretching', name_en: 'Full Body Stretching', name_bn: 'স্ট্রেচিং', type: 'flexibility', duration: 10 },
  { id: 'yoga', name_en: 'Yoga Poses', name_bn: 'যোগাসন', type: 'flexibility', duration: 15 },
  { id: 'neck_rolls', name_en: 'Neck Rolls', name_bn: 'ঘাড় ঘোরানো', type: 'flexibility', duration: 3 },
  { id: 'shoulder_stretch', name_en: 'Shoulder Stretch', name_bn: 'কাঁধের স্ট্রেচ', type: 'flexibility', duration: 3 },
  { id: 'toe_touch', name_en: 'Toe Touch', name_bn: 'পায়ের আঙুল স্পর্শ', type: 'flexibility', duration: 3 },
  { id: 'hip_stretch', name_en: 'Hip Stretch', name_bn: 'নিতম্বের স্ট্রেচ', type: 'flexibility', duration: 5 },
  
  // Sports
  { id: 'cricket', name_en: 'Cricket Practice', name_bn: 'ক্রিকেট অনুশীলন', type: 'sports', duration: 30 },
  { id: 'football', name_en: 'Football/Soccer', name_bn: 'ফুটবল', type: 'sports', duration: 30 },
  { id: 'badminton', name_en: 'Badminton', name_bn: 'ব্যাডমিন্টন', type: 'sports', duration: 20 },
  { id: 'cycling', name_en: 'Cycling', name_bn: 'সাইকেল চালানো', type: 'sports', duration: 20 },
  { id: 'swimming', name_en: 'Swimming', name_bn: 'সাঁতার', type: 'sports', duration: 20 },
];

const SUGGESTIONS = {
  en: [
    "Start slow, build momentum. Every rep counts!",
    "Consistency beats intensity. Show up daily!",
    "Hydrate well before and after your workout.",
    "Listen to your body - rest when needed.",
    "Morning exercise boosts energy all day!",
    "A 10-minute workout beats no workout.",
    "Celebrate small wins - you showed up!",
    "Mix cardio and strength for best results.",
  ],
  bn: [
    "ধীরে শুরু করুন, গতি বাড়ান। প্রতিটি প্রচেষ্টা গুরুত্বপূর্ণ!",
    "ধারাবাহিকতা সবচেয়ে জরুরি। প্রতিদিন চেষ্টা করুন!",
    "ব্যায়ামের আগে ও পরে প্রচুর পানি পান করুন।",
    "শরীরের কথা শুনুন - প্রয়োজনে বিশ্রাম নিন।",
    "সকালের ব্যায়াম সারাদিন শক্তি দেয়!",
    "১০ মিনিটের ব্যায়ামও অনেক কার্যকর।",
    "ছোট সাফল্যও উদযাপন করুন - আপনি এসেছেন!",
    "কার্ডিও ও শক্তি একসাথে করুন সেরা ফলাফলের জন্য।",
  ],
};

function selectExercises(fitnessGoal: string | null, missedIds: string[] = []): typeof EXERCISE_LIBRARY {
  const goal = (fitnessGoal || '').toLowerCase();
  
  // Determine mix based on goal
  let cardioCount = 2, strengthCount = 2, flexCount = 1;
  
  if (goal.includes('weight loss') || goal.includes('ওজন কম')) {
    cardioCount = 3; strengthCount = 1; flexCount = 1;
  } else if (goal.includes('muscle') || goal.includes('মাংসপেশী')) {
    cardioCount = 1; strengthCount = 3; flexCount = 1;
  } else if (goal.includes('flexibility') || goal.includes('নমনীয়')) {
    cardioCount = 1; strengthCount = 1; flexCount = 3;
  }
  
  const cardio = EXERCISE_LIBRARY.filter(e => e.type === 'cardio');
  const strength = EXERCISE_LIBRARY.filter(e => e.type === 'strength');
  const flex = EXERCISE_LIBRARY.filter(e => e.type === 'flexibility');
  
  // Shuffle arrays
  const shuffle = <T,>(arr: T[]): T[] => arr.sort(() => Math.random() - 0.5);
  
  const selected: typeof EXERCISE_LIBRARY = [];
  
  // Prioritize missed exercises
  for (const missedId of missedIds) {
    const exercise = EXERCISE_LIBRARY.find(e => e.id === missedId);
    if (exercise && selected.length < 5) {
      selected.push(exercise);
    }
  }
  
  // Fill remaining slots
  const shuffledCardio = shuffle([...cardio]).filter(e => !selected.some(s => s.id === e.id));
  const shuffledStrength = shuffle([...strength]).filter(e => !selected.some(s => s.id === e.id));
  const shuffledFlex = shuffle([...flex]).filter(e => !selected.some(s => s.id === e.id));
  
  while (selected.length < 5) {
    const cardioNeeded = cardioCount - selected.filter(e => e.type === 'cardio').length;
    const strengthNeeded = strengthCount - selected.filter(e => e.type === 'strength').length;
    const flexNeeded = flexCount - selected.filter(e => e.type === 'flexibility').length;
    
    if (cardioNeeded > 0 && shuffledCardio.length > 0) {
      selected.push(shuffledCardio.pop()!);
    } else if (strengthNeeded > 0 && shuffledStrength.length > 0) {
      selected.push(shuffledStrength.pop()!);
    } else if (flexNeeded > 0 && shuffledFlex.length > 0) {
      selected.push(shuffledFlex.pop()!);
    } else {
      // Fill with any available
      const remaining = [...shuffledCardio, ...shuffledStrength, ...shuffledFlex];
      if (remaining.length > 0) {
        selected.push(remaining[0]);
        // Remove from respective array
        const idx = shuffledCardio.indexOf(remaining[0]);
        if (idx > -1) shuffledCardio.splice(idx, 1);
        const idx2 = shuffledStrength.indexOf(remaining[0]);
        if (idx2 > -1) shuffledStrength.splice(idx2, 1);
        const idx3 = shuffledFlex.indexOf(remaining[0]);
        if (idx3 > -1) shuffledFlex.splice(idx3, 1);
      } else {
        break;
      }
    }
  }
  
  return selected.slice(0, 5);
}

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

    // Check for yesterday's incomplete workouts (always compute this)
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
    let missedWorkouts: Array<{ en: string; bn: string; id: string }> = [];
    
    if (yesterdayPlan) {
      const workouts = yesterdayPlan.workouts as Array<{ 
        name: string; 
        name_bn: string; 
        checked: boolean;
        id?: string;
      }>;
      const missed = workouts.filter(w => !w.checked);
      missedWorkouts = missed.map(w => ({ 
        en: w.name, 
        bn: w.name_bn || w.name,
        id: w.id || ''
      }));
      missedCount = missedWorkouts.length;
    }

    // Check for existing plan today (unless force regenerate)
    if (!forceRegenerate) {
      const { data: existingPlan } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_date', today)
        .maybeSingle();

      if (existingPlan) {
        return new Response(JSON.stringify({ 
          plan: existingPlan,
          missedWorkouts: missedWorkouts.length > 0 ? missedWorkouts : null
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Generating workout plan with curated library for goal: ${fitnessGoal}`);

    // Select exercises from library
    const missedIds = missedWorkouts.map(m => m.id).filter(Boolean);
    const selectedExercises = selectExercises(fitnessGoal, missedIds);

    // Format workouts
    const workouts = selectedExercises.map(ex => ({
      id: ex.id,
      name: ex.name_en,
      name_bn: ex.name_bn,
      duration: ex.duration,
      type: ex.type,
      checked: false,
      completed_at: null,
    }));

    // Select random suggestion
    const suggestionIndex = Math.floor(Math.random() * SUGGESTIONS.en.length);
    const suggestion_en = SUGGESTIONS.en[suggestionIndex];
    const suggestion_bn = SUGGESTIONS.bn[suggestionIndex];

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
        generated_en: suggestion_en,
        generated_bn: suggestion_bn,
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
