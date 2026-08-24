ALTER TABLE app_user
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE account_action_token (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_type VARCHAR(30) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    CONSTRAINT ck_account_action_token_type CHECK (token_type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGE'))
);

CREATE INDEX idx_account_action_token_user_type ON account_action_token(user_id, token_type);
CREATE INDEX idx_account_action_token_expiry ON account_action_token(expires_at);
