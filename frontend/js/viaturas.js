(function () {
    'use strict';

    // Escapa texto vindo do banco antes de inserir em HTML (evita XSS)
    function esc(valor) {
        if (valor === null || valor === undefined) return '';
        return String(valor)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Aceita somente links de foto https (bloqueia javascript:, data: etc.)
    function urlSegura(url) {
        try {
            const u = new URL(String(url), window.location.href);
            return u.protocol === 'https:' ? u.href : null;
        } catch (e) {
            return null;
        }
    }

    // ===============================================================
    //  Controle de Viaturas GML
    //  Integração completa com Supabase
    //  Tabelas: saidas_viaturas, abastecimentos
    // ===============================================================

    // ---------------------------------------------------------------
    // DADOS ESTÁTICOS (selects)
    // ---------------------------------------------------------------
    const VIATURAS = [
        { value: 'Nissan Frontier 0110', label: 'Nissan Frontier 0110' },
        { value: 'Chevrolet S10 0111', label: 'Chevrolet S10 0111' },
        { value: 'Fiat Pulse 0112', label: 'Fiat Pulse 0112' },
        { value: 'Vectra 0109', label: 'Vectra 0109' },
        { value: 'MOTO 1350 HARLEY DAVIDSON 0107', label: 'MOTO GM07' },
    ];

    const MOTORISTAS = [
        { value: 'Sayonara Jacques Vieira', label: 'Jacques' },
        { value: 'Leandro De Araujo', label: 'Leandro' },
        { value: 'Arlon Luiz Da Silva', label: 'Arlon' },
        { value: 'Luiz Eduardo Cortegrosso Silva', label: 'Luiz' },
        { value: 'Jair pacheco Dos Reis Junior', label: 'Reis' },
        { value: 'Luciano Ferreira', label: 'Ferreira' },
        { value: 'Saleide Flor Duarte', label: 'Duarte' },
        { value: 'Maik custodio Agostinho', label: 'Maik' },
    ];

    const INSPETORES = [
        { value: 'Maik', label: 'Maik' },
        { value: 'Leandro', label: 'Leandro' },
        { value: 'Ferreira', label: 'Ferreira' },
        { value: 'Duarte', label: 'Duarte' },
        { value: 'Luiz', label: 'Luiz' },
        { value: 'Jacques', label: 'Jacques' },
    ];

    const PATRULHEIROS = MOTORISTAS;

    const PATRULHAMENTOS = [
        'Ronda Preventiva',
        'Apoio Operacional',
        'Evento Especial',
        'Atendimento Emergencial',
        'Missão',
        'Manutenção de viatura',
        'Outros',
    ];

    // ---------------------------------------------------------------
    // INICIALIZAÇÃO
    // ---------------------------------------------------------------
    async function initSistema() {
        console.log('Sistema de controle de viaturas inicializado.');

        preencherCombos();
        await carregarDados();
        atualizarContadores();
        configurarEventos();
    }

    // ---------------------------------------------------------------
    // PREENCHER SELECTS
    // ---------------------------------------------------------------
    function preencherCombos() {
        preencherSelect('viatura', VIATURAS);
        preencherSelect('viatura_abastecimento', VIATURAS);
        preencherSelect('motorista', MOTORISTAS);
        preencherSelect('motorista_abastecimento', MOTORISTAS);
        preencherSelect('patrulheiro', PATRULHEIROS);
        preencherSelect('inspetor', INSPETORES);
        preencherSelectSimples('patrulhamento', PATRULHAMENTOS);
    }

    function preencherSelect(id, itens) {
        const el = document.getElementById(id);
        if (!el) return;
        while (el.options.length > 1) el.remove(1);
        itens.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.value;
            opt.textContent = item.label;
            el.appendChild(opt);
        });
    }

    function preencherSelectSimples(id, itens) {
        const el = document.getElementById(id);
        if (!el) return;
        while (el.options.length > 1) el.remove(1);
        itens.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            el.appendChild(opt);
        });
    }

    // ---------------------------------------------------------------
    // EVENTOS
    // ---------------------------------------------------------------
    function configurarEventos() {
        // Formulário de saída
        const formSaida = document.getElementById('saidaViaturaForm');
        if (formSaida) {
            formSaida.addEventListener('submit', handleRegistrarSaida);
        }

        // Modal de volta
        document.getElementById('modalCancelarBtn')?.addEventListener('click', fecharModal);
        document.getElementById('modalSalvarBtn')?.addEventListener('click', handleRegistrarVolta);
        document.getElementById('voltaModal')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) fecharModal();
        });

        // Delegação de clique na tabela de saídas
        document.getElementById('tabelaSaidasBody')?.addEventListener('click', e => {
            const btn = e.target.closest('.btn-volta');
            if (btn) abrirModalVolta(btn.dataset.rowId);
        });

        // Formulário de abastecimento
        const formAbast = document.getElementById('abastecimentoForm');
        if (formAbast) {
            formAbast.addEventListener('submit', handleRegistrarAbastecimento);

            // Cálculo automático km rodado / média
            ['km_abastecimento', 'km_atual', 'litros'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', calcularAbastecimento);
            });
        }

        // Filtro de busca
        document.getElementById('filtroBusca')?.addEventListener('input', filtrarTabela);
    }

    // ---------------------------------------------------------------
    // SAÍDA DE VIATURA
    // ---------------------------------------------------------------
    async function handleRegistrarSaida(event) {
        event.preventDefault();
        const form = event.target;
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        try {
            const supabase = getSupabase();
            const agora = new Date().toISOString();

            const registro = {
                viatura: form.viatura.value,
                km_saida: parseFloat(form.km_saida.value),
                protocolo: form.protocolo.value ? parseInt(form.protocolo.value) : null,
                inspetor: form.inspetor.value,
                motorista: form.motorista.value,
                patrulheiro: form.patrulheiro.value,
                patrulhamento: form.patrulhamento.value,
                data_saida: agora,
                status: 'em_operacao',
            };

            const { data, error } = await supabase
                .from('saidas_viaturas')
                .insert([registro])
                .select()
                .single();

            if (error) throw error;

            adicionarLinhaSaida(data);
            form.reset();
            atualizarContadores();
            mostrarToast('Saída registrada com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao registrar saída:', err);
            mostrarToast('Erro ao registrar saída: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Registrar Saída';
        }
    }

    function adicionarLinhaSaida(registro) {
        const tbody = document.getElementById('tabelaSaidasBody');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.id = 'row-' + registro.id;
        tr.dataset.id = registro.id;

        const dataHora = new Date(registro.data_saida).toLocaleString('pt-BR');

        tr.innerHTML = `
            <td>${esc(registro.viatura)}</td>
            <td>${dataHora}</td>
            <td>${esc(registro.km_saida)}</td>
            <td>${esc(registro.motorista)}</td>
            <td>${esc(registro.protocolo ?? '-')}</td>
            <td class="cell-data-chegada">-</td>
            <td class="cell-km-chegada">-</td>
            <td class="cell-km-rodado">-</td>
            <td class="cell-fotos">-</td>
            <td class="cell-obs">-</td>
            <td>
                <button class="btn btn-success btn-volta" data-row-id="row-${esc(registro.id)}">
                    Registrar Volta
                </button>
            </td>
        `;

        tbody.insertBefore(tr, tbody.firstChild);
    }

    // ---------------------------------------------------------------
    // MODAL DE VOLTA
    // ---------------------------------------------------------------
    function abrirModalVolta(rowId) {
        const linha = document.getElementById(rowId);
        if (!linha) return;

        const viatura = linha.cells[0].textContent;
        const kmSaida = linha.cells[2].textContent;

        document.getElementById('modalViaturaInfo').textContent =
            `Viatura: ${viatura} | Km Saída: ${kmSaida}`;
        document.getElementById('modalRowId').value = rowId;

        // Formatar a data/hora atual para o formato datetime-local
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
        document.getElementById('modalDataChegada').value = localISOTime;

        document.getElementById('modalKmChegada').value = '';
        document.getElementById('modalKmChegada').min = kmSaida;
        document.getElementById('modalComentarios').value = '';
        document.getElementById('modalFoto').value = '';

        const erro = document.getElementById('modalErro');
        erro.style.display = 'none';

        document.getElementById('voltaModal').style.display = 'flex';
    }

    function fecharModal() {
        document.getElementById('voltaModal').style.display = 'none';
    }

    async function handleRegistrarVolta() {
        const rowId = document.getElementById('modalRowId').value;
        const linha = document.getElementById(rowId);
        if (!linha) return;

        const kmSaida = parseFloat(linha.cells[2].textContent);
        const dataChegada = document.getElementById('modalDataChegada').value;
        const kmChegadaVal = document.getElementById('modalKmChegada').value;
        const kmChegada = parseFloat(kmChegadaVal);
        const comentarios = document.getElementById('modalComentarios').value;
        const erroEl = document.getElementById('modalErro');
        const salvarBtn = document.getElementById('modalSalvarBtn');

        erroEl.style.display = 'none';

        if (isNaN(kmChegada) || kmChegada < kmSaida) {
            erroEl.textContent = 'ERRO: O Km de Chegada deve ser maior ou igual ao Km de Saída.';
            erroEl.style.display = 'block';
            return;
        }

        salvarBtn.disabled = true;
        salvarBtn.textContent = 'Salvando...';

        try {
            const supabase = getSupabase();
            const registroId = linha.dataset.id;
            const kmRodado = kmChegada - kmSaida;

            // Upload de fotos (Supabase Storage), se houver
            const fotoInput = document.getElementById('modalFoto');
            const fotosUrls = [];

            if (fotoInput.files.length > 0) {
                for (const file of fotoInput.files) {
                    const nomeSeguro = String(file.name || 'foto').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
                    const nomeArquivo = `viaturas/${registroId}/${Date.now()}_${nomeSeguro}`;
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('fotos-viaturas')
                        .upload(nomeArquivo, file, { upsert: true });

                    if (!uploadError && uploadData) {
                        const { data: urlData } = supabase.storage
                            .from('fotos-viaturas')
                            .getPublicUrl(nomeArquivo);
                        fotosUrls.push(urlData.publicUrl);
                    }
                }
            }

            const { error } = await supabase
                .from('saidas_viaturas')
                .update({
                    km_chegada: kmChegada,
                    km_rodado: kmRodado,
                    observacoes: comentarios || null,
                    fotos: fotosUrls.length > 0 ? fotosUrls : null,
                    status: 'finalizado',
                    data_chegada: new Date(dataChegada).toISOString(),
                })
                .eq('id', registroId);

            if (error) throw error;

            // Atualiza linha na tabela
            linha.querySelector('.cell-data-chegada').textContent = new Date(dataChegada).toLocaleString('pt-BR');
            linha.querySelector('.cell-km-chegada').textContent = kmChegada;
            linha.querySelector('.cell-km-rodado').textContent = kmRodado.toFixed(1);
            linha.querySelector('.cell-obs').textContent = comentarios || 'Sem observações';

            const fotoCell = linha.querySelector('.cell-fotos');
            fotoCell.innerHTML = '';
            if (fotosUrls.length > 0) {
                fotosUrls.map(urlSegura).filter(Boolean).forEach(url => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    const img = document.createElement('img');
                    img.src = url;
                    img.style.cssText = 'width:60px;height:60px;object-fit:cover;margin:2px;border-radius:4px;border:1px solid #ddd;cursor:pointer;';
                    a.appendChild(img);
                    fotoCell.appendChild(a);
                });
            } else {
                fotoCell.textContent = 'Sem foto';
            }

            linha.cells[10].innerHTML = '<button class="btn btn-secondary" disabled>Finalizado</button>';
            linha.classList.add('viagem-finalizada');

            fecharModal();
            atualizarContadores();
            mostrarToast('Chegada registrada com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao registrar volta:', err);
            erroEl.textContent = 'Erro ao salvar: ' + err.message;
            erroEl.style.display = 'block';
        } finally {
            salvarBtn.disabled = false;
            salvarBtn.textContent = 'Salvar';
        }
    }

    // ---------------------------------------------------------------
    // ABASTECIMENTO
    // ---------------------------------------------------------------
    function calcularAbastecimento() {
        const km1 = parseFloat(document.getElementById('km_abastecimento').value);
        const km2 = parseFloat(document.getElementById('km_atual').value);
        const litros = parseFloat(document.getElementById('litros').value);

        const kmRodadoInput = document.getElementById('km_rodado');
        const mediaInput = document.getElementById('media_km_l');

        if (!isNaN(km1) && !isNaN(km2) && km2 > km1) {
            const rodado = km2 - km1;
            kmRodadoInput.value = rodado.toFixed(0);
            if (!isNaN(litros) && litros > 0) {
                mediaInput.value = (rodado / litros).toFixed(2) + ' KM/L';
            } else {
                mediaInput.value = '';
            }
        } else {
            kmRodadoInput.value = '';
            mediaInput.value = '';
        }
    }

    async function handleRegistrarAbastecimento(event) {
        event.preventDefault();
        const form = event.target;
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        try {
            const supabase = getSupabase();
            const kmAbast = parseFloat(document.getElementById('km_abastecimento').value);
            const kmAtual = parseFloat(document.getElementById('km_atual').value);
            const litros = parseFloat(document.getElementById('litros').value);
            const kmRodado = kmAtual - kmAbast;
            const media = litros > 0 ? kmRodado / litros : null;

            const registro = {
                viatura: form.viatura_abastecimento.value,
                data_abastecimento: form.data_abastecimento.value,
                km_abastecimento: kmAbast,
                km_atual: kmAtual,
                litros: litros,
                km_rodado: kmRodado,
                media_km_l: media,
                motorista: form.motorista_abastecimento.value,
            };

            const { data, error } = await supabase
                .from('abastecimentos')
                .insert([registro])
                .select()
                .single();

            if (error) throw error;

            adicionarLinhaAbastecimento(data);
            form.reset();
            document.getElementById('km_rodado').value = '';
            document.getElementById('media_km_l').value = '';
            mostrarToast('Abastecimento registrado com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao registrar abastecimento:', err);
            mostrarToast('Erro ao registrar abastecimento: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Registrar Abastecimento';
        }
    }

    function adicionarLinhaAbastecimento(registro) {
        const tbody = document.querySelector('#tabelaAbastecimento tbody');
        if (!tbody) return;

        let dataStr = '-';
        if (registro.data_abastecimento) {
            const dataObj = registro.data_abastecimento.includes('T') ? new Date(registro.data_abastecimento) : new Date(registro.data_abastecimento + 'T00:00:00');
            dataStr = dataObj.toLocaleString('pt-BR');
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${esc(registro.viatura)}</td>
            <td>${esc(dataStr)}</td>
            <td>${esc(registro.km_abastecimento)}</td>
            <td>${esc(registro.km_atual)}</td>
            <td>${esc(registro.litros)}</td>
            <td>${esc(registro.km_rodado)}</td>
            <td>${registro.media_km_l ? esc(Number(registro.media_km_l).toFixed(2)) + ' KM/L' : '-'}</td>
        `;
        tbody.insertBefore(tr, tbody.firstChild);
    }

    // ---------------------------------------------------------------
    // CARREGAR DADOS DO SUPABASE
    // ---------------------------------------------------------------
    async function carregarDados() {
        try {
            const supabase = getSupabase();

            // Usando Promise.all para carregar saídas e abastecimentos paralelamente
            const [saidasResult, abastResult] = await Promise.all([
                supabase.from('saidas_viaturas').select('*').order('data_saida', { ascending: false }).limit(100),
                supabase.from('abastecimentos').select('*').order('data_abastecimento', { ascending: false }).limit(100)
            ]);

            if (saidasResult.error) throw saidasResult.error;
            if (abastResult.error) throw abastResult.error;

            const tbody = document.getElementById('tabelaSaidasBody');
            if (tbody && saidasResult.data) {
                tbody.innerHTML = '';
                saidasResult.data.forEach(registro => {
                    if (registro.status === 'finalizado') {
                        adicionarLinhaSaidaFinalizada(registro);
                    } else {
                        adicionarLinhaSaida(registro);
                    }
                });
            }

            const tbodyAbast = document.querySelector('#tabelaAbastecimento tbody');
            if (tbodyAbast && abastResult.data) {
                tbodyAbast.innerHTML = '';
                abastResult.data.forEach(registro => adicionarLinhaAbastecimento(registro));
            }
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            mostrarToast('Erro ao carregar dados: ' + err.message, 'error');
        }
    }

    function adicionarLinhaSaidaFinalizada(registro) {
        const tbody = document.getElementById('tabelaSaidasBody');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.id = 'row-' + registro.id;
        tr.dataset.id = registro.id;
        tr.classList.add('viagem-finalizada');

        const dataHora = new Date(registro.data_saida).toLocaleString('pt-BR');
        const kmRodado = registro.km_rodado ?? (registro.km_chegada - registro.km_saida);
        const dataHoraChegada = registro.data_chegada ? new Date(registro.data_chegada).toLocaleString('pt-BR') : '-';

        // Fotos
        let fotosHtml = 'Sem foto';
        if (registro.fotos && registro.fotos.length > 0) {
            const fotosValidas = registro.fotos.map(urlSegura).filter(Boolean);
            if (fotosValidas.length > 0) fotosHtml = fotosValidas.map(url =>
                `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">
                    <img src="${esc(url)}" alt="Foto da viatura" style="width:60px;height:60px;object-fit:cover;margin:2px;border-radius:4px;border:1px solid #ddd;cursor:pointer;">
                </a>`
            ).join('');
        }

        tr.innerHTML = `
            <td>${esc(registro.viatura)}</td>
            <td>${dataHora}</td>
            <td>${esc(registro.km_saida)}</td>
            <td>${esc(registro.motorista)}</td>
            <td>${esc(registro.protocolo ?? '-')}</td>
            <td class="cell-data-chegada">${dataHoraChegada}</td>
            <td class="cell-km-chegada">${esc(registro.km_chegada ?? '-')}</td>
            <td class="cell-km-rodado">${Number.isFinite(Number(kmRodado)) ? Number(kmRodado).toFixed(1) : '-'}</td>
            <td class="cell-fotos">${fotosHtml}</td>
            <td class="cell-obs">${esc(registro.observacoes ?? 'Sem observações')}</td>
            <td><button class="btn btn-secondary" disabled>Finalizado</button></td>
        `;

        tbody.appendChild(tr);
    }

    // ---------------------------------------------------------------
    // FILTRO
    // ---------------------------------------------------------------
    function filtrarTabela() {
        const termo = document.getElementById('filtroBusca').value.trim().toLowerCase();
        const linhas = document.querySelectorAll('#tabelaSaidasBody tr');

        linhas.forEach(linha => {
            const viatura = (linha.cells[0]?.textContent || '').toLowerCase();
            const motorista = (linha.cells[3]?.textContent || '').toLowerCase();
            const protocolo = (linha.cells[4]?.textContent || '').toLowerCase();

            const corresponde = termo === '' ||
                viatura.includes(termo) ||
                motorista.includes(termo) ||
                protocolo.includes(termo);

            linha.style.display = corresponde ? '' : 'none';
        });
    }

    // ---------------------------------------------------------------
    // CONTADORES
    // ---------------------------------------------------------------
    function atualizarContadores() {
        const linhas = document.querySelectorAll('#tabelaSaidasBody tr');
        let emOperacao = 0, finalizadas = 0, totalKm = 0;

        linhas.forEach(linha => {
            if (linha.style.display === 'none') return;
            if (linha.classList.contains('viagem-finalizada')) {
                finalizadas++;
                const kmTexto = linha.querySelector('.cell-km-rodado')?.textContent || '';
                const km = parseFloat(kmTexto.replace(',', '.').replace(/[^\d.-]/g, ''));
                if (!isNaN(km)) totalKm += km;
            } else {
                emOperacao++;
            }
        });

        const emOpEl = document.getElementById('contadorEmOperacao');
        const finEl = document.getElementById('contadorFinalizadas');
        const kmEl = document.getElementById('contadorTotalKm');

        if (emOpEl) emOpEl.textContent = emOperacao;
        if (finEl) finEl.textContent = finalizadas;
        if (kmEl) kmEl.textContent = totalKm.toFixed(1);
    }

    // ---------------------------------------------------------------
    // TOAST DE NOTIFICAÇÃO
    // ---------------------------------------------------------------
    function mostrarToast(mensagem, tipo = 'success') {
        let toast = document.getElementById('gml-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'gml-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                padding: 12px 20px;
                border-radius: 8px;
                color: #fff;
                font-size: 14px;
                font-weight: 500;
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease;
                max-width: 320px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = mensagem;
        toast.style.backgroundColor = tipo === 'success' ? '#28a745' : '#dc3545';
        toast.style.opacity = '1';

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = '0';
        }, 3500);
    }

    window.initSistema = initSistema;
})();
