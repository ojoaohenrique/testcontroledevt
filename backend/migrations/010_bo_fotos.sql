-- Migration 010: Fotos no B.O.
-- Executar no Supabase SQL Editor ANTES de publicar a nova versão do site.
-- Pode ser executada mais de uma vez sem erro.

-- Lista de fotos do B.O.: [{ "path": "fotos/<id>.jpg", "nome": "IMG_123.jpg" }]
ALTER TABLE public.boletins_ocorrencia
    ADD COLUMN IF NOT EXISTS fotos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Pasta (bucket) privada para guardar as fotos, limite de 10 MB por arquivo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bo-fotos', 'bo-fotos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Acesso às fotos (mesmo padrão liberado dos demais módulos em teste)
DROP POLICY IF EXISTS "bo-fotos ler" ON storage.objects;
CREATE POLICY "bo-fotos ler" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'bo-fotos');

DROP POLICY IF EXISTS "bo-fotos enviar" ON storage.objects;
CREATE POLICY "bo-fotos enviar" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'bo-fotos');

DROP POLICY IF EXISTS "bo-fotos apagar" ON storage.objects;
CREATE POLICY "bo-fotos apagar" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = 'bo-fotos');

NOTIFY pgrst, 'reload schema';
