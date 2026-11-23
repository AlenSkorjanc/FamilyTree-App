DO $$
DECLARE
    invalid_tree_id UUID;
    invalid_path UUID[];
    invalid_relationship_path UUID[];
BEGIN
    WITH RECURSIVE ancestry AS (
        SELECT
            relationship.tree_id,
            relationship.parent_id AS start_id,
            relationship.child_id AS current_id,
            ARRAY[relationship.parent_id, relationship.child_id]::UUID[] AS path,
            ARRAY[relationship.id]::UUID[] AS relationship_path,
            relationship.child_id = relationship.parent_id AS cycle
        FROM parent_child_relationships relationship

        UNION ALL

        SELECT
            relationship.tree_id,
            ancestry.start_id,
            relationship.child_id,
            ancestry.path || relationship.child_id,
            ancestry.relationship_path || relationship.id,
            relationship.child_id = ANY(ancestry.path)
        FROM ancestry
        JOIN parent_child_relationships relationship
          ON relationship.tree_id = ancestry.tree_id
         AND relationship.parent_id = ancestry.current_id
        WHERE NOT ancestry.cycle
    )
    SELECT tree_id, path, relationship_path
      INTO invalid_tree_id, invalid_path, invalid_relationship_path
    FROM ancestry
    WHERE cycle
    LIMIT 1;

    IF invalid_tree_id IS NOT NULL THEN
        RAISE EXCEPTION
            'An ancestry cycle exists in family tree %, involving person path % and relationship path %. Correct the data before applying this migration.',
            invalid_tree_id,
            invalid_path,
            invalid_relationship_path;
    END IF;
END
$$;

ALTER TABLE partnerships
    DROP CONSTRAINT uq_partnership_pair;

ALTER TABLE partnerships
    ADD CONSTRAINT uq_partnership_semantic
    UNIQUE NULLS NOT DISTINCT (
        tree_id,
        person_1_id,
        person_2_id,
        partnership_type,
        start_date,
        end_date
    );

COMMENT ON CONSTRAINT uq_partnership_semantic ON partnerships IS
    'Prevents exact duplicate partnership periods while allowing the same pair to have distinct historical relationships.';
