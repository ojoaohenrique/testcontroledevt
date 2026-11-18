-- ================================================================
-- GML - SEGURANÇA PARA ENTREGA
-- Rodar UMA vez no Supabase: SQL Editor > New query > colar > Run.
--
-- 1. Os dados do GML passam a ser lidos e gravados SÓ por usuários
--    logados (antes qualquer pessoa com o endereço do site conseguia).
-- 2. Cria a pasta "fotos-viaturas" (fotos da chegada das viaturas).
--
-- Não apaga nenhum dado. Pode ser rodado mais de uma vez.
-- Tudo numa transação: se der qualquer erro, NADA é aplicado.
-- ================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Tabelas do GML: remove as regras antigas (liberadas para
--    qualquer um) e cria a regra "somente usuário logado"
-- ---------------------------------------------------------------
DO $$
DECLARE
    tabela TEXT;
    regra  RECORD;
    tabelas TEXT[] := ARRAY[
        'saidas_viaturas', 'abastecimentos', 'ordens_servico',
        'relatorios_diarios', 'relatorio_diario_itens',
        'boletins_ocorrencia', 'viaturas', 'usuarios', 'inspetores'
    ];
BEGIN
    FOREACH tabela IN ARRAY tabelas LOOP
        IF to_regclass('public.' || tabela) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);

        FOR regra IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = tabela
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', regra.policyname, tabela);
        END LOOP;

        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            'GML - somente usuarios logados', tabela
        );
    END LOOP;
END $$;

-- Contador da numeração do A.R.V.C: ninguém acessa direto pela API
-- (só a função de numeração, que roda com permissão do dono do banco)
ALTER TABLE IF EXISTS public.boletins_ocorrencia_contador ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- 2. Fotos do A.R.V.C (pasta privada "bo-fotos"): só usuário logado
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bo-fotos', 'bo-fotos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "bo-fotos ler" ON storage.objects;
CREATE POLICY "bo-fotos ler" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'bo-fotos');

DROP POLICY IF EXISTS "bo-fotos enviar" ON storage.objects;
CREATE POLICY "bo-fotos enviar" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bo-fotos');

DROP POLICY IF EXISTS "bo-fotos apagar" ON storage.objects;
CREATE POLICY "bo-fotos apagar" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'bo-fotos');

-- ---------------------------------------------------------------
-- 3. Fotos da chegada das viaturas (pasta "fotos-viaturas")
--    O sistema mostra essas fotos por link direto, por isso a pasta
--    é pública para visualizar; enviar e apagar só usuário logado.
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-viaturas', 'fotos-viaturas', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fotos-viaturas ler" ON storage.objects;
CREATE POLICY "fotos-viaturas ler" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'fotos-viaturas');

DROP POLICY IF EXISTS "fotos-viaturas enviar" ON storage.objects;
CREATE POLICY "fotos-viaturas enviar" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-viaturas');

DROP POLICY IF EXISTS "fotos-viaturas atualizar" ON storage.objects;
CREATE POLICY "fotos-viaturas atualizar" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'fotos-viaturas') WITH CHECK (bucket_id = 'fotos-viaturas');

DROP POLICY IF EXISTS "fotos-viaturas apagar" ON storage.objects;
CREATE POLICY "fotos-viaturas apagar" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'fotos-viaturas');

NOTIFY pgrst, 'reload schema';

COMMIT;
