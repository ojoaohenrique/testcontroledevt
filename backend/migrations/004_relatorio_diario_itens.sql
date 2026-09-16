-- Migration 004: Itens do Relatório Diário (atividades por Ordem de Serviço)
-- Executar no Supabase SQL Editor APÓS as migrations 002 e 003.
-- NÃO remove tabelas existentes.
--
-- Um Relatório Diário pode conter várias atividades, cada uma vinculada a
-- uma Ordem de Serviço distinta. Esta tabela guarda cada uma dessas linhas
-- separadamente, mantendo o relatório organizado por data e por O.S.

CREATE TABLE IF NOT EXISTS public.relatorio_diario_itens (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relatorio_diario_id     UUID NOT NULL REFERENCES public.relatorios_diarios(id) ON DELETE CASCADE,
    ordem_servico_id        UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    numero_ordem            TEXT NOT NULL,
    status_os               TEXT NOT NULL,
    atividade_realizada     TEXT NOT NULL,
    quantidade              NUMERIC,
    unidade_medida          TEXT,
    observacoes             TEXT,
    motivo                  TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relatorio_diario_itens_relatorio ON public.relatorio_diario_itens (relatorio_diario_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_diario_itens_ordem ON public.relatorio_diario_itens (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_diario_itens_numero_ordem ON public.relatorio_diario_itens (numero_ordem);
CREATE INDEX IF NOT EXISTS idx_relatorio_diario_itens_status_os ON public.relatorio_diario_itens (status_os);

-- ============================================================
-- VALIDAÇÕES
-- ============================================================

-- Status permitidos para o item (status da O.S. naquele registro do dia)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_relatorio_itens_status') THEN
        ALTER TABLE public.relatorio_diario_itens
            ADD CONSTRAINT ck_relatorio_itens_status
            CHECK (status_os IN ('Concluída', 'Não concluída', 'Em andamento')) NOT VALID;
    END IF;
END $$;

-- Motivo é obrigatório quando a O.S. não foi concluída
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_relatorio_itens_motivo_obrigatorio') THEN
        ALTER TABLE public.relatorio_diario_itens
            ADD CONSTRAINT ck_relatorio_itens_motivo_obrigatorio
            CHECK (status_os <> 'Não concluída' OR (motivo IS NOT NULL AND btrim(motivo) <> '')) NOT VALID;
    END IF;
END $$;

-- Quantidade não pode ser negativa
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_relatorio_itens_quantidade') THEN
        ALTER TABLE public.relatorio_diario_itens
            ADD CONSTRAINT ck_relatorio_itens_quantidade
            CHECK (quantidade IS NULL OR quantidade >= 0) NOT VALID;
    END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY (padrão do projeto: liberado para testes)
-- ============================================================

ALTER TABLE public.relatorio_diario_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo - relatorio_diario_itens" ON public.relatorio_diario_itens;
CREATE POLICY "Permitir tudo - relatorio_diario_itens"
    ON public.relatorio_diario_itens FOR ALL
    USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGER: atualizar updated_at automaticamente
-- (reaproveita a função public.set_updated_at() criada na migration 002)
-- ============================================================

DROP TRIGGER IF EXISTS trg_relatorio_diario_itens_updated ON public.relatorio_diario_itens;
CREATE TRIGGER trg_relatorio_diario_itens_updated
    BEFORE UPDATE ON public.relatorio_diario_itens
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
