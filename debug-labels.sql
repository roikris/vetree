-- Check if there are any articles at all
SELECT COUNT(*) as total_articles FROM articles;

-- Check what labels look like in the database
SELECT id, title, labels
FROM articles
LIMIT 5;

-- Check if any articles have "Small Animal" in their labels
SELECT COUNT(*) as small_animal_count
FROM articles
WHERE 'Small Animal' = ANY(labels);

-- Check if any articles have "Large Animal" in their labels
SELECT COUNT(*) as large_animal_count
FROM articles
WHERE 'Large Animal' = ANY(labels);

-- See all unique labels across all articles
SELECT DISTINCT unnest(labels) as label
FROM articles
ORDER BY label;
