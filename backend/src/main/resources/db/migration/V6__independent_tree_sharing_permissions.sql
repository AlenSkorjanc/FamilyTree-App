ALTER TABLE family_trees
    ADD COLUMN public_can_edit BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE family_tree_user_access
    ADD COLUMN can_edit BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN family_trees.public_can_edit IS
  'Whether possession of the active public share URL grants permission to edit tree contents.';

COMMENT ON COLUMN family_tree_user_access.can_edit IS
  'Whether this selected user may edit tree contents; owners retain exclusive control of tree settings.';
