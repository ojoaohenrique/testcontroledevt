-- Migration 009: Dados do condutor no B.O. (separados do proprietário)
-- Executar no Supabase SQL Editor ANTES de publicar a nova versão do site.
-- Pode ser executada mais de uma vez sem erro.

ALTER TABLE public.boletins_ocorrencia
    ADD COLUMN IF NOT EXISTS condutor_mesmo_proprietario BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS condutor_nome TEXT,
    ADD COLUMN IF NOT EXISTS condutor_cpf  TEXT,
    ADD COLUMN IF NOT EXISTS condutor_rg   TEXT,
    ADD COLUMN IF NOT EXISTS condutor_cnh  TEXT;
