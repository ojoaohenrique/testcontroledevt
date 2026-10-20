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
