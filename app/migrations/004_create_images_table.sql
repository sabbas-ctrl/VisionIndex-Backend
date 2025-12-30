-- -- VisionIndex Images Table Migration
-- -- Creates table for storing image metadata for query/comparison tasks

-- -- 1. Images Table
-- -- Table for image file registry and metadata
-- CREATE TABLE IF NOT EXISTS public.images (
--     image_id SERIAL PRIMARY KEY,
--     uploader_id INT REFERENCES public.users(user_id) ON DELETE SET NULL,
--     file_name VARCHAR(255) NOT NULL,
--     original_name VARCHAR(255) NOT NULL,
--     storage_path TEXT NOT NULL,  -- Backblaze B2 path (images/ folder)
--     file_size BIGINT NOT NULL,
--     checksum VARCHAR(128),        -- File integrity hash
--     upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     status VARCHAR(20) DEFAULT 'uploaded', -- uploaded, processing, processed, failed
--     metadata JSONB,               -- Additional info: { "width": 1920, "height": 1080, "format": "jpg" }
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- -- Create indexes for better performance
-- CREATE INDEX IF NOT EXISTS idx_images_uploader_id ON public.images(uploader_id);
-- CREATE INDEX IF NOT EXISTS idx_images_status ON public.images(status);
-- CREATE INDEX IF NOT EXISTS idx_images_upload_time ON public.images(upload_time);
-- CREATE INDEX IF NOT EXISTS idx_images_metadata ON public.images USING GIN(metadata);

-- -- Create trigger for updated_at
-- DROP TRIGGER IF EXISTS images_updated_at_trigger ON public.images;
-- CREATE TRIGGER images_updated_at_trigger
--     BEFORE UPDATE ON public.images
--     FOR EACH ROW
--     EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.images
(
    image_id serial NOT NULL,
    uploader_id integer,

    file_name character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    storage_path text NOT NULL,
    file_size bigint NOT NULL,

    resolution character varying(50),
    checksum character varying(128),

    upload_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'uploaded',

    labels jsonb,
    metadata jsonb,

    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT images_pkey PRIMARY KEY (image_id),
    CONSTRAINT images_uploader_id_fkey FOREIGN KEY (uploader_id)
        REFERENCES public.users (user_id)
        ON DELETE SET NULL
);

ALTER TABLE public.searches
ADD COLUMN query_image_id integer,
ADD COLUMN query_video_id integer;

ALTER TABLE public.searches
ADD CONSTRAINT searches_query_image_id_fkey
FOREIGN KEY (query_image_id)
REFERENCES public.images (image_id)
ON DELETE SET NULL;

