-- ================================================================
-- GML - BLINDAGEM DE ACESSO (013)
-- Rodar UMA vez no Supabase: SQL Editor > New query > colar > Run.
--
-- PROBLEMA QUE ESTE SCRIPT RESOLVE
--   Antes, QUALQUER conta logada podia ler, alterar e apagar tudo.
--   Como o cadastro de contas do Supabase estava aberto, qualquer
--   pessoa podia criar uma conta e ter acesso total ao sistema.
--
-- O QUE MUDA
--   1. Cria a lista "gml_acesso" de usuários autorizados.
--      Todas as contas que JÁ EXISTEM hoje entram na lista
--      automaticamente (ninguém que já usa o sistema perde acesso).
--   2. Contas criadas depois disso NÃO têm acesso a nada até que
--      um administrador as adicione na lista (ver final do arquivo).
--   3. Tabelas e pastas de fotos passam a exigir "usuário autorizado"
--      e não apenas "usuário logado".
--   4. Visitantes não logados (anon) perdem qualquer permissão nas
--      tabelas do GML.
--
-- Não apaga nenhum dado. Pode ser rodado mais de uma vez.
-- Tudo numa transação: se der qualquer erro, NADA é aplicado.
-- ================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Lista de usuários autorizados
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gml_acesso (
    user_id     UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email       TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A própria lista não pode ser lida nem alterada pela API do site:
-- só pelo SQL Editor / painel do Supabase.
ALTER TABLE public.gml_acesso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gml_acesso FROM anon, authenticated;

-- Autoriza todas as contas que já existem hoje
INSERT INTO public.gml_acesso (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Função usada pelas regras: "o usuário logado está autorizado?"
CREATE OR REPLACE FUNCTION public.gml_autorizado()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.gml_acesso
        WHERE user_id = auth.uid() AND ativo
    );
$$;

REVOKE ALL ON FUNCTION public.gml_autorizado() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gml_autorizado() TO authenticated;

-- ---------------------------------------------------------------
-- 2. Tabelas do GML: só usuário autorizado
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
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', tabela);

        FOR regra IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = tabela
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', regra.policyname, tabela);
        END LOOP;

        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
            'USING (public.gml_autorizado()) WITH CHECK (public.gml_autorizado())',
            'GML - somente usuarios autorizados', tabela
        );
    END LOOP;
END $$;

-- Contador da numeração do A.R.V.C: ninguém acessa direto pela API
ALTER TABLE IF EXISTS public.boletins_ocorrencia_contador ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF to_regclass('public.boletins_ocorrencia_contador') IS NOT NULL THEN
        REVOKE ALL ON public.boletins_ocorrencia_contador FROM anon, authenticated;
    END IF;
END $$;

-- ---------------------------------------------------------------
-- 3. Pastas de fotos: só usuário autorizado
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "bo-fotos ler" ON storage.objects;
CREATE POLICY "bo-fotos ler" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'bo-fotos' AND public.gml_autorizado());

DROP POLICY IF EXISTS "bo-fotos enviar" ON storage.objects;
CREATE POLICY "bo-fotos enviar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'bo-fotos' AND public.gml_autorizado());

DROP POLICY IF EXISTS "bo-fotos apagar" ON storage.objects;
CREATE POLICY "bo-fotos apagar" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'bo-fotos' AND public.gml_autorizado());

DROP POLICY IF EXISTS "fotos-viaturas ler" ON storage.objects;
CREATE POLICY "fotos-viaturas ler" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'fotos-viaturas' AND public.gml_autorizado());

DROP POLICY IF EXISTS "fotos-viaturas enviar" ON storage.objects;
CREATE POLICY "fotos-viaturas enviar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'fotos-viaturas' AND public.gml_autorizado());

DROP POLICY IF EXISTS "fotos-viaturas atualizar" ON storage.objects;
CREATE POLICY "fotos-viaturas atualizar" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'fotos-viaturas' AND public.gml_autorizado())
    WITH CHECK (bucket_id = 'fotos-viaturas' AND public.gml_autorizado());

DROP POLICY IF EXISTS "fotos-viaturas apagar" ON storage.objects;
CREATE POLICY "fotos-viaturas apagar" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'fotos-viaturas' AND public.gml_autorizado());

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ================================================================
-- COMO LIBERAR UM NOVO USUÁRIO (depois de criar a conta dele em
-- Authentication > Users > Add user):
--
--   INSERT INTO public.gml_acesso (user_id, email)
--   SELECT id, email FROM auth.users WHERE email = 'novo@exemplo.com';
--
-- COMO BLOQUEAR UM USUÁRIO:
--
--   UPDATE public.gml_acesso SET ativo = false WHERE email = 'fulano@exemplo.com';
--
-- VER QUEM TEM ACESSO:
--
--   SELECT email, ativo, criado_em FROM public.gml_acesso ORDER BY email;
-- ================================================================
