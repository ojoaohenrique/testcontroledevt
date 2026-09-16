-- Migration 005: Limpeza e alterações encontradas na viatura (Relatório Diário)
-- Executar no Supabase SQL Editor APÓS as migrations 002, 003 e 004.
-- NÃO remove tabelas ou colunas existentes.
--
-- Substitui o campo único "Alterações encontradas nas viaturas" (texto livre)
-- por: limpeza da viatura (Limpa/Suja), se foram encontradas alterações
-- (Sem alterações/Com alterações) e, quando houver alterações, a descrição
-- delas — reaproveitando a coluna já existente "alteracoes_viaturas" para
-- guardar esse texto.

ALTER TABLE public.relatorios_diarios
    ADD COLUMN IF NOT EXISTS viatura_limpeza TEXT,
    ADD COLUMN IF NOT EXISTS viatura_alteracoes TEXT;

-- ============================================================
-- VALIDAÇÕES
-- ============================================================

-- Limpeza só pode ser "Limpa" ou "Suja"
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_relatorios_viatura_limpeza') THEN
        ALTER TABLE public.relatorios_diarios
            ADD CONSTRAINT ck_relatorios_viatura_limpeza
            CHECK (viatura_limpeza IS NULL OR viatura_limpeza IN ('Limpa', 'Suja')) NOT VALID;
    END IF;
END $$;

-- Alterações só pode ser "Sem alterações" ou "Com alterações"
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_relatorios_viatura_alteracoes') THEN
        ALTER TABLE public.relatorios_diarios
            ADD CONSTRAINT ck_relatorios_viatura_alteracoes
            CHECK (viatura_alteracoes IS NULL OR viatura_alteracoes IN ('Sem alterações', 'Com alterações')) NOT VALID;
    END IF;
END $$;

-- A descrição (coluna alteracoes_viaturas) é obrigatória quando houver alterações
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_relatorios_viatura_alteracoes_descricao') THEN
        ALTER TABLE public.relatorios_diarios
            ADD CONSTRAINT ck_relatorios_viatura_alteracoes_descricao
            CHECK (
                viatura_alteracoes IS DISTINCT FROM 'Com alterações'
                OR (alteracoes_viaturas IS NOT NULL AND btrim(alteracoes_viaturas) <> '')
            ) NOT VALID;
    END IF;
END $$;
