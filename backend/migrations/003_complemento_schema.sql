-- Migration 003: Complemento do Schema (tabelas faltantes, validações e índices)
-- Executar no Supabase SQL Editor APÓS o schema base e a migration 002.
-- NÃO remove tabelas existentes. Pode ser executada mais de uma vez sem erro.

-- ============================================================
-- 1. TABELAS FALTANTES
-- ============================================================

-- Tabela de viaturas (cadastro da frota) - referenciada pelos modelos Flask
CREATE TABLE IF NOT EXISTS public.viaturas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefixo     TEXT NOT NULL,
    modelo      TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de usuários do sistema - referenciada pelos modelos Flask
CREATE TABLE IF NOT EXISTS public.usuarios (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    cargo       TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de inspetores - utilizada pela rota /api/inspetores
CREATE TABLE IF NOT EXISTS public.inspetores (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    matricula   TEXT,
    turno       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. VALIDAÇÕES (CHECK) - idempotentes via DO blocks
--    PostgreSQL não suporta "ADD CONSTRAINT IF NOT EXISTS",
--    por isso verificamos pg_constraint antes de adicionar.
--    "NOT VALID" garante aplicação mesmo com dados legados.
-- ============================================================

-- Status permitidos nas ordens de serviço
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_ordens_servico_status') THEN
        ALTER TABLE public.ordens_servico
            ADD CONSTRAINT ck_ordens_servico_status
            CHECK (status IN ('Aberta', 'Em andamento', 'Concluída', 'Cancelada')) NOT VALID;
    END IF;
END $$;

-- Prioridades permitidas nas ordens de serviço
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_ordens_servico_prioridade') THEN
        ALTER TABLE public.ordens_servico
            ADD CONSTRAINT ck_ordens_servico_prioridade
            CHECK (prioridade IN ('Baixa', 'Normal', 'Alta', 'Urgente')) NOT VALID;
    END IF;
END $$;

-- Status permitidos nos relatórios diários
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_relatorios_diarios_status') THEN
        ALTER TABLE public.relatorios_diarios
            ADD CONSTRAINT ck_relatorios_diarios_status
            CHECK (status IN ('Rascunho', 'Enviado', 'Aprovado', 'Arquivado')) NOT VALID;
    END IF;
END $$;

-- Status permitidos nas saídas de viaturas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_saidas_viaturas_status') THEN
        ALTER TABLE public.saidas_viaturas
            ADD CONSTRAINT ck_saidas_viaturas_status
            CHECK (status IN ('em_operacao', 'finalizado')) NOT VALID;
    END IF;
END $$;

-- Km de chegada deve ser maior ou igual ao km de saída (quando preenchido)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_saidas_viaturas_km') THEN
        ALTER TABLE public.saidas_viaturas
            ADD CONSTRAINT ck_saidas_viaturas_km
            CHECK (km_chegada IS NULL OR km_chegada >= km_saida) NOT VALID;
    END IF;
END $$;

-- Litros de abastecimento deve ser positivo
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_abastecimentos_litros') THEN
        ALTER TABLE public.abastecimentos
            ADD CONSTRAINT ck_abastecimentos_litros
            CHECK (litros > 0) NOT VALID;
    END IF;
END $$;

-- ============================================================
-- 3. ÍNDICES ADICIONAIS (aceleram filtros do dashboard e CRUD)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_saidas_viaturas_status ON public.saidas_viaturas (status);
CREATE INDEX IF NOT EXISTS idx_saidas_viaturas_viatura ON public.saidas_viaturas (viatura);
CREATE INDEX IF NOT EXISTS idx_saidas_viaturas_data_saida ON public.saidas_viaturas (data_saida);

CREATE INDEX IF NOT EXISTS idx_abastecimentos_viatura ON public.abastecimentos (viatura);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_data ON public.abastecimentos (data_abastecimento);

CREATE INDEX IF NOT EXISTS idx_inspetores_nome ON public.inspetores (nome);
CREATE INDEX IF NOT EXISTS idx_viaturas_prefixo ON public.viaturas (prefixo);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios (email);

-- ============================================================
-- 4. ROW LEVEL SECURITY (padrão do projeto: liberado para testes)
-- ============================================================

ALTER TABLE public.viaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspetores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo - viaturas" ON public.viaturas;
CREATE POLICY "Permitir tudo - viaturas"
    ON public.viaturas FOR ALL
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo - usuarios" ON public.usuarios;
CREATE POLICY "Permitir tudo - usuarios"
    ON public.usuarios FOR ALL
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo - inspetores" ON public.inspetores;
CREATE POLICY "Permitir tudo - inspetores"
    ON public.inspetores FOR ALL
    USING (true) WITH CHECK (true);
