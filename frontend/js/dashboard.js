(function () {
    'use strict';

    // ===============================================================
    //  Dashboard Operacional GML
    //  Le direto do Supabase (mesmo padrao de viaturas.js)
    //  Tabelas: saidas_viaturas, abastecimentos,
    //           ordens_servico, relatorios_diarios
    // ===============================================================

    var CORES = {
        azul: 'rgba(0, 86, 179, 0.7)',
        azulBorda: '#0056b3',
        verde: 'rgba(40, 167, 69, 0.7)',
        verdeBorda: '#28a745',
        laranja: 'rgba(255, 193, 7, 0.7)',
        laranjaBorda: '#ffc107',
        ciano: 'rgba(23, 162, 184, 0.7)',
        cianoBorda: '#17a2b8',
    };

    // Instancias dos graficos, para permitir atualizacao sem duplicar
    var graficos = {};

    // ---------------------------------------------------------------
    // INICIALIZACAO
    // ---------------------------------------------------------------
    async function initDashboard() {
        console.log('Dashboard operacional inicializado.');

        var btnAtualizar = document.getElementById('btnAtualizarDashboard');
        if (btnAtualizar) {
            btnAtualizar.addEventListener('click', function () {
                carregarDashboard(true);
            });
        }

        await carregarDashboard(false);

        // Atualizacao automatica dos indicadores a cada 60 segundos
        setInterval(function () { carregarDashboard(false); }, 60000);

        // Recarrega ao voltar para a aba (dados podem ter mudado em outro modulo)
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) carregarDashboard(false);
        });
    }

    // ---------------------------------------------------------------
    // CARGA DE DADOS
    // ---------------------------------------------------------------
    async function carregarDashboard(avisar) {
        try {
            var supabase = getSupabase();

            // ordens_servico e relatorios_diarios podem ainda nao existir
            // no banco (migration 002 nao aplicada). Tratamos com tolerancia.
            var resultados = await Promise.all([
                supabase.from('saidas_viaturas').select('*').order('data_saida', { ascending: false }).limit(1000),
                supabase.from('abastecimentos').select('*').order('data_abastecimento', { ascending: false }).limit(1000),
                supabase.from('ordens_servico').select('*').limit(1000),
                supabase.from('relatorios_diarios').select('*').limit(1000),
            ]);

            var saidas = resultados[0].data || [];
            var abastecimentos = resultados[1].data || [];
            var ordens = resultados[2].data || [];
            var relatorios = resultados[3].data || [];

            if (resultados[0].error) throw resultados[0].error;
            if (resultados[1].error) throw resultados[1].error;
            if (resultados[2].error) {
                console.warn('Tabela ordens_servico indisponivel:', resultados[2].error.message);
            }
            if (resultados[3].error) {
                console.warn('Tabela relatorios_diarios indisponivel:', resultados[3].error.message);
            }

            atualizarIndicadores(saidas, abastecimentos, ordens, relatorios);
            renderGraficoSaidasPorDia(saidas);
            renderGraficoConsumoCombustivel(abastecimentos);
            renderGraficoUtilizacaoViaturas(saidas);
            renderGraficoAbastecimentosMes(abastecimentos);

            if (avisar) mostrarToast('Indicadores atualizados!', 'success');
        } catch (err) {
            console.error('Erro ao carregar dashboard:', err);
            mostrarToast('Erro ao carregar dashboard: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // INDICADORES (CARDS)
    // ---------------------------------------------------------------
    function atualizarIndicadores(saidas, abastecimentos, ordens, relatorios) {
        var totalFrota = (window.GML_DADOS && GML_DADOS.VIATURAS) ? GML_DADOS.VIATURAS.length : 0;
        var hoje = hojeISO();

        // Viaturas em servico: saidas ainda sem chegada registrada
        var emServicoSet = {};
        saidas.forEach(function (s) {
            if (s.status !== 'finalizado' && !s.km_chegada) emServicoSet[s.viatura] = true;
        });
        var emServico = Object.keys(emServicoSet).length;

        // Viaturas em manutencao: patrulhamento de manutencao ainda em aberto
        // ou O.S. de manutencao em andamento
        var manutencaoSet = {};
        saidas.forEach(function (s) {
            if (s.status !== 'finalizado' && s.patrulhamento === 'Manutenção de viatura') {
                manutencaoSet[s.viatura] = true;
            }
        });
        ordens.forEach(function (o) {
            if (o.tipo_servico === 'Manutenção' && o.viatura &&
                (o.status === 'Aberta' || o.status === 'Em andamento')) {
                manutencaoSet[o.viatura] = true;
            }
        });
        var emManutencao = Object.keys(manutencaoSet).length;

        // Disponiveis: frota total menos as ocupadas (servico + manutencao)
        var ocupadas = {};
        Object.keys(emServicoSet).forEach(function (v) { ocupadas[v] = true; });
        Object.keys(manutencaoSet).forEach(function (v) { ocupadas[v] = true; });
        var disponiveis = Math.max(0, totalFrota - Object.keys(ocupadas).length);

        // Saidas e quilometragem do dia
        var saidasHoje = saidas.filter(function (s) {
            return dataLocalISO(s.data_saida) === hoje;
        });
        var kmHoje = saidasHoje.reduce(function (total, s) {
            var km = parseFloat(s.km_rodado);
            return total + (isNaN(km) ? 0 : km);
        }, 0);

        // Ordens de servico em andamento
        var ordensAndamento = ordens.filter(function (o) {
            return o.status === 'Em andamento';
        }).length;

        // Relatorios diarios enviados (enviado ou aprovado)
        var relatoriosEnviados = relatorios.filter(function (r) {
            return r.status === 'Enviado' || r.status === 'Aprovado';
        }).length;

        definirTexto('cardViaturasEmServico', emServico);
        definirTexto('cardViaturasDisponiveis', disponiveis);
        definirTexto('cardViaturasManutencao', emManutencao);
        definirTexto('cardSaidasDia', saidasHoje.length);
        definirTexto('cardAbastecimentos', abastecimentos.length);
        definirTexto('cardKmDia', kmHoje.toFixed(1));
        definirTexto('cardOrdensAndamento', ordensAndamento);
        definirTexto('cardRelatoriosEnviados', relatoriosEnviados);
    }

    function definirTexto(id, valor) {
        var el = document.getElementById(id);
        if (el) el.textContent = valor;
    }

    // ---------------------------------------------------------------
    // GRAFICOS
    // ---------------------------------------------------------------
    function renderGrafico(canvasId, config) {
        var canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;

        // Destroi a instancia anterior para evitar sobreposicao ao atualizar
        if (graficos[canvasId]) {
            graficos[canvasId].destroy();
        }
        graficos[canvasId] = new Chart(canvas, config);
    }

    function opcoesBase(exibirLegenda) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: !!exibirLegenda, position: 'bottom' },
            },
            scales: {
                y: { beginAtZero: true },
            },
        };
    }

    // Grafico 1: saidas por dia (ultimos 14 dias)
    function renderGraficoSaidasPorDia(saidas) {
        var dias = [];
        var contagem = {};

        for (var i = 13; i >= 0; i--) {
            var d = new Date();
            d.setDate(d.getDate() - i);
            var chave = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
            dias.push(chave);
            contagem[chave] = 0;
        }

        saidas.forEach(function (s) {
            var chave = dataLocalISO(s.data_saida);
            if (chave && contagem[chave] !== undefined) contagem[chave]++;
        });

        renderGrafico('graficoSaidasPorDia', {
            type: 'line',
            data: {
                labels: dias.map(function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7); }),
                datasets: [{
                    label: 'Saídas',
                    data: dias.map(function (d) { return contagem[d]; }),
                    backgroundColor: CORES.azul,
                    borderColor: CORES.azulBorda,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                }],
            },
            options: opcoesBase(false),
        });
    }

    // Grafico 2: consumo de combustivel (litros por mes)
    function renderGraficoConsumoCombustivel(abastecimentos) {
        var meses = ultimosMeses(6);
        var litrosPorMes = {};
        meses.forEach(function (m) { litrosPorMes[m.chave] = 0; });

        abastecimentos.forEach(function (a) {
            var chave = dataLocalISO(a.data_abastecimento);
            if (!chave) return;
            chave = chave.slice(0, 7);
            if (litrosPorMes[chave] !== undefined) {
                var litros = parseFloat(a.litros);
                litrosPorMes[chave] += isNaN(litros) ? 0 : litros;
            }
        });

        renderGrafico('graficoConsumoCombustivel', {
            type: 'bar',
            data: {
                labels: meses.map(function (m) { return m.label; }),
                datasets: [{
                    label: 'Litros',
                    data: meses.map(function (m) {
                        return Number(litrosPorMes[m.chave].toFixed(2));
                    }),
                    backgroundColor: CORES.laranja,
                    borderColor: CORES.laranjaBorda,
                    borderWidth: 1,
                }],
            },
            options: opcoesBase(false),
        });
    }

    // Grafico 3: utilizacao das viaturas (km rodado acumulado)
    function renderGraficoUtilizacaoViaturas(saidas) {
        var kmPorViatura = {};

        saidas.forEach(function (s) {
            if (!s.viatura) return;
            var km = parseFloat(s.km_rodado);
            if (isNaN(km)) km = 0;
            kmPorViatura[s.viatura] = (kmPorViatura[s.viatura] || 0) + km;
        });

        var labels = Object.keys(kmPorViatura).sort();

        renderGrafico('graficoUtilizacaoViaturas', {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'KM rodado',
                    data: labels.map(function (v) {
                        return Number(kmPorViatura[v].toFixed(1));
                    }),
                    backgroundColor: CORES.verde,
                    borderColor: CORES.verdeBorda,
                    borderWidth: 1,
                }],
            },
            options: Object.assign(opcoesBase(false), { indexAxis: 'y' }),
        });
    }

    // Grafico 4: quantidade de abastecimentos por mes
    function renderGraficoAbastecimentosMes(abastecimentos) {
        var meses = ultimosMeses(6);
        var qtdPorMes = {};
        meses.forEach(function (m) { qtdPorMes[m.chave] = 0; });

        abastecimentos.forEach(function (a) {
            var chave = dataLocalISO(a.data_abastecimento);
            if (!chave) return;
            chave = chave.slice(0, 7);
            if (qtdPorMes[chave] !== undefined) qtdPorMes[chave]++;
        });

        renderGrafico('graficoAbastecimentosMes', {
            type: 'bar',
            data: {
                labels: meses.map(function (m) { return m.label; }),
                datasets: [{
                    label: 'Abastecimentos',
                    data: meses.map(function (m) { return qtdPorMes[m.chave]; }),
                    backgroundColor: CORES.ciano,
                    borderColor: CORES.cianoBorda,
                    borderWidth: 1,
                }],
            },
            options: opcoesBase(false),
        });
    }

    // ---------------------------------------------------------------
    // AUXILIARES
    // ---------------------------------------------------------------
    var NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    /**
     * Converte um timestamp ISO (UTC) para o formato YYYY-MM-DD no
     * fuso local do navegador. Strings sem 'T' (data pura) sao
     * retornadas como estao, sem conversao.
     */
    function dataLocalISO(iso) {
        if (!iso) return null;
        if (iso.indexOf('T') < 0) return iso.slice(0, 10);

        var d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    function ultimosMeses(quantidade) {
        var lista = [];
        var hoje = new Date();
        for (var i = quantidade - 1; i >= 0; i--) {
            var d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            lista.push({
                chave: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
                label: NOMES_MESES[d.getMonth()] + '/' + String(d.getFullYear()).slice(2),
            });
        }
        return lista;
    }

    window.initDashboard = initDashboard;
    window.carregarDashboard = carregarDashboard;
})();
