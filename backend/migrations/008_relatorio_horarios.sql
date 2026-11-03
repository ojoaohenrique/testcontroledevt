-- Migration 008: Horário de início e término no Relatório Diário
-- Executar no Supabase SQL Editor ANTES de publicar a nova versão do site.
-- Pode ser executada mais de uma vez sem erro.

ALTER TABLE public.relatorios_diarios
    ADD COLUMN IF NOT EXISTS hora_inicio  TIME,
    ADD COLUMN IF NOT EXISTS hora_termino TIME;
