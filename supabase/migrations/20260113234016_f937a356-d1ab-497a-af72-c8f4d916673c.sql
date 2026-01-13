-- Add AI provider settings to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'lovable_ai';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_api_endpoint TEXT;