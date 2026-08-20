ALTER TABLE partnerships
    ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION enforce_one_current_partnership_per_person()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current AND EXISTS (
        SELECT 1
        FROM partnerships existing
        WHERE existing.tree_id = NEW.tree_id
          AND existing.id <> NEW.id
          AND existing.is_current
          AND (
              existing.person_1_id IN (NEW.person_1_id, NEW.person_2_id)
              OR existing.person_2_id IN (NEW.person_1_id, NEW.person_2_id)
          )
    ) THEN
        RAISE EXCEPTION 'A person can have at most one current partnership'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ck_one_current_partnership_per_person
AFTER INSERT OR UPDATE OF is_current, person_1_id, person_2_id, tree_id ON partnerships
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_one_current_partnership_per_person();

CREATE INDEX idx_partnership_current_person_1
    ON partnerships(tree_id, person_1_id) WHERE is_current;
CREATE INDEX idx_partnership_current_person_2
    ON partnerships(tree_id, person_2_id) WHERE is_current;

COMMENT ON COLUMN partnerships.is_current IS
  'Symmetric, explicitly selected current-partner status. Existing rows intentionally default to false.';
