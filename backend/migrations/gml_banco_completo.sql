-- ================================================================
-- GML - BANCO COMPLETO (instalação ou atualização)
-- Rodar UMA vez no Supabase: SQL Editor > New query > colar > Run.
--
-- SEGURO para um banco que já tem dados:
--   * não apaga tabelas, colunas nem registros;
--   * cria só o que falta e completa colunas de tabelas antigas;
--   * pode ser rodado mais de uma vez sem erro.
-- ================================================================

-- Tudo numa transação: se der qualquer erro, NADA é aplicado.
BEGIN;


-- ============================================================
-- BASE: saídas de viaturas e abastecimentos (SEM apagar nada)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saidas_viaturas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viatura         TEXT NOT NULL,
    km_saida        NUMERIC NOT NULL,
    km_chegada      NUMERIC,
    km_rodado       NUMERIC,
    protocolo       INTEGER,
    inspetor        TEXT,
    motorista       TEXT NOT NULL,
    patrulheiro     TEXT,
    patrulhamento   TEXT,
    status          TEXT NOT NULL DEFAULT 'em_operacao',
    observacoes     TEXT,
    fotos           TEXT[],
    data_saida      TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_chegada    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Se a tabela já existia numa versão antiga, completa as colunas
ALTER TABLE public.saidas_viaturas
    ADD COLUMN IF NOT EXISTS km_chegada    NUMERIC,
    ADD COLUMN IF NOT EXISTS km_rodado     NUMERIC,
    ADD COLUMN IF NOT EXISTS protocolo     INTEGER,
    ADD COLUMN IF NOT EXISTS inspetor      TEXT,
    ADD COLUMN IF NOT EXISTS patrulheiro   TEXT,
    ADD COLUMN IF NOT EXISTS patrulhamento TEXT,
    ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'em_operacao',
    ADD COLUMN IF NOT EXISTS observacoes   TEXT,
    ADD COLUMN IF NOT EXISTS fotos         TEXT[],
    ADD COLUMN IF NOT EXISTS data_saida    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS data_chegada  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.abastecimentos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viatura             TEXT NOT NULL,
    data_abastecimento  TIMESTAMPTZ NOT NULL,
    km_abastecimento    NUMERIC NOT NULL,
    km_atual            NUMERIC NOT NULL,
    litros              NUMERIC NOT NULL,
    km_rodado           NUMERIC,
    media_km_l          NUMERIC,
    motorista           TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.abastecimentos
    ADD COLUMN IF NOT EXISTS km_rodado  NUMERIC,
    ADD COLUMN IF NOT EXISTS media_km_l NUMERIC,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.saidas_viaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abastecimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo - saidas" ON public.saidas_viaturas;
CREATE POLICY "Permitir tudo - saidas"
    ON public.saidas_viaturas FOR ALL
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo - abastecimentos" ON public.abastecimentos;
CREATE POLICY "Permitir tudo - abastecimentos"
    ON public.abastecimentos FOR ALL
    USING (true) WITH CHECK (true);


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

-- Se a tabela já existia numa versão antiga, completa as colunas
ALTER TABLE public.ordens_servico
    ADD COLUMN IF NOT EXISTS numero_ordem      TEXT,
    ADD COLUMN IF NOT EXISTS data              DATE,
    ADD COLUMN IF NOT EXISTS hora              TIME,
    ADD COLUMN IF NOT EXISTS solicitante       TEXT,
    ADD COLUMN IF NOT EXISTS setor             TEXT,
    ADD COLUMN IF NOT EXISTS prioridade        TEXT NOT NULL DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'Aberta',
    ADD COLUMN IF NOT EXISTS viatura           TEXT,
    ADD COLUMN IF NOT EXISTS motorista         TEXT,
    ADD COLUMN IF NOT EXISTS equipe            TEXT,
    ADD COLUMN IF NOT EXISTS tipo_servico      TEXT,
    ADD COLUMN IF NOT EXISTS descricao         TEXT,
    ADD COLUMN IF NOT EXISTS local             TEXT,
    ADD COLUMN IF NOT EXISTS data_hora_inicio  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS data_hora_termino TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resultado         TEXT,
    ADD COLUMN IF NOT EXISTS observacoes       TEXT,
    ADD COLUMN IF NOT EXISTS assinatura        TEXT,
    ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();

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

