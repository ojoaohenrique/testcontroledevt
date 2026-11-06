(function () {
    'use strict';

    // ===============================================================
    //  Modulo Ordens de Servico
    //  Integracao com Supabase - tabela: ordens_servico
    //  Padrao GML (mesmo estilo de relatorioDiario.js / dashboard.js)
    // ===============================================================

    var ITENS_POR_PAGINA = 10;

    var estado = {
        registros: [],   // todas as ordens carregadas
        filtrados: [],   // apos aplicar filtros
        pagina: 1,
        editandoId: null,
        statusAtual: null, // status da ordem em edicao (o campo Status saiu do formulario)
    };

    // ---------------------------------------------------------------
    // INICIALIZACAO
    // ---------------------------------------------------------------
    async function initOrdensServico() {
        console.log('Modulo Ordens de Servico inicializado.');

        preencherCombos();
        configurarEventos();
        aplicarValoresPadrao();
        await carregarOrdens();
    }

    function preencherCombos() {
        var dados = window.GML_DADOS || {};

        preencherSelect('prioridade', dados.PRIORIDADES || []);
        preencherSelect('viatura', dados.VIATURAS || []);
        preencherSelect('equipe', dados.EQUIPES || []);
        preencherSelect('tipo_servico', dados.TIPOS_SERVICO || []);

        // Filtros
        preencherSelect('filtroStatus', dados.STATUS_ORDEM || []);
        preencherSelect('filtroEquipe', dados.EQUIPES || []);
        preencherSelect('filtroViatura', dados.VIATURAS || []);
    }

    function aplicarValoresPadrao() {
        var campoNumero = document.getElementById('numero_ordem');
        if (campoNumero && !campoNumero.value) campoNumero.value = gerarNumeroOrdem();

        // Pré-preenche Data e Horário de início com o momento atual.
        var agoraLocal = dataHoraLocalAgora();
        var campoData = document.getElementById('data_ordem');
        if (campoData && !campoData.value) campoData.value = agoraLocal.slice(0, 10);

        var campoInicio = document.getElementById('hora_inicio');
        if (campoInicio && !campoInicio.value) campoInicio.value = agoraLocal.slice(11, 16);

        atualizarBotaoFinalizar();
    }

    // "YYYY-MM-DDTHH:MM" no horario local do aparelho
    function dataHoraLocalAgora() {
        var agora = new Date();
        var tzoffset = agora.getTimezoneOffset() * 60000;
        return new Date(agora.getTime() - tzoffset).toISOString().slice(0, 16);
    }

    // O botao Finalizar so aparece enquanto a ordem ainda nao foi concluida/cancelada
    function atualizarBotaoFinalizar() {
        var btn = document.getElementById('btnFinalizar');
        if (!btn) return;
        var encerrada = estado.statusAtual === 'Concluída' || estado.statusAtual === 'Cancelada';
        btn.style.display = encerrada ? 'none' : 'inline-block';
    }

    function configurarEventos() {
        var form = document.getElementById('ordemForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                salvarOrdem(false);
            });
            form.addEventListener('reset', function () {
                setTimeout(function () {
                    limparEdicao();
                    aplicarValoresPadrao();
                }, 0);
            });
        }

        var btnFinalizar = document.getElementById('btnFinalizar');
        if (btnFinalizar) {
            btnFinalizar.addEventListener('click', function () {
                // Sem horario de termino informado, usa o horario atual
                var campoTermino = document.getElementById('hora_termino');
                if (campoTermino && !campoTermino.value) {
                    campoTermino.value = dataHoraLocalAgora().slice(11, 16);
                }
                if (!confirmarExclusao('Finalizar esta ordem de serviço? Ela será marcada como Concluída.')) return;
                salvarOrdem(true);
            });
        }

        var btnCancelar = document.getElementById('btnCancelarEdicao');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', function () {
                document.getElementById('ordemForm').reset();
                limparEdicao();
                aplicarValoresPadrao();
            });
        }

        // Filtros
        ['filtroBusca', 'filtroStatus', 'filtroData', 'filtroEquipe', 'filtroViatura']
            .forEach(function (id) {
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
        var tbody = document.getElementById('tabelaOrdensBody');
        if (tbody) {
            tbody.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-acao]');
                if (!btn) return;
                var id = btn.dataset.id;
                var acao = btn.dataset.acao;

                if (acao === 'ver') abrirDetalhe(id);
                else if (acao === 'editar') iniciarEdicao(id);
                else if (acao === 'excluir') handleExcluir(id);
                else if (acao === 'pdf') gerarPdfOrdem(id);
                else if (acao === 'relatorio') gerarRelatorioDiario(id);
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
    async function carregarOrdens() {
        try {
            var supabase = getSupabase();
            var resultado = await supabase
                .from('ordens_servico')
                .select('*')
                .order('data', { ascending: false })
                .order('hora', { ascending: false })
                .limit(500);

            if (resultado.error) throw resultado.error;

            estado.registros = resultado.data || [];
            aplicarFiltros();
            atualizarContadores();
        } catch (err) {
            console.error('Erro ao carregar ordens de servico:', err);
            mostrarToast('Erro ao carregar ordens de serviço: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // FILTROS E BUSCA
    // ---------------------------------------------------------------
    function aplicarFiltros() {
        var termo = (valorDe('filtroBusca') || '').trim().toLowerCase();
        var status = valorDe('filtroStatus');
        var data = valorDe('filtroData');
        var equipe = valorDe('filtroEquipe');
        var viatura = valorDe('filtroViatura');

        estado.filtrados = estado.registros.filter(function (o) {
            if (status && o.status !== status) return false;
            if (data && o.data !== data) return false;
            if (equipe && o.equipe !== equipe) return false;
            if (viatura && o.viatura !== viatura) return false;
            if (termo) {
                var alvo = [
                    o.numero_ordem, o.solicitante, o.setor, o.local,
                    o.tipo_servico, o.descricao, o.status,
                    o.viatura, o.equipe,
                ].join(' ').toLowerCase();
                if (alvo.indexOf(termo) < 0) return false;
            }
            return true;
        });

        renderTabela();
    }

    function limparFiltros() {
        ['filtroBusca', 'filtroStatus', 'filtroData', 'filtroEquipe', 'filtroViatura']
            .forEach(function (id) {
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
        var tbody = document.getElementById('tabelaOrdensBody');
        if (!tbody) return;

        var total = estado.filtrados.length;
        var totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
        if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;

        var pagina = paginarLista(estado.filtrados, estado.pagina, ITENS_POR_PAGINA);

        tbody.innerHTML = '';

        if (pagina.length === 0) {
            var vazio = document.createElement('tr');
            vazio.innerHTML = '<td colspan="9" style="text-align:center;padding:24px;">' +
                'Nenhuma ordem de serviço encontrada.</td>';
            tbody.appendChild(vazio);
        } else {
            pagina.forEach(function (o) {
                tbody.appendChild(criarLinha(o));
            });
        }

        criarPaginacao('paginacaoOrdens', total, estado.pagina, ITENS_POR_PAGINA,
            function (novaPagina) {
                estado.pagina = novaPagina;
                renderTabela();
            });
    }

    function criarLinha(o) {
        var tr = document.createElement('tr');
        tr.dataset.id = o.id;

        var dataHora = (o.data ? formatarData(o.data) : '-') +
            (o.hora ? ' ' + o.hora : '');

        tr.innerHTML =
            '<td><strong>' + escapar(o.numero_ordem) + '</strong></td>' +
            '<td>' + escapar(dataHora) + '</td>' +
            '<td>' + escapar(o.solicitante) + '</td>' +
            '<td>' + escapar(o.tipo_servico) + '</td>' +
            '<td>' + escapar(o.viatura || '-') + '</td>' +
            '<td>' + escapar(o.equipe || '-') + '</td>' +
            '<td><span class="status-badge ' + classePrioridade(o.prioridade) + '">' +
            escapar(o.prioridade) + '</span></td>' +
            '<td><span class="status-badge ' + classeStatus(o.status) + '">' +
            escapar(o.status) + '</span></td>' +
            '<td><div class="acoes-tabela">' +
            '  <button type="button" class="btn btn-info" data-acao="ver" data-id="' + o.id + '">Ver</button>' +
            '  <button type="button" class="btn btn-warning" data-acao="editar" data-id="' + o.id + '">Editar</button>' +
            '  <button type="button" class="btn btn-secondary" data-acao="pdf" data-id="' + o.id + '">PDF</button>' +
            (o.status === 'Concluída' ?
                '  <button type="button" class="btn btn-success" data-acao="relatorio" data-id="' + o.id + '">Relatório</button>' : '') +
            '  <button type="button" class="btn btn-danger" data-acao="excluir" data-id="' + o.id + '">Excluir</button>' +
            '</div></td>';

        return tr;
    }

    function classeStatus(status) {
        var mapa = {
            'Aberta': 'status-aberta',
            'Em andamento': 'status-em-andamento',
            'Concluída': 'status-concluida',
            'Cancelada': 'status-cancelada',
        };
        return mapa[status] || 'status-aberta';
    }

    function classePrioridade(prioridade) {
        var mapa = {
            'Urgente': 'status-cancelada',
            'Alta': 'status-em-andamento',
            'Normal': 'status-enviado',
            'Baixa': 'status-arquivado',
        };
        return mapa[prioridade] || 'status-aberta';
    }

    function atualizarContadores() {
        var abertas = 0, andamento = 0, concluidas = 0;

        estado.registros.forEach(function (o) {
            if (o.status === 'Aberta') abertas++;
            else if (o.status === 'Em andamento') andamento++;
            else if (o.status === 'Concluída') concluidas++;
        });

        definirTexto('contadorAbertas', abertas);
        definirTexto('contadorAndamento', andamento);
        definirTexto('contadorConcluidas', concluidas);
    }

    function definirTexto(id, valor) {
        var el = document.getElementById(id);
        if (el) el.textContent = valor;
    }

    // ---------------------------------------------------------------
    // CRIAR / EDITAR
    // ---------------------------------------------------------------
    async function salvarOrdem(finalizar) {
        var btn = document.getElementById(finalizar ? 'btnFinalizar' : 'btnSalvar');
        var textoOriginal = btn.textContent;
        var erroEl = document.getElementById('formErro');
        erroEl.style.display = 'none';

        var payload = montarPayload(finalizar);
        var erro = validar(payload, finalizar);

        if (erro) {
            erroEl.textContent = erro;
            erroEl.style.display = 'block';
            mostrarToast(erro, 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = finalizar ? 'Finalizando...' : 'Salvando...';

        try {
            var supabase = getSupabase();
            var resultado;

            if (estado.editandoId) {
                resultado = await supabase
                    .from('ordens_servico')
                    .update(payload)
                    .eq('id', estado.editandoId)
                    .select()
                    .single();
            } else {
                resultado = await supabase
                    .from('ordens_servico')
                    .insert([payload])
                    .select()
                    .single();
            }

            if (resultado.error) throw resultado.error;

            var eraConcluida = payload.status === 'Concluída';

            mostrarToast(finalizar
                ? 'Ordem de serviço finalizada com sucesso!'
                : (estado.editandoId
                    ? 'Ordem de serviço atualizada com sucesso!'
                    : 'Ordem de serviço criada com sucesso!'), 'success');

            document.getElementById('ordemForm').reset();
            limparEdicao();
            aplicarValoresPadrao();
            await carregarOrdens();

            // INTEGRACAO: ao finalizar uma O.S., oferece gerar o Relatorio Diario
            if (eraConcluida && resultado.data && resultado.data.id) {
                var gerar = confirmarExclusao(
                    'A ordem ' + (resultado.data.numero_ordem || '') +
                    ' foi concluída. Deseja gerar um Relatório Diário relacionado agora?'
                );
                if (gerar) gerarRelatorioDiario(resultado.data.id);
            }
        } catch (err) {
            console.error('Erro ao salvar ordem de servico:', err);
            erroEl.textContent = 'Erro ao salvar: ' + err.message;
            erroEl.style.display = 'block';
            mostrarToast('Erro ao salvar ordem de serviço: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            if (finalizar) btn.textContent = textoOriginal;
            else btn.textContent = estado.editandoId ? 'Atualizar Ordem' : 'Salvar Ordem';
        }
    }

    function montarPayload(finalizar) {
        // Formulario: Data + Horario de inicio + Horario de termino.
        // O banco continua recebendo data, hora, data_hora_inicio e data_hora_termino.
        // Se o termino for menor que o inicio (ex.: 22:00 -> 02:00), considera o dia seguinte.
        var data = valorDe('data_ordem');
        var horaInicio = valorDe('hora_inicio');
        var horaTermino = valorDe('hora_termino');

        var inicio = (data && horaInicio) ? paraTimestamp(data + 'T' + horaInicio) : null;
        var termino = null;
        if (data && horaTermino) {
            var dataTermino = data;
            if (horaInicio && horaTermino < horaInicio) dataTermino = somarUmDia(data);
            termino = paraTimestamp(dataTermino + 'T' + horaTermino);
        }

        // O campo Status saiu do formulario: ordem nova nasce "Aberta",
        // edicao mantem o status atual e o botao Finalizar marca "Concluída".
        var status = finalizar ? 'Concluída' : (estado.statusAtual || 'Aberta');

        return {
            numero_ordem: valorDe('numero_ordem'),
            data: data,
            hora: horaInicio,
            solicitante: textoOuNulo(valorDe('solicitante')),
            setor: textoOuNulo(valorDe('setor')),
            prioridade: valorDe('prioridade'),
            status: status,
            viatura: textoOuNulo(valorDe('viatura')),
            equipe: textoOuNulo(valorDe('equipe')),
            tipo_servico: valorDe('tipo_servico'),
            descricao: textoOuNulo(valorDe('descricao')),
            local: textoOuNulo(valorDe('local')),
            data_hora_inicio: inicio,
            data_hora_termino: termino,
            resultado: textoOuNulo(valorDe('resultado')),
            observacoes: textoOuNulo(valorDe('observacoes')),
            assinatura: textoOuNulo(valorDe('assinatura')),
        };
    }

    // ---------------------------------------------------------------
    // VALIDACAO (impede registros incompletos)
    // ---------------------------------------------------------------
    function validar(p, finalizar) {
        if (!p.numero_ordem) return 'Informe o número da ordem.';
        if (!p.data) return 'Informe a data da ordem.';
        if (!p.data_hora_inicio) return 'Informe o horário de início.';
        if (!p.solicitante) return 'Informe o solicitante.';
        if (!p.setor) return 'Informe o setor.';
        if (!p.prioridade) return 'Selecione a prioridade.';
        if (!p.tipo_servico) return 'Selecione o tipo de serviço.';
        if (!p.descricao) return 'Informe a descrição do serviço.';

        if (finalizar && !p.data_hora_termino) return 'Informe o horário de término para finalizar.';
        return null;
    }

    function iniciarEdicao(id) {
        var o = estado.registros.find(function (item) { return item.id === id; });
        if (!o) return;

        estado.editandoId = id;
        estado.statusAtual = o.status || 'Aberta';

        definirValor('ordemId', o.id);
        definirValor('numero_ordem', o.numero_ordem || '');
        definirValor('solicitante', o.solicitante || '');
        definirValor('setor', o.setor || '');
        definirValor('prioridade', o.prioridade || '');
        definirValor('viatura', o.viatura || '');
        definirValor('equipe', o.equipe || '');
        definirValor('tipo_servico', o.tipo_servico || '');
        definirValor('local', o.local || '');
        var inicioLocal = paraDateTimeLocal(o.data_hora_inicio);
        var terminoLocal = paraDateTimeLocal(o.data_hora_termino);
        definirValor('data_ordem', o.data || inicioLocal.slice(0, 10));
        definirValor('hora_inicio', inicioLocal ? inicioLocal.slice(11, 16) : (o.hora || '').slice(0, 5));
        definirValor('hora_termino', terminoLocal ? terminoLocal.slice(11, 16) : '');
        definirValor('descricao', o.descricao || '');
        definirValor('resultado', o.resultado || '');
        definirValor('observacoes', o.observacoes || '');
        definirValor('assinatura', o.assinatura || '');

        document.getElementById('formTitulo').textContent =
            'Editando ' + (o.numero_ordem || 'Ordem de Serviço');
        document.getElementById('btnSalvar').textContent = 'Atualizar Ordem';
        document.getElementById('btnCancelarEdicao').style.display = 'inline-block';
        atualizarBotaoFinalizar();

        document.getElementById('ordemForm')
            .scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function limparEdicao() {
        estado.editandoId = null;
        estado.statusAtual = null;
        definirValor('ordemId', '');
        document.getElementById('formTitulo').textContent = 'Nova Ordem de Serviço';
        document.getElementById('btnSalvar').textContent = 'Salvar Ordem';
        document.getElementById('btnCancelarEdicao').style.display = 'none';
        var erroEl = document.getElementById('formErro');
        if (erroEl) erroEl.style.display = 'none';
    }

    // ---------------------------------------------------------------
    // EXCLUIR
    // ---------------------------------------------------------------
    async function handleExcluir(id) {
        var o = estado.registros.find(function (item) { return item.id === id; });
        if (!o) return;

        var confirmado = confirmarExclusao(
            'Deseja realmente excluir a ordem ' + (o.numero_ordem || '') +
            '? Esta ação não pode ser desfeita.'
        );
        if (!confirmado) return;

        try {
            var supabase = getSupabase();
            var resultado = await supabase
                .from('ordens_servico')
                .delete()
                .eq('id', id);

            if (resultado.error) throw resultado.error;

            if (estado.editandoId === id) {
                document.getElementById('ordemForm').reset();
                limparEdicao();
                aplicarValoresPadrao();
            }

            mostrarToast('Ordem de serviço excluída com sucesso!', 'success');
            await carregarOrdens();
        } catch (err) {
            console.error('Erro ao excluir ordem de servico:', err);
            mostrarToast('Erro ao excluir ordem de serviço: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // VISUALIZACAO DETALHADA
    // ---------------------------------------------------------------
    function abrirDetalhe(id) {
        var o = estado.registros.find(function (item) { return item.id === id; });
        if (!o) return;

        var conteudo = document.getElementById('detalheConteudo');

        conteudo.innerHTML =
            '<div class="detalhe-grid">' +
            item('Número', o.numero_ordem) +
            item('Status', o.status) +
            item('Prioridade', o.prioridade) +
            item('Solicitante', o.solicitante) +
            item('Setor', o.setor) +
            item('Viatura', o.viatura || '-') +
            item('Equipe', o.equipe || '-') +
            item('Tipo de serviço', o.tipo_servico) +
            item('Local', o.local || '-') +
            item('Horário de início', formatarDataHora(o.data_hora_inicio)) +
            item('Horário de término', formatarDataHora(o.data_hora_termino)) +
            item('Assinatura', o.assinatura || '-') +
            '</div>' +
            bloco('Descrição', o.descricao) +
            bloco('Resultado', o.resultado) +
            bloco('Observações', o.observacoes);

        var btnPdf = document.getElementById('detalhePdfBtn');
        btnPdf.onclick = function () { gerarPdfOrdem(id); };

        var btnRel = document.getElementById('detalheRelatorioBtn');
        if (btnRel) {
            btnRel.style.display = o.status === 'Concluída' ? 'inline-block' : 'none';
            btnRel.onclick = function () { gerarRelatorioDiario(id); };
        }

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
    function gerarPdfOrdem(id) {
        var o = estado.registros.find(function (item) { return item.id === id; });
        if (!o || !window.GML_PDF) return;

        var corpo =
            '<div class="pdf-secao"><h2>Identificação</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Número da Ordem', valor: o.numero_ordem },
                { label: 'Solicitante', valor: o.solicitante },
                { label: 'Setor', valor: o.setor },
                { label: 'Prioridade', valor: o.prioridade },
                { label: 'Status', valor: o.status },
                { label: 'Tipo de serviço', valor: o.tipo_servico },
                { label: 'Local', valor: o.local || '-' },
            ]) + '</div>' +
            '<div class="pdf-secao"><h2>Recursos empregados</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Viatura', valor: o.viatura || '-' },
                { label: 'Equipe', valor: o.equipe || '-' },
                { label: 'Horário de início', valor: formatarDataHora(o.data_hora_inicio) },
                { label: 'Horário de término', valor: formatarDataHora(o.data_hora_termino) },
                { label: 'Assinatura', valor: o.assinatura || '-' },
            ]) + '</div>' +
            GML_PDF.blocoTexto('Descrição', o.descricao) +
            GML_PDF.blocoTexto('Resultado', o.resultado) +
            GML_PDF.blocoTexto('Observações', o.observacoes);

        GML_PDF.gerar({
            titulo: 'ORDEM DE SERVIÇO',
            subtitulo: (o.numero_ordem || '') + ' - ' + (o.tipo_servico || ''),
            corpo: corpo,
            assinaturas: [
                o.assinatura || 'Responsável pela ordem',
                'Comando da Guarda Municipal',
            ],
        });
    }

    // ---------------------------------------------------------------
    // INTEGRACAO: gerar Relatorio Diario a partir da O.S. concluida
    // ---------------------------------------------------------------
    function gerarRelatorioDiario(id) {
        var o = estado.registros.find(function (item) { return item.id === id; });
        if (!o) return;

        var prefill = {
            data: o.data || hojeISO(),
            equipe: o.equipe || '',
            responsavel: o.motorista || '',
            turno: 'Diurno',
            hora_inicio: paraDateTimeLocal(o.data_hora_inicio).slice(11, 16),
            hora_termino: paraDateTimeLocal(o.data_hora_termino).slice(11, 16),
            atividades_realizadas: o.descricao || '',
            ocorrencias_atendidas: o.resultado || '',
            observacoes: o.observacoes || '',
            assinatura_responsavel: o.assinatura || '',
            ordem_servico_id: o.id,
            numero_ordem: o.numero_ordem || '',
            viaturas: o.viatura ? [o.viatura] : [],
            motoristas: o.motorista ? [o.motorista] : [],
        };

        try {
            sessionStorage.setItem('gml_relatorio_prefill', JSON.stringify(prefill));
        } catch (e) {
            console.warn('Nao foi possivel gravar o prefill do relatorio:', e);
        }

        window.location.href = 'relatorio-diario.html';
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

    // "YYYY-MM-DD" + 1 dia
    function somarUmDia(dataISO) {
        var d = new Date(dataISO + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
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

    window.initOrdensServico = initOrdensServico;
})();
