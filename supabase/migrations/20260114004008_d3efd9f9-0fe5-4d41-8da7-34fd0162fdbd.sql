-- Enable the vault extension (pgsodium is already available in Supabase)
-- Create a table to store user API key references (linking users to vault secrets)
CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'openai' or 'custom'
  vault_secret_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS on user_api_keys
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API key references (not the actual keys)
CREATE POLICY "Users can view their own API key references"
ON public.user_api_keys
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own API key references
CREATE POLICY "Users can insert their own API key references"
ON public.user_api_keys
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own API key references
CREATE POLICY "Users can update their own API key references"
ON public.user_api_keys
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own API key references
CREATE POLICY "Users can delete their own API key references"
ON public.user_api_keys
FOR DELETE
USING (auth.uid() = user_id);

-- Create a SECURITY DEFINER function to store API keys in the vault
-- This runs with elevated privileges to access vault functions
CREATE OR REPLACE FUNCTION public.store_user_api_key(
  p_provider TEXT,
  p_api_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_secret_id UUID;
  v_existing_secret_id UUID;
  v_key_name TEXT;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Generate a unique name for this secret
  v_key_name := 'user_api_key_' || v_user_id::TEXT || '_' || p_provider;
  
  -- Check if user already has a key for this provider
  SELECT vault_secret_id INTO v_existing_secret_id
  FROM public.user_api_keys
  WHERE user_id = v_user_id AND provider = p_provider;
  
  -- If exists, delete the old secret from vault
  IF v_existing_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_secret_id;
    DELETE FROM public.user_api_keys WHERE user_id = v_user_id AND provider = p_provider;
  END IF;
  
  -- Insert the new secret into vault
  INSERT INTO vault.secrets (name, secret)
  VALUES (v_key_name, p_api_key)
  RETURNING id INTO v_secret_id;
  
  -- Store the reference in user_api_keys
  INSERT INTO public.user_api_keys (user_id, provider, vault_secret_id)
  VALUES (v_user_id, p_provider, v_secret_id);
  
  RETURN v_secret_id;
END;
$$;

-- Create a SECURITY DEFINER function to retrieve decrypted API keys
-- This is only callable by edge functions with service role
CREATE OR REPLACE FUNCTION public.get_user_api_key(
  p_user_id UUID,
  p_provider TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id UUID;
  v_decrypted_key TEXT;
BEGIN
  -- Get the vault secret ID for this user/provider
  SELECT vault_secret_id INTO v_secret_id
  FROM public.user_api_keys
  WHERE user_id = p_user_id AND provider = p_provider;
  
  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get the decrypted secret from vault
  SELECT decrypted_secret INTO v_decrypted_key
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;
  
  RETURN v_decrypted_key;
END;
$$;

-- Create a function to delete user API keys
CREATE OR REPLACE FUNCTION public.delete_user_api_key(
  p_provider TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_secret_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get the vault secret ID
  SELECT vault_secret_id INTO v_secret_id
  FROM public.user_api_keys
  WHERE user_id = v_user_id AND provider = p_provider;
  
  IF v_secret_id IS NOT NULL THEN
    -- Delete from vault
    DELETE FROM vault.secrets WHERE id = v_secret_id;
    -- Delete the reference
    DELETE FROM public.user_api_keys WHERE user_id = v_user_id AND provider = p_provider;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_user_api_keys_updated_at
BEFORE UPDATE ON public.user_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing API keys from profiles to vault (if any exist)
-- This needs to be done carefully - we'll handle this in the edge function
-- For now, we'll keep the old columns but mark them for removal

-- Add a comment to indicate these columns are deprecated
COMMENT ON COLUMN public.profiles.custom_api_key IS 'DEPRECATED: Use vault-based storage via user_api_keys table';
COMMENT ON COLUMN public.profiles.custom_api_endpoint IS 'Custom API endpoint URL (not sensitive, can remain in profiles)';