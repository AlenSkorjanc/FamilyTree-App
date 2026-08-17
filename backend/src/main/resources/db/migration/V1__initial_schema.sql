CREATE TABLE family_trees (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE people (
    id UUID PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
    first_name VARCHAR(120) NOT NULL,
    middle_name VARCHAR(120),
    last_name VARCHAR(120),
    maiden_name VARCHAR(120),
    gender VARCHAR(50),
    birth_date DATE,
    death_date DATE,
    birth_place VARCHAR(250),
    death_place VARCHAR(250),
    notes TEXT,
    photo_url VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE parent_child_relationships (
    id UUID PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    relationship_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT parent_not_child CHECK (parent_id <> child_id),
    CONSTRAINT uq_parent_child UNIQUE (tree_id, parent_id, child_id)
);

CREATE TABLE partnerships (
    id UUID PRIMARY KEY,
    tree_id UUID NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
    person_1_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    person_2_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    partnership_type VARCHAR(30) NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT partners_differ CHECK (person_1_id <> person_2_id),
    CONSTRAINT partners_canonical_order CHECK (person_1_id::text < person_2_id::text),
    CONSTRAINT uq_partnership_pair UNIQUE (tree_id, person_1_id, person_2_id)
);

CREATE INDEX idx_people_tree ON people(tree_id);
CREATE INDEX idx_people_tree_names ON people(tree_id, lower(first_name), lower(last_name));
CREATE INDEX idx_parent_child_tree ON parent_child_relationships(tree_id);
CREATE INDEX idx_parent_child_parent ON parent_child_relationships(parent_id);
CREATE INDEX idx_parent_child_child ON parent_child_relationships(child_id);
CREATE INDEX idx_partnership_tree ON partnerships(tree_id);
CREATE INDEX idx_partnership_person_1 ON partnerships(person_1_id);
CREATE INDEX idx_partnership_person_2 ON partnerships(person_2_id);
