-- Migration: Person Identity Management System
-- Purpose: Implement person re-identification with immutable tracklets
-- Date: 2026-01-05

BEGIN;

-- ============================================
-- Table 1: persons
-- ============================================
-- Represents a unique person identity
-- Identity is a hypothesis that multiple tracklets belong to the same human
CREATE TABLE IF NOT EXISTS public.persons
(
    person_id uuid NOT NULL DEFAULT gen_random_uuid(),
    video_id integer NOT NULL,
    
    -- Identity anchors (typically from highest confidence tracklet)
    canonical_face_vec_id uuid,              -- Reference to tracklet with best face
    canonical_reid_vec_id uuid,              -- Reference to tracklet with best ReID
    
    -- Metadata
    confidence_score numeric(5, 3),          -- Average confidence across all tracklets
    face_confidence_avg numeric(5, 3),       -- Average face quality score
    reid_confidence_avg numeric(5, 3),       -- Average ReID quality score
    
    -- Statistics
    total_tracklets integer DEFAULT 0,       -- How many tracklets assigned to this person
    first_appearance_time time without time zone,
    last_appearance_time time without time zone,
    total_appearance_duration interval,      -- Sum of all tracklet durations
    
    -- Resolution metadata
    resolution_mode character varying(30),   -- 'automatic', 'hybrid', 'pending_review'
    
    -- Timestamps
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT persons_pkey PRIMARY KEY (person_id),
    CONSTRAINT persons_video_id_fkey FOREIGN KEY (video_id)
        REFERENCES public.videos (video_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

COMMENT ON TABLE public.persons IS 'Represents a unique person identity across tracklets in a video';
COMMENT ON COLUMN public.persons.confidence_score IS 'Average confidence score from all associated tracklets';
COMMENT ON COLUMN public.persons.resolution_mode IS 'How this person was identified: automatic (high confidence), hybrid (medium confidence with face confirmation), pending_review (manual intervention needed)';

CREATE INDEX IF NOT EXISTS idx_persons_video_id ON public.persons(video_id);
CREATE INDEX IF NOT EXISTS idx_persons_created_at ON public.persons(created_at);


-- ============================================
-- Table 2: person_tracklets
-- ============================================
-- Immutable observations of persons (from Qdrant tracklets)
-- Each row = one tracklet observation
CREATE TABLE IF NOT EXISTS public.person_tracklets
(
    tracklet_id uuid NOT NULL DEFAULT gen_random_uuid(),
    person_id uuid,                          -- NULL until resolved
    video_id integer NOT NULL,
    
    -- Tracklet identification
    qdrant_tracklet_id character varying(255),  -- Reference to Qdrant point ID
    track_number integer,                    -- Original tracker ID (e.g., track 37)
    
    -- Temporal information
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    num_frames integer,
    duration_sec numeric(10, 2),
    
    -- Quality metrics
    face_quality numeric(5, 3),              -- 0-1, confidence from face detector
    reid_quality numeric(5, 3),              -- 0-1, confidence from ReID encoder
    avg_detection_confidence numeric(5, 3),
    
    -- Embedding information (stored as references, not vectors)
    face_embedding_hash character varying(128),  -- SHA256 hash of face vector
    reid_embedding_hash character varying(128),  -- SHA256 hash of ReID vector
    
    -- Metadata
    attributes jsonb,                        -- hat, hood, glasses, colors, etc.
    bounding_boxes jsonb,                    -- Sample frames with bboxes
    
    -- Resolution history
    is_primary_for_person boolean DEFAULT false,  -- Is this the canonical tracklet?
    
    -- Timestamps
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT person_tracklets_pkey PRIMARY KEY (tracklet_id),
    CONSTRAINT person_tracklets_person_id_fkey FOREIGN KEY (person_id)
        REFERENCES public.persons (person_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT person_tracklets_video_id_fkey FOREIGN KEY (video_id)
        REFERENCES public.videos (video_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT person_tracklets_qdrant_tracklet_id_key UNIQUE (qdrant_tracklet_id)
);

COMMENT ON TABLE public.person_tracklets IS 'Immutable tracklet observations from video analysis pipeline';
COMMENT ON COLUMN public.person_tracklets.qdrant_tracklet_id IS 'Reference to Qdrant point ID for future vector lookups';
COMMENT ON COLUMN public.person_tracklets.face_quality IS 'Quality of face detection (0-1), determines if suitable for identity resolution';
COMMENT ON COLUMN public.person_tracklets.reid_quality IS 'Quality of ReID embedding (0-1), determines reliability of appearance matching';
COMMENT ON COLUMN public.person_tracklets.is_primary_for_person IS 'If true, this tracklet was used as canonical for person identity';

CREATE INDEX IF NOT EXISTS idx_person_tracklets_person_id ON public.person_tracklets(person_id);
CREATE INDEX IF NOT EXISTS idx_person_tracklets_video_id ON public.person_tracklets(video_id);
CREATE INDEX IF NOT EXISTS idx_person_tracklets_start_time ON public.person_tracklets(start_time);
CREATE INDEX IF NOT EXISTS idx_person_tracklets_created_at ON public.person_tracklets(created_at);


-- ============================================
-- Table 3: person_tracklet_associations
-- ============================================
-- Similarity matching records (audit trail for person resolution)
CREATE TABLE IF NOT EXISTS public.person_tracklet_associations
(
    association_id serial NOT NULL,
    person_id uuid NOT NULL,
    tracklet_id uuid NOT NULL,
    
    -- Matching scores
    reid_similarity numeric(5, 4),           -- 0-1 similarity on ReID vector
    face_similarity numeric(5, 4),           -- 0-1 similarity on face vector
    fused_similarity numeric(5, 4),          -- Weighted combination (65% ReID, 35% face)
    
    -- Decision metadata
    resolution_mode character varying(30),   -- 'automatic', 'hybrid'
    confidence_level character varying(20),  -- 'high', 'medium', 'low'
    
    -- Thresholds used
    threshold_applied numeric(5, 4),         -- Which threshold was used for decision
    
    -- Timestamps
    matched_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT person_tracklet_associations_pkey PRIMARY KEY (association_id),
    CONSTRAINT person_tracklet_associations_person_id_fkey FOREIGN KEY (person_id)
        REFERENCES public.persons (person_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT person_tracklet_associations_tracklet_id_fkey FOREIGN KEY (tracklet_id)
        REFERENCES public.person_tracklets (tracklet_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT person_tracklet_associations_unique_mapping UNIQUE (tracklet_id)
);

COMMENT ON TABLE public.person_tracklet_associations IS 'Audit trail of person-to-tracklet mappings with similarity scores';
COMMENT ON COLUMN public.person_tracklet_associations.fused_similarity IS 'Combined similarity: 0.65 * reid_similarity + 0.35 * face_similarity';
COMMENT ON COLUMN public.person_tracklet_associations.resolution_mode IS 'automatic (both face and reid passed), hybrid (only reid passed but face confirmed)';

CREATE INDEX IF NOT EXISTS idx_person_tracklet_associations_person_id ON public.person_tracklet_associations(person_id);
CREATE INDEX IF NOT EXISTS idx_person_tracklet_associations_tracklet_id ON public.person_tracklet_associations(tracklet_id);
CREATE INDEX IF NOT EXISTS idx_person_tracklet_associations_matched_at ON public.person_tracklet_associations(matched_at);


-- ============================================
-- Table 4: person_appearance_timeline
-- ============================================
-- Denormalized view for quick timeline queries (updated via trigger or batch job)
CREATE TABLE IF NOT EXISTS public.person_appearance_timeline
(
    timeline_id serial NOT NULL,
    person_id uuid NOT NULL,
    video_id integer NOT NULL,
    
    appearance_number integer,               -- Which appearance session is this?
    start_time time without time zone,
    end_time time without time zone,
    duration_sec numeric(10, 2),
    
    gap_from_previous_sec numeric(10, 2),   -- Time gap from previous appearance
    num_tracklets integer,                   -- How many tracklets in this appearance block
    
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT person_appearance_timeline_pkey PRIMARY KEY (timeline_id),
    CONSTRAINT person_appearance_timeline_person_id_fkey FOREIGN KEY (person_id)
        REFERENCES public.persons (person_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT person_appearance_timeline_video_id_fkey FOREIGN KEY (video_id)
        REFERENCES public.videos (video_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

COMMENT ON TABLE public.person_appearance_timeline IS 'Derived table showing continuous appearance blocks (helpful for visualization)';

CREATE INDEX IF NOT EXISTS idx_person_appearance_timeline_person_id ON public.person_appearance_timeline(person_id);
CREATE INDEX IF NOT EXISTS idx_person_appearance_timeline_video_id ON public.person_appearance_timeline(video_id);


COMMIT;