-- Se a tabela já existia numa versão antiga, completa as colunas
ALTER TABLE public.relatorios_diarios
    ADD COLUMN IF NOT EXISTS data                      DATE,
    ADD COLUMN IF NOT EXISTS turno                     TEXT,
    ADD COLUMN IF NOT EXISTS equipe                    TEXT,
    ADD COLUMN IF NOT EXISTS responsavel               TEXT,
    ADD COLUMN IF NOT EXISTS motoristas                TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS viaturas_utilizadas       TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS km_inicial                NUMERIC,
    ADD COLUMN IF NOT EXISTS km_final                  NUMERIC,
    ADD COLUMN IF NOT EXISTS bairros_patrulhados       TEXT,
    ADD COLUMN IF NOT EXISTS ocorrencias_atendidas     TEXT,
    ADD COLUMN IF NOT EXISTS atividades_realizadas     TEXT,
    ADD COLUMN IF NOT EXISTS materiais_utilizados      TEXT,
    ADD COLUMN IF NOT EXISTS alteracoes_viaturas       TEXT,
    ADD COLUMN IF NOT EXISTS abastecimentos_realizados TEXT,
    ADD COLUMN IF NOT EXISTS observacoes               TEXT,
    ADD COLUMN IF NOT EXISTS status                    TEXT NOT NULL DEFAULT 'Rascunho',
    ADD COLUMN IF NOT EXISTS assinatura_responsavel    TEXT,
    ADD COLUMN IF NOT EXISTS ordem_servico_id          UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMPTZ NOT NULL DEFAULT now();

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


-- Migration 007: Boletins de Ocorrência (B.O.) - Auto de Remoção de Veículo
-- Executar no Supabase SQL Editor APÓS as migrations 002, 003, 004, 005 e 006.
-- NÃO remove tabelas ou colunas existentes.
--
-- Cria a tabela de Boletins de Ocorrência (B.O.) usada para registrar os
-- Autos de Remoção/Recolhimento de Veículo da Guarda Municipal. Ocorrências
-- em geral já são controladas no SINESP CAD e não são duplicadas aqui --
-- este módulo é só para o B.O. (remoção de veículo) em si, para controle
-- interno do sistema.

