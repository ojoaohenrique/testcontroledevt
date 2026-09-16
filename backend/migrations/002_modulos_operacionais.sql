-- Migration 002: Módulos Operacionais (Dashboard, Relatório Diário, Ordens de Serviço)
-- Executar no Supabase SQL Editor APÓS o schema base.
-- NÃO remove tabelas existentes.

-- ============================================================
-- ORDENS DE SERVIÇO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ordens_servico (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_ordem        TEXT NOT NULL UNIQUE,
    data                DATE NOT NULL,
    hora                TIME NOT NULL,
    solicitante         TEXT NOT NULL,
    setor               TEXT NOT NULL,
    prioridade          TEXT NOT NULL DEFAULT 'Normal',
    status              TEXT NOT NULL DEFAULT 'Aberta',
    viatura             TEXT,
    motorista           TEXT,
    equipe              TEXT,
    tipo_servico        TEXT NOT NULL,
    descricao           TEXT NOT NULL,
    local               TEXT,
    data_hora_inicio    TIMESTAMPTZ,
    data_hora_termino   TIMESTAMPTZ,
    resultado           TEXT,
    observacoes         TEXT,
    assinatura          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON public.ordens_servico (status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_data ON public.ordens_servico (data);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_viatura ON public.ordens_servico (viatura);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_equipe ON public.ordens_servico (equipe);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_motorista ON public.ordens_servico (motorista);

-- ============================================================
-- RELATÓRIOS DIÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.relatorios_diarios (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data                    DATE NOT NULL,
    turno                   TEXT NOT NULL,
    equipe                  TEXT NOT NULL,
    responsavel             TEXT NOT NULL,
    motoristas              TEXT[] NOT NULL DEFAULT '{}',
    viaturas_utilizadas     TEXT[] NOT NULL DEFAULT '{}',
    km_inicial              NUMERIC,
    km_final                NUMERIC,
    bairros_patrulhados     TEXT,
    ocorrencias_atendidas   TEXT,
    atividades_realizadas   TEXT,
    materiais_utilizados    TEXT,
    alteracoes_viaturas     TEXT,
    abastecimentos_realizados TEXT,
    observacoes             TEXT,
    status                  TEXT NOT NULL DEFAULT 'Rascunho',
    assinatura_responsavel  TEXT,
    ordem_servico_id        UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relatorios_diarios_data ON public.relatorios_diarios (data);
CREATE INDEX IF NOT EXISTS idx_relatorios_diarios_equipe ON public.relatorios_diarios (equipe);
CREATE INDEX IF NOT EXISTS idx_relatorios_diarios_responsavel ON public.relatorios_diarios (responsavel);
CREATE INDEX IF NOT EXISTS idx_relatorios_diarios_status ON public.relatorios_diarios (status);
CREATE INDEX IF NOT EXISTS idx_relatorios_diarios_ordem ON public.relatorios_diarios (ordem_servico_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo - ordens_servico" ON public.ordens_servico;
CREATE POLICY "Permitir tudo - ordens_servico"
    ON public.ordens_servico FOR ALL
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo - relatorios_diarios" ON public.relatorios_diarios;
CREATE POLICY "Permitir tudo - relatorios_diarios"
    ON public.relatorios_diarios FOR ALL
    USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGER: atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ordens_servico_updated ON public.ordens_servico;
CREATE TRIGGER trg_ordens_servico_updated
    BEFORE UPDATE ON public.ordens_servico
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_relatorios_diarios_updated ON public.relatorios_diarios;
CREATE TRIGGER trg_relatorios_diarios_updated
    BEFORE UPDATE ON public.relatorios_diarios
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
