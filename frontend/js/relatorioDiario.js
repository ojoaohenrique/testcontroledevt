(function () {
    'use strict';

    // ===============================================================
    //  Modulo Relatorio Diario
    //  Integracao com Supabase - tabela: relatorios_diarios
    //  Padrao GML (mesmo estilo de viaturas.js)
    // ===============================================================

    var ITENS_POR_PAGINA = 10;
    var STATUS_OS_ITEM = ['Concluída', 'Não concluída', 'Em andamento'];

    var estado = {
        registros: [],       // todos os relatorios carregados
        filtrados: [],       // apos aplicar filtros
        itensPorRelatorio: {}, // relatorio_diario_id -> array de itens (atividades por O.S.)
        pagina: 1,
        editandoId: null,
        itensForm: [],       // itens (atividades por O.S.) do relatorio em edicao/criacao
        proximoUid: 1,
    };

    var ordensDisponiveis = []; // ordens de servico carregadas para o select de cada item

    // ---------------------------------------------------------------
    // INICIALIZACAO
    // ---------------------------------------------------------------
    async function initRelatorioDiario() {
        console.log('Modulo Relatorio Diario inicializado.');

        preencherCombos();
        configurarEventos();
        aplicarValoresPadrao();
        await carregarOrdensParaSelect();
        await carregarRelatorios();
        verificarOrigemOrdemServico();
    }

    function preencherCombos() {
        var dados = window.GML_DADOS || {};

        preencherSelect('turno', dados.TURNOS || []);
        preencherSelect('equipe', dados.EQUIPES || []);
        preencherSelect('responsavel', dados.MOTORISTAS || []);
        preencherSelect('status', dados.STATUS_RELATORIO || []);

        // Filtros
        preencherSelect('filtroEquipe', dados.EQUIPES || []);
        preencherSelect('filtroResponsavel', dados.MOTORISTAS || []);
    }

    function aplicarValoresPadrao() {
        var campoData = document.getElementById('data');
        if (campoData && !campoData.value) campoData.value = hojeISO();

        var campoStatus = document.getElementById('status');
        if (campoStatus && !campoStatus.value) campoStatus.value = 'Rascunho';

        atualizarVisibilidadeAlteracoesViaturas();
    }

    // Mostra/oculta e alterna a obrigatoriedade do campo de descricao das
    // alteracoes encontradas na viatura, conforme a opcao selecionada
    // (mesmo padrao usado no campo "Motivo" de cada atividade por O.S.).
    function atualizarVisibilidadeAlteracoesViaturas() {
        var select = document.getElementById('viatura_alteracoes');
        var grupo = document.getElementById('alteracoesViaturasDescricaoGrupo');
        var campoDescricao = document.getElementById('alteracoes_viaturas_descricao');
        if (!select || !grupo || !campoDescricao) return;

        var comAlteracoes = select.value === 'Com alterações';
        grupo.style.display = comAlteracoes ? 'block' : 'none';
        if (comAlteracoes) {
            campoDescricao.setAttribute('required', 'required');
        } else {
            campoDescricao.removeAttribute('required');
            campoDescricao.value = '';
        }
    }

    function configurarEventos() {
        var form = document.getElementById('relatorioForm');
        if (form) {
            form.addEventListener('submit', handleSalvar);
            form.addEventListener('reset', function () {
                setTimeout(function () {
                    limparEdicao();
                    aplicarValoresPadrao();
                }, 0);
            });
        }

        document.getElementById('btnCancelarEdicao')
            ?.addEventListener('click', function () {
                document.getElementById('relatorioForm').reset();
                limparEdicao();
                aplicarValoresPadrao();
            });

        document.getElementById('btnAdicionarItemOs')
            ?.addEventListener('click', function () { adicionarItem(); });

        document.getElementById('viatura_alteracoes')
            ?.addEventListener('change', atualizarVisibilidadeAlteracoesViaturas);

        var itensContainer = document.getElementById('itensOsContainer');
        if (itensContainer) {
            itensContainer.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-item-acao="remover"]');
                if (!btn) return;
                removerItem(btn.closest('[data-uid]').dataset.uid);
            });
            itensContainer.addEventListener('change', function (e) {
                var campo = e.target.dataset.itemCampo;
                if (!campo) return;
                var uid = e.target.closest('[data-uid]').dataset.uid;
                if (campo === 'ordem_servico_id') {
                    sincronizarOrdemSelecionada(uid, e.target.value);
                } else {
                    atualizarItemCampo(uid, campo, e.target.value);
                }
            });
            itensContainer.addEventListener('input', function (e) {
                var campo = e.target.dataset.itemCampo;
                if (!campo || e.target.tagName === 'SELECT') return;
                var uid = e.target.closest('[data-uid]').dataset.uid;
                atualizarItemCampo(uid, campo, e.target.value);
            });
        }

        // Filtros
        ['filtroBusca', 'filtroData', 'filtroEquipe', 'filtroResponsavel',
            'filtroNumeroOrdem', 'filtroStatusOs']
            .forEach(function (id) {
                var el = document.getElementById(id);
                if (!el) return;
                var evento = el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input';
                el.addEventListener(evento, function () {
                    estado.pagina = 1;
                    aplicarFiltros();
                });
            });

        document.getElementById('btnLimparFiltros')
            ?.addEventListener('click', limparFiltros);

        // Delegacao de clique nas acoes da tabela
        document.getElementById('tabelaRelatoriosBody')
            ?.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-acao]');
                if (!btn) return;
                var id = btn.dataset.id;
                var acao = btn.dataset.acao;

                if (acao === 'ver') abrirDetalhe(id);
                else if (acao === 'editar') iniciarEdicao(id);
                else if (acao === 'excluir') handleExcluir(id);
                else if (acao === 'pdf') gerarPdfRelatorio(id);
                else if (acao === 'whatsapp') compartilharWhatsapp(id);
            });

        // Modal de detalhes
        document.getElementById('detalheFecharBtn')
            ?.addEventListener('click', fecharDetalhe);
        document.getElementById('detalheModal')
            ?.addEventListener('click', function (e) {
                if (e.target === e.currentTarget) fecharDetalhe();
            });
    }

    // ---------------------------------------------------------------
    // INTEGRACAO: relatorio gerado a partir de uma Ordem de Servico
    // ---------------------------------------------------------------
    function verificarOrigemOrdemServico() {
        var rascunho = null;
        try {
            rascunho = JSON.parse(sessionStorage.getItem('gml_relatorio_prefill') || 'null');
        } catch (e) {
            rascunho = null;
        }
        if (!rascunho) return;

        sessionStorage.removeItem('gml_relatorio_prefill');

        definirValor('data', rascunho.data || hojeISO());
        definirValor('equipe', rascunho.equipe || '');
        definirValor('responsavel', rascunho.responsavel || '');
        definirValor('turno', rascunho.turno || '');
        definirValor('ocorrencias_atendidas', rascunho.ocorrencias_atendidas || '');
        definirValor('observacoes', rascunho.observacoes || '');
        definirValor('assinatura_responsavel', rascunho.assinatura_responsavel || '');
        definirValor('ordemServicoId', rascunho.ordem_servico_id || '');

        if (rascunho.ordem_servico_id) {
            adicionarItem({
                ordem_servico_id: rascunho.ordem_servico_id,
                numero_ordem: rascunho.numero_ordem || '',
                status_os: 'Concluída',
                atividade_realizada: rascunho.atividades_realizadas || '',
                observacoes: rascunho.ocorrencias_atendidas || '',
            });
        }

        mostrarToast('Relatório pré-preenchido a partir da Ordem de Serviço ' +
            (rascunho.numero_ordem || '') + '. Revise e salve.', 'warning');

        document.getElementById('relatorioForm')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---------------------------------------------------------------
    // CARREGAR DADOS
    // ---------------------------------------------------------------
    async function carregarRelatorios() {
        try {
            var supabase = getSupabase();
            var resultado = await supabase
                .from('relatorios_diarios')
                .select('*')
                .order('data', { ascending: false })
                .limit(500);

            if (resultado.error) throw resultado.error;

            estado.registros = resultado.data || [];
            await carregarItensDosRelatorios(estado.registros.map(function (r) { return r.id; }));
            aplicarFiltros();
        } catch (err) {
            console.error('Erro ao carregar relatórios:', err);
            mostrarToast('Erro ao carregar relatórios: ' + err.message, 'error');
        }
    }

    // Carrega, em uma unica consulta, as atividades (itens por O.S.) de varios relatorios
    async function carregarItensDosRelatorios(idsRelatorios) {
        estado.itensPorRelatorio = {};
        if (!idsRelatorios || idsRelatorios.length === 0) return;

        try {
            var supabase = getSupabase();
            var resultado = await supabase
                .from('relatorio_diario_itens')
                .select('*')
                .in('relatorio_diario_id', idsRelatorios)
                .order('created_at', { ascending: true });

            if (resultado.error) throw resultado.error;

            (resultado.data || []).forEach(function (item) {
                var lista = estado.itensPorRelatorio[item.relatorio_diario_id];
                if (!lista) {
                    lista = [];
                    estado.itensPorRelatorio[item.relatorio_diario_id] = lista;
                }
                lista.push(item);
            });
        } catch (err) {
            console.error('Erro ao carregar atividades dos relatórios:', err);
            mostrarToast('Erro ao carregar atividades por Ordem de Serviço: ' + err.message, 'error');
        }
    }

    // Carrega as ordens de servico disponiveis para vincular a cada atividade
    async function carregarOrdensParaSelect() {
        try {
            var supabase = getSupabase();
            var resultado = await supabase
                .from('ordens_servico')
                .select('id, numero_ordem, tipo_servico, status')
                .order('data', { ascending: false })
                .limit(500);

            if (resultado.error) throw resultado.error;

            ordensDisponiveis = resultado.data || [];
        } catch (err) {
            console.error('Erro ao carregar ordens de serviço:', err);
            mostrarToast('Erro ao carregar ordens de serviço: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // FILTROS E BUSCA
    // ---------------------------------------------------------------
    function aplicarFiltros() {
        var termo = (valorDe('filtroBusca') || '').trim().toLowerCase();
        var data = valorDe('filtroData');
        var equipe = valorDe('filtroEquipe');
        var responsavel = valorDe('filtroResponsavel');
        var numeroOrdem = (valorDe('filtroNumeroOrdem') || '').trim().toLowerCase();
        var statusOs = valorDe('filtroStatusOs');

        estado.filtrados = estado.registros.filter(function (r) {
            if (data && r.data !== data) return false;
            if (equipe && r.equipe !== equipe) return false;
            if (responsavel && r.responsavel !== responsavel) return false;

            var itensRelatorio = estado.itensPorRelatorio[r.id] || [];

            if (numeroOrdem) {
                var temOrdem = itensRelatorio.some(function (item) {
                    return (item.numero_ordem || '').toLowerCase().indexOf(numeroOrdem) >= 0;
                });
                if (!temOrdem) return false;
            }
            if (statusOs) {
                var temStatus = itensRelatorio.some(function (item) { return item.status_os === statusOs; });
                if (!temStatus) return false;
            }
            if (termo) {
                var alvo = [
                    r.equipe, r.responsavel, r.turno, r.status,
                    r.bairros_patrulhados, r.ocorrencias_atendidas,
                    itensRelatorio.map(function (item) {
                        return [item.numero_ordem, item.atividade_realizada, item.observacoes].join(' ');
                    }).join(' '),
                ].join(' ').toLowerCase();
                if (alvo.indexOf(termo) < 0) return false;
            }
            return true;
        });

        renderTabela();
    }

    function limparFiltros() {
        ['filtroBusca', 'filtroData', 'filtroEquipe', 'filtroResponsavel',
            'filtroNumeroOrdem', 'filtroStatusOs']
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
        var tbody = document.getElementById('tabelaRelatoriosBody');
        if (!tbody) return;

        var total = estado.filtrados.length;
        var totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
        if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;

        var pagina = paginarLista(estado.filtrados, estado.pagina, ITENS_POR_PAGINA);

        tbody.innerHTML = '';

        if (pagina.length === 0) {
            var vazio = document.createElement('tr');
            vazio.innerHTML = '<td colspan="7" style="text-align:center;padding:24px;">' +
                'Nenhum relatório encontrado.</td>';
            tbody.appendChild(vazio);
        } else {
            pagina.forEach(function (r) {
                tbody.appendChild(criarLinha(r));
            });
        }

        var contador = document.getElementById('contadorRelatorios');
        if (contador) contador.textContent = total;

        criarPaginacao('paginacaoRelatorios', total, estado.pagina, ITENS_POR_PAGINA,
            function (novaPagina) {
                estado.pagina = novaPagina;
                renderTabela();
            });
    }

    function criarLinha(r) {
        var tr = document.createElement('tr');
        tr.dataset.id = r.id;

        var itensRelatorio = estado.itensPorRelatorio[r.id] || [];
        var ordensTexto = itensRelatorio.length === 0
            ? '-'
            : itensRelatorio.map(function (item) {
                return escapar(item.numero_ordem) + ' <span class="status-badge ' +
                    classeStatusOs(item.status_os) + '">' + escapar(item.status_os) + '</span>';
            }).join('<br>');

        tr.innerHTML =
            '<td>' + formatarData(r.data) + '</td>' +
            '<td>' + escapar(r.turno) + '</td>' +
            '<td>' + escapar(r.equipe) + '</td>' +
            '<td>' + escapar(r.responsavel) + '</td>' +
            '<td>' + ordensTexto + '</td>' +
            '<td><span class="status-badge ' + classeStatus(r.status) + '">' +
            escapar(r.status) + '</span></td>' +
            '<td><div class="acoes-tabela">' +
            '  <button type="button" class="btn btn-info" data-acao="ver" data-id="' + r.id + '">Ver</button>' +
            '  <button type="button" class="btn btn-warning" data-acao="editar" data-id="' + r.id + '">Editar</button>' +
            '  <button type="button" class="btn btn-whatsapp" data-acao="whatsapp" data-id="' + r.id + '">WhatsApp</button>' +
            '  <button type="button" class="btn btn-secondary" data-acao="pdf" data-id="' + r.id + '">PDF</button>' +
            '  <button type="button" class="btn btn-danger" data-acao="excluir" data-id="' + r.id + '">Excluir</button>' +
            '</div></td>';

        return tr;
    }

    function classeStatus(status) {
        var mapa = {
            'Rascunho': 'status-rascunho',
            'Enviado': 'status-enviado',
            'Aprovado': 'status-aprovado',
            'Arquivado': 'status-arquivado',
        };
        return mapa[status] || 'status-rascunho';
    }

    function classeStatusOs(status) {
        var mapa = {
            'Concluída': 'status-concluida',
            'Em andamento': 'status-em-andamento',
            'Não concluída': 'status-nao-concluida',
        };
        return mapa[status] || 'status-nao-concluida';
    }

    // Slug usado no atributo data-status do cartão de atividade, para colorir
    // a borda/fundo do cartão conforme o status selecionado (feedback visual
    // imediato, sem precisar ler o texto do badge).
    function statusOsSlug(status) {
        var mapa = {
            'Concluída': 'concluida',
            'Em andamento': 'em-andamento',
            'Não concluída': 'nao-concluida',
        };
        return mapa[status] || '';
    }

    // ---------------------------------------------------------------
    // ATIVIDADES POR ORDEM DE SERVICO (itens dinamicos do relatorio)
    // ---------------------------------------------------------------
    function itemVazio() {
        return {
            uid: 'novo-' + (estado.proximoUid++),
            id: null,
            ordem_servico_id: '',
            numero_ordem: '',
            status_os: '',
            atividade_realizada: '',
            quantidade: '',
            unidade_medida: '',
            observacoes: '',
            motivo: '',
        };
    }

    function adicionarItem(dadosIniciais) {
        var item = Object.assign(itemVazio(), dadosIniciais || {});
        estado.itensForm.push(item);
        renderItensForm();
    }

    function removerItem(uid) {
        estado.itensForm = estado.itensForm.filter(function (item) { return String(item.uid) !== String(uid); });
        renderItensForm();
    }

    function encontrarItemPorUid(uid) {
        return estado.itensForm.find(function (item) { return String(item.uid) === String(uid); });
    }

    function atualizarItemCampo(uid, campo, valor) {
        var item = encontrarItemPorUid(uid);
        if (!item) return;
        item[campo] = valor;

        // Motivo so aparece quando a O.S. nao foi concluida: alterna sem re-renderizar tudo
        if (campo === 'status_os') {
            renderItensForm();
        }
    }

    function sincronizarOrdemSelecionada(uid, ordemId) {
        var item = encontrarItemPorUid(uid);
        if (!item) return;

        var ordem = ordensDisponiveis.find(function (o) { return o.id === ordemId; });
        item.ordem_servico_id = ordemId;
        item.numero_ordem = ordem ? ordem.numero_ordem : '';

        if (!item.status_os && ordem) {
            if (ordem.status === 'Concluída') item.status_os = 'Concluída';
            else if (ordem.status === 'Em andamento') item.status_os = 'Em andamento';
        }

        renderItensForm();
    }

    function renderItensForm() {
        var container = document.getElementById('itensOsContainer');
        if (!container) return;

        container.innerHTML = estado.itensForm.map(function (item, index) {
            return criarItemCardHtml(item, index);
        }).join('');
    }

    function criarItemCardHtml(item, index) {
        var mostrarMotivo = item.status_os === 'Não concluída';
        var statusSlug = statusOsSlug(item.status_os);
        var badgeStatus = item.status_os
            ? '<span class="status-badge ' + classeStatusOs(item.status_os) + '">' + escapar(item.status_os) + '</span>'
            : '<span class="status-badge status-pendente">Status pendente</span>';

        return '' +
            '<div class="item-os-card" data-uid="' + escapar(item.uid) + '"' +
            (statusSlug ? ' data-status="' + statusSlug + '"' : '') + '>' +
            '  <div class="item-os-cabecalho">' +
            '    <span class="item-os-titulo">Atividade ' + (index + 1) + '</span>' +
            badgeStatus +
            '  </div>' +
            '  <button type="button" class="item-os-remover" data-item-acao="remover" ' +
            'title="Remover esta atividade" aria-label="Remover atividade ' + (index + 1) + '">✕</button>' +
            '  <div class="item-os-grid">' +
            '    <div class="form-group">' +
            '      <label class="required">Ordem de Serviço</label>' +
            '      <select data-item-campo="ordem_servico_id">' + opcoesOrdensHtml(item.ordem_servico_id) + '</select>' +
            '    </div>' +
            '    <div class="form-group">' +
            '      <label class="required">Status da Ordem de Serviço</label>' +
            '      <select data-item-campo="status_os">' + opcoesStatusOsHtml(item.status_os) + '</select>' +
            '    </div>' +
            '    <div class="form-group item-os-full">' +
            '      <label class="required">Atividade realizada</label>' +
            '      <input type="text" data-item-campo="atividade_realizada" value="' +
            escaparAtributo(item.atividade_realizada) + '" placeholder="Ex: Patrulhamento no bairro Centro">' +
            '    </div>' +
            '    <div class="form-group">' +
            '      <label>Quantidade</label>' +
            '      <input type="number" min="0" step="0.01" data-item-campo="quantidade" value="' +
            escaparAtributo(item.quantidade) + '" placeholder="0">' +
            '    </div>' +
            '    <div class="form-group">' +
            '      <label>Unidade de medida</label>' +
            '      <input type="text" list="unidadesMedida" data-item-campo="unidade_medida" value="' +
            escaparAtributo(item.unidade_medida) + '" placeholder="Ex: KM, L, Horas, Ocorrências">' +
            '    </div>' +
            '    <div class="form-group item-os-full">' +
            '      <label>Observações</label>' +
            '      <textarea rows="2" data-item-campo="observacoes" placeholder="Detalhes adicionais da atividade">' +
            escaparAtributo(item.observacoes) + '</textarea>' +
            '    </div>' +
            (mostrarMotivo ?
                '    <div class="form-group item-os-full item-os-alerta">' +
                '      <label class="required">⚠ Motivo da não conclusão</label>' +
                '      <textarea rows="2" data-item-campo="motivo" placeholder="Explique por que a atividade não foi concluída">' +
                escaparAtributo(item.motivo) + '</textarea>' +
                '    </div>' : '') +
            '  </div>' +
            '</div>';
    }

    function opcoesOrdensHtml(selecionadoId) {
        var opcoes = '<option value="">Selecione a Ordem de Serviço...</option>';
        opcoes += ordensDisponiveis.map(function (o) {
            var selecionado = o.id === selecionadoId ? ' selected' : '';
            var rotulo = o.numero_ordem + ' — ' + (o.tipo_servico || '-') + ' (' + o.status + ')';
            return '<option value="' + o.id + '"' + selecionado + '>' + escapar(rotulo) + '</option>';
        }).join('');
        return opcoes;
    }

    function opcoesStatusOsHtml(selecionado) {
        var opcoes = '<option value="">Selecione...</option>';
        opcoes += STATUS_OS_ITEM.map(function (status) {
            var marcado = status === selecionado ? ' selected' : '';
            return '<option value="' + status + '"' + marcado + '>' + status + '</option>';
        }).join('');
        return opcoes;
    }

    function validarItens(itens) {
        if (!itens || itens.length === 0) {
            return 'Adicione ao menos uma atividade vinculada a uma Ordem de Serviço.';
        }
        for (var i = 0; i < itens.length; i++) {
            var item = itens[i];
            var numero = i + 1;
            if (!item.ordem_servico_id) return 'Selecione a Ordem de Serviço na atividade ' + numero + '.';
            if (!item.status_os) return 'Selecione o status da Ordem de Serviço na atividade ' + numero + '.';
            if (!(item.atividade_realizada || '').trim()) {
                return 'Informe a atividade realizada na atividade ' + numero + '.';
            }
            if (item.quantidade !== '' && item.quantidade !== null && Number(item.quantidade) < 0) {
                return 'A quantidade da atividade ' + numero + ' não pode ser negativa.';
            }
            if (item.status_os === 'Não concluída' && !(item.motivo || '').trim()) {
                return 'Informe o motivo da não conclusão na atividade ' + numero + '.';
            }
        }
        return null;
    }

    function montarPayloadItens(relatorioId) {
        return estado.itensForm.map(function (item) {
            return {
                relatorio_diario_id: relatorioId,
                ordem_servico_id: item.ordem_servico_id || null,
                numero_ordem: item.numero_ordem,
                status_os: item.status_os,
                atividade_realizada: item.atividade_realizada.trim(),
                quantidade: item.quantidade === '' || item.quantidade === null ? null : Number(item.quantidade),
                unidade_medida: textoOuNulo(item.unidade_medida),
                observacoes: textoOuNulo(item.observacoes),
                motivo: item.status_os === 'Não concluída' ? textoOuNulo(item.motivo) : null,
            };
        });
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
        var erro = validar(payload) || validarItens(estado.itensForm);

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
                    .from('relatorios_diarios')
                    .update(payload)
                    .eq('id', estado.editandoId)
                    .select()
                    .single();
            } else {
                resultado = await supabase
                    .from('relatorios_diarios')
                    .insert([payload])
                    .select()
                    .single();
            }

            if (resultado.error) throw resultado.error;

            var relatorioId = resultado.data.id;

            if (estado.editandoId) {
                var exclusao = await supabase
                    .from('relatorio_diario_itens')
                    .delete()
                    .eq('relatorio_diario_id', relatorioId);
                if (exclusao.error) throw exclusao.error;
            }

            var itensInsercao = await supabase
                .from('relatorio_diario_itens')
                .insert(montarPayloadItens(relatorioId));
            if (itensInsercao.error) throw itensInsercao.error;

            mostrarToast(estado.editandoId
                ? 'Relatório atualizado com sucesso!'
                : 'Relatório criado com sucesso!', 'success');

            document.getElementById('relatorioForm').reset();
            limparEdicao();
            aplicarValoresPadrao();
            await carregarRelatorios();
        } catch (err) {
            console.error('Erro ao salvar relatório:', err);
            erroEl.textContent = 'Erro ao salvar: ' + err.message;
            erroEl.style.display = 'block';
            mostrarToast('Erro ao salvar relatório: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = estado.editandoId ? 'Atualizar Relatório' : 'Salvar Relatório';
        }
    }

    function montarPayload() {
        var ordemId = valorDe('ordemServicoId');

        return {
            data: valorDe('data'),
            turno: valorDe('turno'),
            equipe: valorDe('equipe'),
            responsavel: valorDe('responsavel'),
            bairros_patrulhados: textoOuNulo(valorDe('bairros_patrulhados')),
            ocorrencias_atendidas: textoOuNulo(valorDe('ocorrencias_atendidas')),
            materiais_utilizados: textoOuNulo(valorDe('materiais_utilizados')),
            viatura_limpeza: valorDe('viatura_limpeza'),
            viatura_alteracoes: valorDe('viatura_alteracoes'),
            alteracoes_viaturas: valorDe('viatura_alteracoes') === 'Com alterações'
                ? textoOuNulo(valorDe('alteracoes_viaturas_descricao'))
                : null,
            abastecimentos_realizados: textoOuNulo(valorDe('abastecimentos_realizados')),
            observacoes: textoOuNulo(valorDe('observacoes')),
            status: valorDe('status'),
            assinatura_responsavel: textoOuNulo(valorDe('assinatura_responsavel')),
            ordem_servico_id: ordemId || null,
        };
    }

    // ---------------------------------------------------------------
    // VALIDACAO (impede registros incompletos)
    // ---------------------------------------------------------------
    function validar(p) {
        if (!p.data) return 'Informe a data do relatório.';
        if (!p.turno) return 'Selecione o turno.';
        if (!p.equipe) return 'Selecione a equipe.';
        if (!p.responsavel) return 'Selecione o responsável.';
        if (!p.bairros_patrulhados) return 'Informe os bairros patrulhados.';
        if (!p.viatura_limpeza) return 'Informe a limpeza da viatura.';
        if (!p.viatura_alteracoes) return 'Informe se foram encontradas alterações na viatura.';
        if (p.viatura_alteracoes === 'Com alterações' && !p.alteracoes_viaturas) {
            return 'Descreva as alterações encontradas na viatura.';
        }
        if (!p.status) return 'Selecione o status do relatório.';
        if (!p.assinatura_responsavel) return 'Informe a assinatura do responsável.';

        // Data futura nao faz sentido para um relatorio diario
        if (p.data > hojeISO()) {
            return 'A data do relatório não pode ser futura.';
        }
        return null;
    }

    function iniciarEdicao(id) {
        var r = estado.registros.find(function (item) { return item.id === id; });
        if (!r) return;

        estado.editandoId = id;

        definirValor('relatorioId', r.id);
        definirValor('ordemServicoId', r.ordem_servico_id || '');
        definirValor('data', r.data || '');
        definirValor('turno', r.turno || '');
        definirValor('equipe', r.equipe || '');
        definirValor('responsavel', r.responsavel || '');
        definirValor('bairros_patrulhados', r.bairros_patrulhados || '');
        definirValor('ocorrencias_atendidas', r.ocorrencias_atendidas || '');
        definirValor('materiais_utilizados', r.materiais_utilizados || '');
        definirValor('viatura_limpeza', r.viatura_limpeza || '');
        definirValor('viatura_alteracoes', r.viatura_alteracoes || (r.alteracoes_viaturas ? 'Com alterações' : ''));
        definirValor('alteracoes_viaturas_descricao', r.alteracoes_viaturas || '');
        atualizarVisibilidadeAlteracoesViaturas();
        definirValor('abastecimentos_realizados', r.abastecimentos_realizados || '');
        definirValor('observacoes', r.observacoes || '');
        definirValor('status', r.status || '');
        definirValor('assinatura_responsavel', r.assinatura_responsavel || '');

        estado.itensForm = (estado.itensPorRelatorio[r.id] || []).map(function (item) {
            return Object.assign(itemVazio(), {
                id: item.id,
                ordem_servico_id: item.ordem_servico_id || '',
                numero_ordem: item.numero_ordem || '',
                status_os: item.status_os || '',
                atividade_realizada: item.atividade_realizada || '',
                quantidade: item.quantidade === null || item.quantidade === undefined ? '' : item.quantidade,
                unidade_medida: item.unidade_medida || '',
                observacoes: item.observacoes || '',
                motivo: item.motivo || '',
            });
        });
        renderItensForm();

        document.getElementById('formTitulo').textContent =
            'Editando Relatório de ' + formatarData(r.data);
        document.getElementById('btnSalvar').textContent = 'Atualizar Relatório';
        document.getElementById('btnCancelarEdicao').style.display = 'inline-block';

        document.getElementById('relatorioForm')
            .scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function limparEdicao() {
        estado.editandoId = null;
        estado.itensForm = [];
        renderItensForm();
        definirValor('relatorioId', '');
        definirValor('ordemServicoId', '');
        document.getElementById('formTitulo').textContent = 'Novo Relatório Diário';
        document.getElementById('btnSalvar').textContent = 'Salvar Relatório';
        document.getElementById('btnCancelarEdicao').style.display = 'none';
        var erroEl = document.getElementById('formErro');
        if (erroEl) erroEl.style.display = 'none';
    }

    // ---------------------------------------------------------------
    // EXCLUIR
    // ---------------------------------------------------------------
    async function handleExcluir(id) {
        var r = estado.registros.find(function (item) { return item.id === id; });
        if (!r) return;

        var confirmado = confirmarExclusao(
            'Deseja realmente excluir o relatório de ' + formatarData(r.data) +
            ' (' + r.equipe + ')? Esta ação não pode ser desfeita.'
        );
        if (!confirmado) return;

        try {
            var supabase = getSupabase();
            var resultado = await supabase
                .from('relatorios_diarios')
                .delete()
                .eq('id', id);

            if (resultado.error) throw resultado.error;

            if (estado.editandoId === id) {
                document.getElementById('relatorioForm').reset();
                limparEdicao();
                aplicarValoresPadrao();
            }

            mostrarToast('Relatório excluído com sucesso!', 'success');
            await carregarRelatorios();
        } catch (err) {
            console.error('Erro ao excluir relatório:', err);
            mostrarToast('Erro ao excluir relatório: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // VISUALIZACAO DETALHADA
    // ---------------------------------------------------------------
    function abrirDetalhe(id) {
        var r = estado.registros.find(function (item) { return item.id === id; });
        if (!r) return;

        var conteudo = document.getElementById('detalheConteudo');
        var itensRelatorio = estado.itensPorRelatorio[r.id] || [];

        conteudo.innerHTML =
            '<div class="detalhe-grid">' +
            item('Data', formatarData(r.data)) +
            item('Turno', r.turno) +
            item('Equipe', r.equipe) +
            item('Responsável', r.responsavel) +
            item('Status', r.status) +
            item('Assinatura', r.assinatura_responsavel) +
            item('Limpeza da viatura', r.viatura_limpeza) +
            item('Alterações na viatura', r.viatura_alteracoes) +
            item('Abastecimento', r.abastecimentos_realizados) +
            '</div>' +
            blocoItensDetalhe(itensRelatorio) +
            bloco('Bairros patrulhados', r.bairros_patrulhados) +
            bloco('Ocorrências atendidas', r.ocorrencias_atendidas) +
            bloco('Materiais utilizados', r.materiais_utilizados) +
            (r.viatura_alteracoes === 'Com alterações'
                ? bloco('Descrição das alterações na viatura', r.alteracoes_viaturas)
                : '') +
            bloco('Observações', r.observacoes);

        var btnPdf = document.getElementById('detalhePdfBtn');
        btnPdf.onclick = function () { gerarPdfRelatorio(id); };

        var btnWhatsapp = document.getElementById('detalheWhatsappBtn');
        if (btnWhatsapp) btnWhatsapp.onclick = function () { compartilharWhatsapp(id); };

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

    function blocoItensDetalhe(itens) {
        var titulo = '<h4 style="margin:12px 0 6px;color:#0056b3;">Atividades por Ordem de Serviço</h4>';

        if (!itens || itens.length === 0) {
            return titulo + '<div class="detalhe-texto">Nenhuma atividade registrada.</div>';
        }

        var cartoes = itens.map(function (i) {
            var slug = statusOsSlug(i.status_os);
            return '<div class="item-os-card" style="padding:16px 18px 18px;"' +
                (slug ? ' data-status="' + slug + '"' : '') + '>' +
                '<div class="item-os-cabecalho">' +
                '<span class="item-os-titulo">' + escapar(i.numero_ordem) + '</span>' +
                '<span class="status-badge ' + classeStatusOs(i.status_os) + '">' +
                escapar(i.status_os) + '</span></div>' +
                '<div class="detalhe-grid">' +
                item('Atividade realizada', i.atividade_realizada) +
                item('Quantidade', i.quantidade) +
                item('Unidade de medida', i.unidade_medida) +
                '</div>' +
                (i.observacoes ? '<p style="margin:6px 0 0;"><strong>Observações:</strong> ' +
                    escapar(i.observacoes) + '</p>' : '') +
                (i.status_os === 'Não concluída' ? '<p style="margin:6px 0 0;color:#721c24;"><strong>Motivo:</strong> ' +
                    escapar(i.motivo) + '</p>' : '') +
                '</div>';
        }).join('<div style="height:10px;"></div>');

        return titulo + cartoes;
    }

    // ---------------------------------------------------------------
    // PDF
    // ---------------------------------------------------------------
    function gerarPdfRelatorio(id) {
        var r = estado.registros.find(function (item) { return item.id === id; });
        if (!r || !window.GML_PDF) return;

        var itensRelatorio = estado.itensPorRelatorio[r.id] || [];

        var linhasItens = itensRelatorio.map(function (i) {
            return [
                i.numero_ordem,
                i.status_os,
                i.atividade_realizada,
                i.quantidade !== null && i.quantidade !== undefined ? i.quantidade : '-',
                i.unidade_medida,
                i.status_os === 'Não concluída' ? i.motivo : i.observacoes,
            ];
        });

        var corpo =
            '<div class="pdf-secao"><h2>Identificação</h2>' +
            GML_PDF.blocoGrid([
                { label: 'Data', valor: formatarData(r.data) },
                { label: 'Turno', valor: r.turno },
                { label: 'Equipe', valor: r.equipe },
                { label: 'Responsável', valor: r.responsavel },
                { label: 'Status', valor: r.status },
                { label: 'Limpeza da viatura', valor: r.viatura_limpeza },
                { label: 'Alterações na viatura', valor: r.viatura_alteracoes },
                { label: 'Abastecimento', valor: r.abastecimentos_realizados },
            ]) + '</div>' +
            GML_PDF.blocoTabela('Atividades por Ordem de Serviço',
                ['Nº da O.S.', 'Status', 'Atividade realizada', 'Qtd.', 'Unidade', 'Observações / Motivo'],
                linhasItens) +
            GML_PDF.blocoTexto('Bairros patrulhados', r.bairros_patrulhados) +
            GML_PDF.blocoTexto('Ocorrências atendidas', r.ocorrencias_atendidas) +
            GML_PDF.blocoTexto('Materiais utilizados', r.materiais_utilizados) +
            (r.viatura_alteracoes === 'Com alterações'
                ? GML_PDF.blocoTexto('Descrição das alterações encontradas na viatura', r.alteracoes_viaturas)
                : '') +
            GML_PDF.blocoTexto('Observações', r.observacoes);

        GML_PDF.gerar({
            titulo: 'RELATÓRIO DIÁRIO DE SERVIÇO',
            subtitulo: formatarData(r.data) + ' - ' + (r.turno || '') + ' - ' + (r.equipe || ''),
            corpo: corpo,
            assinaturas: [
                r.assinatura_responsavel || 'Responsável pela equipe',
                'Comando da Guarda Municipal',
            ],
        });
    }

    // ---------------------------------------------------------------
    // COMPARTILHAR NO WHATSAPP
    // ---------------------------------------------------------------
    // Monta um texto simples (formatação *negrito* do próprio WhatsApp)
    // com o resumo do relatório, pronto para colar numa conversa.
    function montarTextoWhatsapp(r) {
        var itensRelatorio = estado.itensPorRelatorio[r.id] || [];
        var linhas = [];

        linhas.push('📋 *RELATÓRIO DIÁRIO — GML*');
        linhas.push('📅 *Data:* ' + formatarData(r.data));
        if (r.turno) linhas.push('🕐 *Turno:* ' + r.turno);
        if (r.equipe) linhas.push('👥 *Equipe:* ' + r.equipe);
        if (r.responsavel) linhas.push('👤 *Responsável:* ' + r.responsavel);
        if (r.status) linhas.push('📌 *Status:* ' + r.status);
        if (r.viatura_limpeza) linhas.push('🧼 *Limpeza da viatura:* ' + r.viatura_limpeza);
        if (r.viatura_alteracoes) linhas.push('🔧 *Alterações na viatura:* ' + r.viatura_alteracoes);
        if (r.abastecimentos_realizados) linhas.push('⛽ *Abastecimento:* ' + r.abastecimentos_realizados);

        function blocoTexto(titulo, texto) {
            if (!texto) return;
            linhas.push('');
            linhas.push('*' + titulo + ':*');
            linhas.push(texto);
        }

        blocoTexto('Bairros patrulhados', r.bairros_patrulhados);
        blocoTexto('Ocorrências atendidas', r.ocorrencias_atendidas);

        if (itensRelatorio.length > 0) {
            linhas.push('');
            linhas.push('*Atividades por Ordem de Serviço:*');
            itensRelatorio.forEach(function (item, indice) {
                linhas.push((indice + 1) + '. ' + item.numero_ordem + ' — ' + item.status_os);
                if (item.atividade_realizada) linhas.push('   Atividade: ' + item.atividade_realizada);
                if (item.quantidade !== null && item.quantidade !== undefined && item.quantidade !== '') {
                    linhas.push('   Qtd: ' + item.quantidade + (item.unidade_medida ? ' ' + item.unidade_medida : ''));
                }
                if (item.status_os === 'Não concluída' && item.motivo) {
                    linhas.push('   Motivo: ' + item.motivo);
                } else if (item.observacoes) {
                    linhas.push('   Obs: ' + item.observacoes);
                }
            });
        }

        blocoTexto('Materiais utilizados', r.materiais_utilizados);
        if (r.viatura_alteracoes === 'Com alterações') {
            blocoTexto('Descrição das alterações na viatura', r.alteracoes_viaturas);
        }
        blocoTexto('Observações', r.observacoes);

        if (r.assinatura_responsavel) {
            linhas.push('');
            linhas.push('✍️ Assinatura: ' + r.assinatura_responsavel);
        }

        return linhas.join('\n');
    }

    function copiarTextoFallback(texto) {
        var textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        var copiou = false;
        try { copiou = document.execCommand('copy'); } catch (e) { copiou = false; }
        document.body.removeChild(textarea);
        return copiou;
    }

    function compartilharWhatsapp(id) {
        var r = estado.registros.find(function (item) { return item.id === id; });
        if (!r) return;

        var texto = montarTextoWhatsapp(r);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(function () {
                mostrarToast('Texto copiado! Já pode colar no WhatsApp.', 'success');
            }).catch(function () {
                var copiou = copiarTextoFallback(texto);
                mostrarToast(copiou
                    ? 'Texto copiado! Já pode colar no WhatsApp.'
                    : 'Não foi possível copiar automaticamente. Copie manualmente pela tela de detalhes.', copiou ? 'success' : 'error');
            });
        } else {
            var copiou = copiarTextoFallback(texto);
            mostrarToast(copiou
                ? 'Texto copiado! Já pode colar no WhatsApp.'
                : 'Não foi possível copiar automaticamente. Copie manualmente pela tela de detalhes.', copiou ? 'success' : 'error');
        }
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

    function numeroOuNulo(valor) {
        if (valor === '' || valor === null || valor === undefined) return null;
        var n = parseFloat(valor);
        return isNaN(n) ? null : n;
    }

    function textoOuNulo(valor) {
        var t = (valor || '').trim();
        return t === '' ? null : t;
    }

    function escapar(valor) {
        if (valor === null || valor === undefined || valor === '') return '-';
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Como escapar(), mas preserva string vazia (para uso em atributos value="" de inputs)
    function escaparAtributo(valor) {
        if (valor === null || valor === undefined) return '';
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    window.initRelatorioDiario = initRelatorioDiario;
})();
