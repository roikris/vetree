-- User consents table: legal record for Israeli Anti-Spam Law + Privacy Protection Law
-- Records explicit consent at signup (or via one-time modal for existing users)
CREATE TABLE IF NOT EXISTS user_consents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_accepted boolean NOT NULL DEFAULT false,
  marketing_opted_in boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT '1.0',
  ip_address text,
  user_agent text,
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users can read their own consents
CREATE POLICY "Users can read own consents"
  ON user_consents FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all consents
CREATE POLICY "Admins can read all consents"
  ON user_consents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_marketing ON user_consents(marketing_opted_in) WHERE marketing_opted_in = true;
