-- 011: fotos opcionais no Relatorio Diario (usa o bucket bo-fotos, pasta relatorios/)
ALTER TABLE public.relatorios_diarios ADD COLUMN IF NOT EXISTS fotos JSONB NOT NULL DEFAULT '[]'::jsonb;
NOTIFY pgrst, 'reload schema';