CREATE TABLE IF NOT EXISTS public.boletins_ocorrencia (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_bo                   TEXT UNIQUE,
    data_hora                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    local                       TEXT NOT NULL,
    local_complemento           TEXT,

    -- Motivo do recolhimento
    motivo_recolhimento         TEXT NOT NULL,
    infracao                    TEXT,
    ait_numero                  TEXT,
    medida_administrativa       TEXT,

    -- Identificação do veículo
    veiculo_placa               TEXT NOT NULL,
    veiculo_pais                TEXT DEFAULT 'BRASIL',
    veiculo_especie             TEXT,
    veiculo_tipo                TEXT,
    veiculo_marca_modelo        TEXT,
    veiculo_uf                  TEXT,
    veiculo_municipio           TEXT,
    veiculo_categoria           TEXT,
    veiculo_lugares             TEXT,
    veiculo_chassi              TEXT,
    veiculo_renavam             TEXT,

    -- Identificação do proprietário
    proprietario_nome           TEXT,
    proprietario_cpf            TEXT,
    proprietario_rg              TEXT,
    proprietario_cnh             TEXT,
    situacao_condutor           TEXT,

    -- Condições do veículo
    avarias                     TEXT,
    pneus                       TEXT,
    combustivel_nivel           TEXT,
    odometro                    NUMERIC,
    equipamento                 TEXT,
    informacoes_complementares  TEXT,
    observacoes                 TEXT,

    -- Transporte do veículo
    guinchado                   TEXT,
    empresa_guincho              TEXT,
    motorista_guincho           TEXT,

    -- Agente responsável
    agente_responsavel           TEXT NOT NULL,
    matricula_agente            TEXT,
    assinatura                  TEXT,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contador auxiliar para gerar o número sequencial do B.O. por ano (ex: 009/2026)
CREATE TABLE IF NOT EXISTS public.boletins_ocorrencia_contador (
    ano     INTEGER PRIMARY KEY,
    ultimo  INTEGER NOT NULL DEFAULT 0
);

-- Gera o número sequencial do B.O. automaticamente, se não vier preenchido
CREATE OR REPLACE FUNCTION public.gerar_numero_bo()
RETURNS TRIGGER AS $$
DECLARE
    ano_atual INTEGER := EXTRACT(YEAR FROM (COALESCE(NEW.data_hora, now()) AT TIME ZONE 'America/Sao_Paulo'));
    proximo   INTEGER;
BEGIN
    IF NEW.numero_bo IS NOT NULL AND NEW.numero_bo <> '' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.boletins_ocorrencia_contador (ano, ultimo)
        VALUES (ano_atual, 1)
        ON CONFLICT (ano) DO UPDATE
        SET ultimo = public.boletins_ocorrencia_contador.ultimo + 1
        RETURNING ultimo INTO proximo;

    NEW.numero_bo := LPAD(proximo::TEXT, 3, '0') || '/' || ano_atual::TEXT;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_numero_bo ON public.boletins_ocorrencia;
CREATE TRIGGER trg_gerar_numero_bo
    BEFORE INSERT ON public.boletins_ocorrencia
    FOR EACH ROW
    EXECUTE FUNCTION public.gerar_numero_bo();

-- updated_at automático
CREATE OR REPLACE FUNCTION public.atualizar_updated_at_boletins()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_boletins_updated_at ON public.boletins_ocorrencia;
CREATE TRIGGER trg_boletins_updated_at
    BEFORE UPDATE ON public.boletins_ocorrencia
    FOR EACH ROW
    EXECUTE FUNCTION public.atualizar_updated_at_boletins();

-- RLS liberado para testes, no mesmo padrão dos demais módulos do sistema
ALTER TABLE public.boletins_ocorrencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo - boletins_ocorrencia" ON public.boletins_ocorrencia;
CREATE POLICY "Permitir tudo - boletins_ocorrencia"
    ON public.boletins_ocorrencia FOR ALL
    USING (true) WITH CHECK (true);


-- Migration 008: Horário de início e término no Relatório Diário
-- Executar no Supabase SQL Editor ANTES de publicar a nova versão do site.
-- Pode ser executada mais de uma vez sem erro.

ALTER TABLE public.relatorios_diarios
    ADD COLUMN IF NOT EXISTS hora_inicio  TIME,
    ADD COLUMN IF NOT EXISTS hora_termino TIME;


-- Migration 009: Dados do condutor no B.O. (separados do proprietário)
-- Executar no Supabase SQL Editor ANTES de publicar a nova versão do site.
-- Pode ser executada mais de uma vez sem erro.

ALTER TABLE public.boletins_ocorrencia
    ADD COLUMN IF NOT EXISTS condutor_mesmo_proprietario BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS condutor_nome TEXT,
    ADD COLUMN IF NOT EXISTS condutor_cpf  TEXT,
    ADD COLUMN IF NOT EXISTS condutor_rg   TEXT,
    ADD COLUMN IF NOT EXISTS condutor_cnh  TEXT;


-- Correção: numeração do A.R.V.C roda com permissão do dono do banco
-- (evita o erro "new row violates row-level security policy")
CREATE OR REPLACE FUNCTION public.gerar_numero_bo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ano_atual INTEGER := EXTRACT(YEAR FROM (COALESCE(NEW.data_hora, now()) AT TIME ZONE 'America/Sao_Paulo'));
    proximo INTEGER;
BEGIN
    IF NEW.numero_bo IS NOT NULL AND NEW.numero_bo <> '' THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.boletins_ocorrencia_contador (ano, ultimo)
        VALUES (ano_atual, 1)
        ON CONFLICT (ano) DO UPDATE
        SET ultimo = public.boletins_ocorrencia_contador.ultimo + 1
        RETURNING ultimo INTO proximo;
    NEW.numero_bo := LPAD(proximo::TEXT, 3, '0') || '/' || ano_atual::TEXT;
    RETURN NEW;
END;
$$;

ALTER TABLE public.boletins_ocorrencia_contador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo - boletins_ocorrencia" ON public.boletins_ocorrencia;
CREATE POLICY "Permitir tudo - boletins_ocorrencia"
    ON public.boletins_ocorrencia FOR ALL
    TO anon, authenticated
    USING (true) WITH CHECK (true);


-- Migration 010: Fotos no B.O.
-- Executar no Supabase SQL Editor ANTES de publicar a nova versão do site.
-- Pode ser executada mais de uma vez sem erro.

-- Lista de fotos do B.O.: [{ "path": "fotos/<id>.jpg", "nome": "IMG_123.jpg" }]
ALTER TABLE public.boletins_ocorrencia
    ADD COLUMN IF NOT EXISTS fotos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Pasta (bucket) privada para guardar as fotos, limite de 10 MB por arquivo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bo-fotos', 'bo-fotos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Acesso às fotos (mesmo padrão liberado dos demais módulos em teste)
DROP POLICY IF EXISTS "bo-fotos ler" ON storage.objects;
CREATE POLICY "bo-fotos ler" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'bo-fotos');

DROP POLICY IF EXISTS "bo-fotos enviar" ON storage.objects;
CREATE POLICY "bo-fotos enviar" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'bo-fotos');

DROP POLICY IF EXISTS "bo-fotos apagar" ON storage.objects;
CREATE POLICY "bo-fotos apagar" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = 'bo-fotos');


-- Atualiza o cache da API para enxergar as tabelas e colunas novas
NOTIFY pgrst, 'reload schema';

COMMIT;
