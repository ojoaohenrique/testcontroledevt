(function () {
    'use strict';

    // ===============================================================
    //  Modulo B.O. (Boletim de Ocorrencia) - Auto de Remocao de Veiculo
    //  Integracao com Supabase - tabela: boletins_ocorrencia
    //  Padrao GML (mesmo estilo de ordensServico.js / relatorioDiario.js)
    //
    //  Observacao: ocorrencias em geral ja sao controladas no SINESP CAD.
    //  Este modulo existe só para o B.O. (auto de remocao de veiculo) em
    //  si, para controle interno do sistema.
    // ===============================================================

    var ITENS_POR_PAGINA = 10;

    var estado = {
        registros: [],   // todos os boletins carregados
        filtrados: [],   // apos aplicar filtros
        pagina: 1,
        editandoId: null,
    };

    // ---------------------------------------------------------------
    // INICIALIZACAO
    // ---------------------------------------------------------------
    async function initBoletimOcorrencia() {
        console.log('Modulo B.O. (Auto de Remocao de Veiculo) inicializado.');

        preencherCombos();
        configurarEventos();
        aplicarValoresPadrao();
        await carregarBoletins();
    }

    function preencherCombos() {
        var dados = window.GML_DADOS || {};

        preencherSelect('agente_responsavel', dados.MOTORISTAS || []);
        preencherSelect('filtroAgente', dados.MOTORISTAS || []);
    }

    function aplicarValoresPadrao() {
        var campoData = document.getElementById('data_hora');
        if (campoData && !campoData.value) {
            var agora = new Date();
            var tzoffset = agora.getTimezoneOffset() * 60000;
            campoData.value = new Date(agora.getTime() - tzoffset).toISOString().slice(0, 16);
        }

        var campoPais = document.getElementById('veiculo_pais');
        if (campoPais && !campoPais.value) campoPais.value = 'BRASIL';

        var campoMedida = document.getElementById('medida_administrativa');
        if (campoMedida && !campoMedida.value) campoMedida.value = 'Recolhimento de Veículo.';

        var campoNumero = document.getElementById('numero_bo');
        if (campoNumero && !estado.editandoId) {
            campoNumero.value = '';
            campoNumero.placeholder = 'Gerado automaticamente ao salvar';
        }
    }

    function configurarEventos() {
        var form = document.getElementById('boletimForm');
        if (form) {
            form.addEventListener('submit', handleSalvar);
            form.addEventListener('reset', function () {
                setTimeout(function () {
                    limparEdicao();
                    aplicarValoresPadrao();
                }, 0);
            });
        }

        var btnCancelar = document.getElementById('btnCancelarEdicao');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', function () {
                document.getElementById('boletimForm').reset();
                limparEdicao();
                aplicarValoresPadrao();
            });
        }

        // Filtros
        ['filtroBusca', 'filtroData', 'filtroAgente'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var evento = el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input';
            el.addEventListener(evento, function () {
                estado.pagina = 1;
                aplicarFiltros();
            });
        });

        var btnLimpar = document.getElementById('btnLimparFiltros');
        if (btnLimpar) btnLimpar.addEventListener('click', limparFiltros);

        // Delegacao de clique nas acoes da tabela
        var tbody = document.getElementById('tabelaBoletinsBody');
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-acao]');
                if (!btn) return;
                var id = btn.dataset.id;
                var acao = btn.dataset.acao;

                if (acao === 'ver') abrirDetalhe(id);
                else if (acao === 'editar') iniciarEdicao(id);
                else if (acao === 'excluir') handleExcluir(id);
                else if (acao === 'pdf') gerarPdfBoletim(id);
            });
        }

        // Modal de detalhes
        var btnFechar = document.getElementById('detalheFecharBtn');
        if (btnFechar) btnFechar.addEventListener('click', fecharDetalhe);

        var modal = document.getElementById('detalheModal');
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === e.currentTarget) fecharDetalhe();
            });
        }
    }

    // ---------------------------------------------------------------
    // CARREGAR DADOS
    // ---------------------------------------------------------------
    async function carregarBoletins() {
        try {
            var supabase = getSupabase();
            var resultado = await supabase
                .from('boletins_ocorrencia')
                .select('*')
                .order('data_hora', { ascending: false })
                .limit(500);

            if (resultado.error) throw resultado.error;

            estado.registros = resultado.data || [];
            aplicarFiltros();
            atualizarContadores();
        } catch (err) {
            console.error('Erro ao carregar boletins de ocorrencia:', err);
            mostrarToast('Erro ao carregar boletins: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // FILTROS E BUSCA
    // ---------------------------------------------------------------
    function aplicarFiltros() {
        var termo = (valorDe('filtroBusca') || '').trim().toLowerCase();
        var data = valorDe('filtroData');
        var agente = valorDe('filtroAgente');

        estado.filtrados = estado.registros.filter(function (b) {
            if (agente && b.agente_responsavel !== agente) return false;
            if (data) {
                var dataRegistro = (b.data_hora || '').slice(0, 10);
                if (dataRegistro !== data) return false;
            }
            if (termo) {
                var alvo = [
                    b.numero_bo, b.local, b.local_complemento, b.veiculo_placa,
                    b.proprietario_nome, b.agente_responsavel, b.motivo_recolhimento,
                ].join(' ').toLowerCase();
                if (alvo.indexOf(termo) < 0) return false;
            }
            return true;
        });

        renderTabela();
    }

    function limparFiltros() {
        ['filtroBusca', 'filtroData', 'filtroAgente'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
        estado.pagina = 1;
        aplicarFiltros();
    }

    // ---------------------------------------------------------------
    // RENDERIZACAO DA TABELA
    // ---------------------------------------------------------------
    function renderTabela() {
        var tbody = document.getElementById('tabelaBoletinsBody');
        if (!tbody) return;

        var total = estado.filtrados.length;
        var totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
        if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;

        var pagina = paginarLista(estado.filtrados, estado.pagina, ITENS_POR_PAGINA);

        tbody.innerHTML = '';

        if (pagina.length === 0) {
            var vazio = document.createElement('tr');
            vazio.innerHTML = '<td colspan="7" style="text-align:center;padding:24px;">' +
                'Nenhum boletim encontrado.</td>';
            tbody.appendChild(vazio);
        } else {
            pagina.forEach(function (b) {
                tbody.appendChild(criarLinha(b));
            });
        }

        criarPaginacao('paginacaoBoletins', total, estado.pagina, ITENS_POR_PAGINA,
            function (novaPagina) {
                estado.pagina = novaPagina;
                renderTabela();
            });
    }

    function criarLinha(b) {
        var tr = document.createElement('tr');
        tr.dataset.id = b.id;

        tr.innerHTML =
            '<td><strong>' + escapar(b.numero_bo) + '</strong></td>' +
            '<td>' + escapar(formatarDataHora(b.data_hora)) + '</td>' +
            '<td>' + escapar(b.local) + '</td>' +
            '<td>' + escapar(b.veiculo_placa) + '</td>' +
            '<td>' + escapar(b.proprietario_nome || '-') + '</td>' +
            '<td>' + escapar(b.agente_responsavel) + '</td>' +
            '<td><div class="acoes-tabela">' +
            '  <button type="button" class="btn btn-info" data-acao="ver" data-id="' + b.id + '">Ver</button>' +
            '  <button type="button" class="btn btn-warning" data-acao="editar" data-id="' + b.id + '">Editar</button>' +
            '  <button type="button" class="btn btn-secondary" data-acao="pdf" data-id="' + b.id + '">PDF</button>' +
            '  <button type="button" class="btn btn-danger" data-acao="excluir" data-id="' + b.id + '">Excluir</button>' +
            '</div></td>';

        return tr;
    }

    function atualizarContadores() {
        definirTexto('contadorBoletins', estado.registros.length);
    }

    function definirTexto(id, valor) {
        var el = document.getElementById(id);
        if (el) el.textContent = valor;
    }

    // ---------------------------------------------------------------
    // CRIAR / EDITAR
    // ---------------------------------------------------------------
    async function handleSalvar(event) {
        event.preventDefault();

        var btn = document.getElementById('btnSalvar');
        var erroEl = document.getElementById('formErro');
        erroEl.style.display = 'none';

        var payload = montarPayload();
        var erro = validar(payload);

        if (erro) {
            erroEl.textContent = erro;
            erroEl.style.display = 'block';
            mostrarToast(erro, 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Salvando...';

        try {
            var supabase = getSupabase();
            var resultado;

            if (estado.editandoId) {
                resultado = await supabase
                    .from('boletins_ocorrencia')
                    .update(payload)
                    .eq('id', estado.editandoId)
                    .select()
                    .single();
            } else {
                // numero_bo nao e enviado na criacao: o banco gera sozinho
                // o proximo numero sequencial do ano via trigger.
                resultado = await supabase
                    .from('boletins_ocorrencia')
                    .insert([payload])
                    .select()
                    .single();
            }

            if (resultado.error) throw resultado.error;

            mostrarToast(estado.editandoId
                ? 'Boletim ' + (resultado.data.numero_bo || '') + ' atualizado com sucesso!'
                : 'Boletim ' + (resultado.data.numero_bo || '') + ' registrado com sucesso!', 'success');

            document.getElementById('boletimForm').reset();
            limparEdicao();
            aplicarValoresPadrao();
            await carregarBoletins();
        } catch (err) {
            console.error('Erro ao salvar boletim de ocorrencia:', err);
            erroEl.textContent = 'Erro ao salvar: ' + err.message;
            erroEl.style.display = 'block';
            mostrarToast('Erro ao salvar boletim: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = estado.editandoId ? 'Atualizar B.O.' : 'Salvar B.O.';
        }
    }

    function montarPayload() {
        return {
            data_hora: paraTimestamp(valorDe('data_hora')),
            local: textoOuNulo(valorDe('local')),
            local_complemento: textoOuNulo(valorDe('local_complemento')),

            motivo_recolhimento: textoOuNulo(valorDe('motivo_recolhimento')),
            infracao: textoOuNulo(valorDe('infracao')),
            ait_numero: textoOuNulo(valorDe('ait_numero')),
            medida_administrativa: textoOuNulo(valorDe('medida_administrativa')),

            veiculo_placa: textoOuNulo(valorDe('veiculo_placa')),
            veiculo_pais: textoOuNulo(valorDe('veiculo_pais')),
            veiculo_especie: textoOuNulo(valorDe('veiculo_especie')),
            veiculo_tipo: textoOuNulo(valorDe('veiculo_tipo')),
            veiculo_marca_modelo: textoOuNulo(valorDe('veiculo_marca_modelo')),
            veiculo_uf: textoOuNulo(valorDe('veiculo_uf')),
            veiculo_municipio: textoOuNulo(valorDe('veiculo_municipio')),
            veiculo_categoria: textoOuNulo(valorDe('veiculo_categoria')),
            veiculo_lugares: textoOuNulo(valorDe('veiculo_lugares')),
            veiculo_chassi: textoOuNulo(valorDe('veiculo_chassi')),
            veiculo_renavam: textoOuNulo(valorDe('veiculo_renavam')),

            proprietario_nome: textoOuNulo(valorDe('proprietario_nome')),
            proprietario_cpf: textoOuNulo(valorDe('proprietario_cpf')),
            proprietario_rg: textoOuNulo(valorDe('proprietario_rg')),
            proprietario_cnh: textoOuNulo(valorDe('proprietario_cnh')),
            situacao_condutor: textoOuNulo(valorDe('situacao_condutor')),

            avarias: textoOuNulo(valorDe('avarias')),
            pneus: textoOuNulo(valorDe('pneus')),
            combustivel_nivel: textoOuNulo(valorDe('combustivel_nivel')),
            odometro: valorDe('odometro') === '' ? null : Number(valorDe('odometro')),
            equipamento: textoOuNulo(valorDe('equipamento')),
            informacoes_complementares: textoOuNulo(valorDe('informacoes_complementares')),
            observacoes: textoOuNulo(valorDe('observacoes')),

            guinchado: valorDe('guinchado'),
            empresa_guincho: textoOuNulo(valorDe('empresa_guincho')),
            motorista_guincho: textoOuNulo(valorDe('motorista_guincho')),

            agente_responsavel: textoOuNulo(valorDe('agente_responsavel')),
            matricula_agente: textoOuNulo(valorDe('matricula_agente')),
            assinatura: textoOuNulo(valorDe('assinatura')),
        };
    }

    // ---------------------------------------------------------------
    // VALIDACAO (impede registros incompletos)
    // ---------------------------------------------------------------
    function validar(p) {
        if (!p.data_hora) return 'Informe a data e hora do boletim.';
        if (!p.local) return 'Informe o local.';
        if (!p.motivo_recolhimento) return 'Informe o motivo do recolhimento.';
        if (!p.veiculo_placa) return 'Informe a placa do veículo.';
        if (!p.guinchado) return 'Informe se o veículo foi guinchado.';
        if (!p.agente_responsavel) return 'Selecione o agente responsável.';
        return null;
    }

    function iniciarEdicao(id) {
        var b = estado.registros.find(function (item) { return item.id === id; });
        if (!b) return;

        estado.editandoId = id;

        definirValor('boletimId', b.id);
        definirValor('numero_bo', b.numero_bo || '');
        definirValor('data_hora', paraDateTimeLocal(b.data_hora));
        definirValor('local', b.local || '');
        definirValor('local_complemento', b.local_complemento || '');

        definirValor('motivo_recolhimento', b.motivo_recolhimento || '');
        definirValor('infracao', b.infracao || '');
        definirValor('ait_numero', b.ait_numero || '');
        definirValor('medida_administrativa', b.medida_administrativa || '');

        definirValor('veiculo_placa', b.veiculo_placa || '');
        definirValor('veiculo_pais', b.veiculo_pais || '');
        definirValor('veiculo_especie', b.veiculo_especie || '');
        definirValor('veiculo_tipo', b.veiculo_tipo || '');
        definirValor('veiculo_marca_modelo', b.veiculo_marca_modelo || '');
        definirValor('veiculo_uf', b.veiculo_uf || '');
        definirValor('veiculo_municipio', b.veiculo_municipio || '');
        definirValor('veiculo_categoria', b.veiculo_categoria || '');
        definirValor('veiculo_lugares', b.veiculo_lugares || '');
        definirValor('veiculo_chassi', b.veiculo_chassi || '');
        definirValor('veiculo_renavam', b.veiculo_renavam || '');

        definirValor('proprietario_nome', b.proprietario_nome || '');
        definirValor('proprietario_cpf', b.proprietario_cpf || '');
        definirValor('proprietario_rg', b.proprietario_rg || '');
        definirValor('proprietario_cnh', b.proprietario_cnh || '');
        definirValor('situacao_condutor', b.situacao_condutor || '');

        definirValor('avarias', b.avarias || '');
        definirValor('pneus', b.pneus || '');
        definirValor('combustivel_nivel', b.combustivel_nivel || '');
        definirValor('odometro', b.odometro === null || b.odometro === undefined ? '' : b.odometro);
        definirValor('equipamento', b.equipamento || '');
        definirValor('informacoes_complementares', b.informacoes_complementares || '');
        definirValor('observacoes', b.observacoes || '');

        definirValor('guinchado', b.guinchado || '');
        definirValor('empresa_guincho', b.empresa_guincho || '');
        definirValor('motorista_guincho', b.motorista_guincho || '');

        definirValor('agente_responsavel', b.agente_responsavel || '');
        definirValor('matricula_agente', b.matricula_agente || '');
        definirValor('assinatura', b.assinatura || '');

        document.getElementById('formTitulo').textContent =
            'Editando B.O. ' + (b.numero_bo || '');
        document.getElementById('btnSalvar').textContent = 'Atualizar B.O.';
        document.getElementById('btnCancelarEdicao').style.display = 'inline-block';

        document.getElementById('boletimForm')
            .scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function limparEdicao() {
        estado.editandoId = null;
        definirValor('boletimId', '');
        definirValor('numero_bo', '');
        document.getElementById('formTitulo').textContent = 'Novo Boletim de Ocorrência';
        document.getElementById('btnSalvar').textContent = 'Salvar B.O.';
        document.getElementById('btnCancelarEdicao').style.display = 'none';
        var erroEl = document.getElementById('formErro');
        if (erroEl) erroEl.style.display = 'none';
    }

    // ---------------------------------------------------------------
    // EXCLUIR
    // ---------------------------------------------------------------
    async function handleExcluir(id) {
        var b = estado.registros.find(function (item) { return item.id === id; });
        if (!b) return;

        var confirmado = confirmarExclusao(
            'Deseja realmente excluir o B.O. ' + (b.numero_bo || '') +
            '? Esta ação não pode ser desfeita.'
        );
        if (!confirmado) return;

        try {
            var supabase = getSupabase();
            var resultado = await supabase
                .from('boletins_ocorrencia')
                .delete()
                .eq('id', id);

            if (resultado.error) throw resultado.error;

            if (estado.editandoId === id) {
                document.getElementById('boletimForm').reset();
                limparEdicao();
                aplicarValoresPadrao();
            }

            mostrarToast('Boletim excluído com sucesso!', 'success');
            await carregarBoletins();
        } catch (err) {
            console.error('Erro ao excluir boletim de ocorrencia:', err);
            mostrarToast('Erro ao excluir boletim: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // VISUALIZACAO DETALHADA
    // ---------------------------------------------------------------
    function abrirDetalhe(id) {
        var b = estado.registros.find(function (item) { return item.id === id; });
        if (!b) return;

        var conteudo = document.getElementById('detalheConteudo');

        conteudo.innerHTML =
            '<div class="detalhe-grid">' +
            item('Número do B.O.', b.numero_bo) +
            item('Data/Hora', formatarDataHora(b.data_hora)) +
            item('Local', b.local) +
            item('Complemento', b.local_complemento || '-') +
            item('Motivo do recolhimento', b.motivo_recolhimento) +
            item('Infração', b.infracao || '-') +
            item('AIT Nº', b.ait_numero || '-') +
            item('Medida administrativa', b.medida_administrativa || '-') +
            item('Placa', b.veiculo_placa) +
            item('Marca/Modelo', b.veiculo_marca_modelo || '-') +
            item('UF/Município', (b.veiculo_uf || '-') + ' / ' + (b.veiculo_municipio || '-')) +
            item('Chassi', b.veiculo_chassi || '-') +
            item('Renavam', b.veiculo_renavam || '-') +
            item('Proprietário', b.proprietario_nome || '-') +
            item('CPF/RG', (b.proprietario_cpf || '-') + ' / ' + (b.proprietario_rg || '-')) +
            item('Situação do condutor', b.situacao_condutor || '-') +
            item('Pneus', b.pneus || '-') +
            item('Combustível', b.combustivel_nivel || '-') +
            item('Odômetro', b.odometro === null || b.odometro === undefined ? '-' : b.odometro) +
            item('Guinchado', b.guinchado) +
            item('Empresa do guincho', b.empresa_guincho || '-') +
            item('Motorista do guincho', b.motorista_guincho || '-') +
            item('Agente responsável', b.agente_responsavel) +
            item('Matrícula', b.matricula_agente || '-') +
            item('Assinatura', b.assinatura || '-') +
            '</div>' +
            bloco('Avarias', b.avarias) +
            bloco('Informações complementares', b.informacoes_complementares) +
            bloco('Observações', b.observacoes);

        var btnPdf = document.getElementById('detalhePdfBtn');
        btnPdf.onclick = function () { gerarPdfBoletim(id); };

        document.getElementById('detalheModal').style.display = 'flex';
    }

    function fecharDetalhe() {
        document.getElementById('detalheModal').style.display = 'none';
    }

    function item(label, valor) {
        return '<div class="detalhe-item"><label>' + escapar(label) + '</label>' +
            '<p>' + escapar(valor) + '</p></div>';
    }

    function bloco(titulo, texto) {
        return '<h4 style="margin:12px 0 6px;color:#0056b3;">' + escapar(titulo) + '</h4>' +
            '<div class="detalhe-texto">' + escapar(texto) + '</div>';
    }

    // ---------------------------------------------------------------
    // PDF
    // ---------------------------------------------------------------
    function gerarPdfBoletim(id) {
        var b = estado.registros.find(function (item) { return item.id === id; });
        if (!b || !window.GML_PDF) return;

        var corpo =
            '<div class="pdf-secao"><h2>Identificação do Boletim</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Número do B.O.', valor: b.numero_bo },
                { label: 'Data/Hora', valor: formatarDataHora(b.data_hora) },
                { label: 'Local', valor: b.local },
                { label: 'Complemento', valor: b.local_complemento || '-' },
            ]) + '</div>' +
            '<div class="pdf-secao"><h2>Motivo do Recolhimento</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Motivo', valor: b.motivo_recolhimento },
                { label: 'Infração', valor: b.infracao || '-' },
                { label: 'AIT Nº', valor: b.ait_numero || '-' },
                { label: 'Medida administrativa', valor: b.medida_administrativa || '-' },
            ]) + '</div>' +
            '<div class="pdf-secao"><h2>Identificação do Veículo</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Placa', valor: b.veiculo_placa },
                { label: 'País', valor: b.veiculo_pais || '-' },
                { label: 'Espécie', valor: b.veiculo_especie || '-' },
                { label: 'Tipo', valor: b.veiculo_tipo || '-' },
                { label: 'Marca/Modelo', valor: b.veiculo_marca_modelo || '-' },
                { label: 'UF', valor: b.veiculo_uf || '-' },
                { label: 'Município', valor: b.veiculo_municipio || '-' },
                { label: 'Categoria', valor: b.veiculo_categoria || '-' },
                { label: 'Lugares', valor: b.veiculo_lugares || '-' },
                { label: 'Chassi', valor: b.veiculo_chassi || '-' },
                { label: 'Renavam', valor: b.veiculo_renavam || '-' },
            ]) + '</div>' +
            '<div class="pdf-secao"><h2>Identificação do Proprietário</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Nome', valor: b.proprietario_nome || '-' },
                { label: 'CPF', valor: b.proprietario_cpf || '-' },
                { label: 'RG', valor: b.proprietario_rg || '-' },
                { label: 'CNH', valor: b.proprietario_cnh || '-' },
                { label: 'Situação do condutor', valor: b.situacao_condutor || '-' },
            ]) + '</div>' +
            '<div class="pdf-secao"><h2>Condições do Veículo</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Pneus', valor: b.pneus || '-' },
                { label: 'Combustível', valor: b.combustivel_nivel || '-' },
                { label: 'Odômetro', valor: b.odometro === null || b.odometro === undefined ? '-' : b.odometro },
                { label: 'Equipamento', valor: b.equipamento || '-' },
            ]) + '</div>' +
            GML_PDF.blocoTexto('Avarias', b.avarias) +
            GML_PDF.blocoTexto('Informações complementares', b.informacoes_complementares) +
            GML_PDF.blocoTexto('Observações', b.observacoes) +
            '<div class="pdf-secao"><h2>Transporte do Veículo</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Guinchado', valor: b.guinchado },
                { label: 'Empresa', valor: b.empresa_guincho || '-' },
                { label: 'Motorista', valor: b.motorista_guincho || '-' },
            ]) + '</div>' +
            '<div class="pdf-secao"><h2>Agente Responsável</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Agente responsável', valor: b.agente_responsavel },
                { label: 'Matrícula', valor: b.matricula_agente || '-' },
            ]) + '</div>';

        GML_PDF.gerar({
            titulo: 'BOLETIM DE OCORRÊNCIA - AUTO DE REMOÇÃO DE VEÍCULO',
            subtitulo: 'Nº ' + (b.numero_bo || ''),
            corpo: corpo,
            assinaturas: [
                b.assinatura || b.agente_responsavel || 'Agente responsável',
            ],
        });
    }

    // ---------------------------------------------------------------
    // AUXILIARES
    // ---------------------------------------------------------------
    function valorDe(id) {
        var el = document.getElementById(id);
        return el ? el.value : '';
    }

    function definirValor(id, valor) {
        var el = document.getElementById(id);
        if (el) el.value = valor === null || valor === undefined ? '' : valor;
    }

    function textoOuNulo(valor) {
        var t = (valor || '').trim();
        return t === '' ? null : t;
    }

    // Converte "YYYY-MM-DDTHH:MM" (datetime-local) em timestamp ISO (UTC)
    function paraTimestamp(valor) {
        if (!valor) return null;
        var d = new Date(valor);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }

    // Converte timestamp ISO do banco em valor aceito por input datetime-local
    function paraDateTimeLocal(valor) {
        if (!valor) return '';
        var d = new Date(valor);
        if (isNaN(d.getTime())) return '';
        var tzoffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
    }

    function escapar(valor) {
        if (valor === null || valor === undefined || valor === '') return '-';
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    window.initBoletimOcorrencia = initBoletimOcorrencia;
})();
