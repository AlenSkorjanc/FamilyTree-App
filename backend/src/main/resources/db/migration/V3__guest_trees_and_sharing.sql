ALTER TABLE family_trees
    ADD COLUMN guest_owner_id UUID,
    ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    ADD COLUMN public_share_id UUID;

ALTER TABLE family_trees
    ADD CONSTRAINT ck_family_tree_single_owner
        CHECK (owner_user_id IS NULL OR guest_owner_id IS NULL),
    ADD CONSTRAINT ck_family_tree_visibility
        CHECK (visibility IN ('PRIVATE', 'RESTRICTED', 'PUBLIC')),
    ADD CONSTRAINT uq_family_tree_public_share UNIQUE (public_share_id);

CREATE INDEX idx_family_tree_guest_owner ON family_trees(guest_owner_id);

CREATE TABLE family_tree_user_access (
    id UUID PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_family_tree_user_access UNIQUE (tree_id, user_id)
);

CREATE INDEX idx_family_tree_user_access_user ON family_tree_user_access(user_id);

COMMENT ON COLUMN family_trees.guest_owner_id IS
  'Opaque browser identity from an HttpOnly cookie; cleared when the tree is claimed by an APP_USER.';
