CREATE TABLE app_user (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    normalized_email VARCHAR(320) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(120),
    last_name VARCHAR(120),
    display_name VARCHAR(250),
    profile_picture_url VARCHAR(2000),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_app_user_normalized_email UNIQUE (normalized_email),
    CONSTRAINT password_email_consistency CHECK (password_hash IS NULL OR length(password_hash) > 0)
);

CREATE TABLE user_identity (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(320),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_user_identity_provider UNIQUE (provider, provider_user_id)
);

CREATE TABLE refresh_token (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    family_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_token_id UUID REFERENCES refresh_token(id),
    user_agent VARCHAR(500),
    ip_address VARCHAR(64),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash)
);

ALTER TABLE family_trees ADD COLUMN owner_user_id UUID REFERENCES app_user(id) ON DELETE CASCADE;

CREATE INDEX idx_user_identity_user ON user_identity(user_id);
CREATE INDEX idx_refresh_token_user ON refresh_token(user_id);
CREATE INDEX idx_refresh_token_family ON refresh_token(family_id);
CREATE INDEX idx_refresh_token_expiry ON refresh_token(expires_at);
CREATE INDEX idx_family_tree_owner ON family_trees(owner_user_id);

COMMENT ON COLUMN family_trees.owner_user_id IS
  'Legacy rows remain NULL intentionally and are inaccessible until explicitly assigned by an administrator.';
