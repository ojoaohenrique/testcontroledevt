-- Migration 006: Quantidade de Autos de Infração (Relatório Diário)
-- Executar no Supabase SQL Editor APÓS as migrations 002, 003, 004 e 005.
-- NÃO remove tabelas ou colunas existentes.
--
-- Novo campo, logo após "Ocorrências atendidas": quantidade de autos de
-- infração lavrados no dia. Campo numérico simples, opcional.

ALTER TABLE public.relatorios_diarios
    ADD COLUMN IF NOT EXISTS autos_infracao_quantidade INTEGER;

-- Quantidade não pode ser negativa
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_relatorios_autos_infracao_quantidade') THEN
        ALTER TABLE public.relatorios_diarios
            ADD CONSTRAINT ck_relatorios_autos_infracao_quantidade
            CHECK (autos_infracao_quantidade IS NULL OR autos_infracao_quantidade >= 0) NOT VALID;
    END IF;
END $$;
