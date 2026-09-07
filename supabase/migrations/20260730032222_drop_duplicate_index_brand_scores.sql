-- Drop duplicate index on brand_scores
-- Keep brand_scores_brand_id_score_type_key, drop brand_scores_brand_id_score_type_uidx
-- Both are identical UNIQUE indexes on (brand_id, score_type)

DROP INDEX IF EXISTS public.brand_scores_brand_id_score_type_uidx;
