(function () {
    'use strict';

    // ===============================================================
    //  Fotos do A.R.V.C (Auto de Remocao de Veiculo)
    //  Arquivos no Supabase Storage (bucket privado "bo-fotos");
    //  a lista fica na coluna boletins_ocorrencia.fotos (JSONB):
    //  [{ path: 'fotos/<id>.jpg', nome: 'IMG_123.jpg', legenda: 'Frente do veículo' }]
    // ===============================================================

    var BUCKET = 'bo-fotos';
    var MAX_FOTOS = 10;
    var LADO_MAXIMO = 1600;   // px - reduz fotos de celular antes de enviar
    var QUALIDADE_JPEG = 0.82;

    // Estado do formulario
    var form = {
        existentes: [],  // { path, nome, legenda, url } ja salvas no A.R.V.C em edicao
        novas: [],       // { nome, blob, previewUrl, legenda, enviado: {path,nome}|null }
        removidas: [],   // paths a apagar do storage depois de salvar
        processando: 0,  // fotos sendo preparadas
    };

    function storage() {
        return getSupabase().storage.from(BUCKET);
    }

    function escapar(valor) {
        return String(valor || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function idAleatorio() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    // Traduz erros do Supabase em mensagens com a solucao
    function explicarErro(err) {
        var msg = String((err && (err.message || err.error)) || err || '');
        if (/bucket not found/i.test(msg)) {
            return 'A pasta de fotos não existe no Supabase. Rode o SQL "010_bo_fotos.sql" no SQL Editor.';
        }
        if (/row-level security|unauthorized|not authorized|permission/i.test(msg)) {
            return 'Sem permissão para salvar fotos no Supabase. Rode o SQL "010_bo_fotos.sql" no SQL Editor.';
        }
        if (/fotos.*column|column.*fotos/i.test(msg)) {
            return 'O banco ainda não tem a coluna de fotos. Rode o SQL "010_bo_fotos.sql" no SQL Editor.';
        }
        if (/payload too large|exceeded the maximum allowed size/i.test(msg)) {
            return 'Foto grande demais para enviar.';
        }
        if (/failed to fetch|network/i.test(msg)) {
            return 'Sem conexão com a internet. Verifique a rede e tente de novo.';
        }
        return msg || 'Erro desconhecido.';
    }

    // ---------------------------------------------------------------
    // Preparacao da foto no aparelho (gira conforme a camera e reduz)
    // ---------------------------------------------------------------
    async function decodificar(file) {
        if (window.createImageBitmap) {
            try {
                return await createImageBitmap(file, { imageOrientation: 'from-image' });
            } catch (e) { /* tenta pelo <img> abaixo */ }
        }
        return new Promise(function (ok, falha) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () { URL.revokeObjectURL(url); ok(img); };
            img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('formato')); };
            img.src = url;
        });
    }

    async function comprimir(file) {
        var img;
        try {
            img = await decodificar(file);
        } catch (e) {
            var heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
            throw new Error(heic
                ? 'A foto "' + file.name + '" está em formato HEIC, que este navegador não abre. ' +
                  'No iPhone: Ajustes > Câmera > Formatos > "Mais Compatível".'
                : 'Não foi possível abrir a foto "' + file.name + '".');
        }
        var largura = img.width || img.naturalWidth;
        var altura = img.height || img.naturalHeight;
        var escala = Math.min(1, LADO_MAXIMO / Math.max(largura, altura));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(largura * escala);
        canvas.height = Math.round(altura * escala);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (img.close) img.close();
        return new Promise(function (ok, falha) {
            canvas.toBlob(function (blob) {
                blob ? ok(blob) : falha(new Error('Não foi possível processar a foto "' + file.name + '".'));
            }, 'image/jpeg', QUALIDADE_JPEG);
        });
    }

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------
    async function enviarBlob(blob, nome) {
        var path = 'fotos/' + idAleatorio() + '.jpg';
        var res = await storage().upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (res.error) throw new Error(explicarErro(res.error));
        return { path: path, nome: nome };
    }

    async function urlsAssinadas(fotos) {
        fotos = Array.isArray(fotos) ? fotos : [];
        if (fotos.length === 0) return [];
        var res = await storage().createSignedUrls(fotos.map(function (f) { return f.path; }), 3600);
        if (res.error) throw new Error(explicarErro(res.error));
        return (res.data || []).map(function (d) { return d.signedUrl || ''; });
    }

    async function apagar(paths) {
        paths = (paths || []).filter(Boolean);
        if (paths.length === 0) return;
        var res = await storage().remove(paths);
        if (res.error) console.warn('Nao foi possivel apagar fotos do storage:', res.error);
    }

    // ---------------------------------------------------------------
    // Formulario
    // ---------------------------------------------------------------
    function total() {
        return form.existentes.length + form.novas.length + form.processando;
    }

    function atualizarInfo() {
        var info = document.getElementById('fotosInfo');
        if (!info) return;
        var n = form.existentes.length + form.novas.length;
        var texto = n === 0
            ? 'Nenhuma foto adicionada. Até ' + MAX_FOTOS + ' fotos por A.R.V.C.'
            : n + ' de ' + MAX_FOTOS + ' fotos';
        if (form.processando > 0) texto += ' · preparando ' + form.processando + '...';
        info.textContent = texto;

        var campo = document.querySelector('.fotos-campo');
        if (campo) campo.classList.toggle('fotos-cheio', total() >= MAX_FOTOS);
    }

    function cartao(url, legenda, tipo, indice, numero, nova) {
        return '<div class="foto-card">' +
            '<div class="foto-img">' +
            (url ? '<img src="' + escapar(url) + '" alt="Foto ' + numero + '" loading="lazy">' : '<div class="foto-sem">Foto</div>') +
            '<span class="foto-numero">' + numero + '</span>' +
            (nova ? '<span class="foto-nova">nova</span>' : '') +
            '<button type="button" class="foto-remover" title="Remover foto" aria-label="Remover foto ' + numero + '" ' +
            'data-foto-tipo="' + tipo + '" data-foto-indice="' + indice + '"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
            '</div>' +
            '<input type="text" class="foto-legenda" maxlength="120" placeholder="Legenda (opcional)" ' +
            'value="' + escapar(legenda) + '" data-foto-tipo="' + tipo + '" data-foto-indice="' + indice + '">' +
            '</div>';
    }

    async function renderFormulario() {
        var area = document.getElementById('fotosPreview');
        atualizarInfo();
        if (!area) return;

        // URLs das fotos ja salvas (busca so as que ainda nao tem)
        var semUrl = form.existentes.filter(function (f) { return !f.url; });
        if (semUrl.length) {
            try {
                var urls = await urlsAssinadas(semUrl);
                semUrl.forEach(function (f, i) { f.url = urls[i]; });
            } catch (e) {
                console.warn('Nao foi possivel carregar as fotos salvas:', e);
            }
        }

        var html = '';
        var numero = 0;
        form.existentes.forEach(function (f, i) {
            html += cartao(f.url, f.legenda, 'existente', i, ++numero, false);
        });
        form.novas.forEach(function (n, i) {
            html += cartao(n.previewUrl, n.legenda, 'nova', i, ++numero, true);
        });
        for (var p = 0; p < form.processando; p++) {
            html += '<div class="foto-card foto-processando"><div class="foto-img"><div class="foto-sem">Preparando...</div></div></div>';
        }
        area.innerHTML = html;
    }

    async function adicionarArquivos(lista) {
        var arquivos = Array.prototype.slice.call(lista || []).filter(function (f) {
            return /^image\//.test(f.type) || /\.(jpe?g|png|webp|hei[cf])$/i.test(f.name);
        });
        if (arquivos.length === 0) return;

        var vagas = MAX_FOTOS - total();
        if (vagas <= 0) {
            mostrarToast('Limite de ' + MAX_FOTOS + ' fotos por A.R.V.C.', 'warning');
            return;
        }
        if (arquivos.length > vagas) {
            mostrarToast('Limite de ' + MAX_FOTOS + ' fotos por A.R.V.C. ' +
                (arquivos.length - vagas) + ' não foram adicionadas.', 'warning');
            arquivos = arquivos.slice(0, vagas);
        }

        form.processando += arquivos.length;
        renderFormulario();

        for (var i = 0; i < arquivos.length; i++) {
            var file = arquivos[i];
            try {
                var blob = await comprimir(file);
                form.novas.push({
                    nome: file.name || ('foto-' + (i + 1) + '.jpg'),
                    blob: blob,
                    previewUrl: URL.createObjectURL(blob),
                    legenda: '',
                    enviado: null,
                });
            } catch (err) {
                mostrarToast(err.message, 'error');
            } finally {
                form.processando--;
                renderFormulario();
            }
        }
    }

    function removerDoFormulario(tipo, indice) {
        if (tipo === 'existente') {
            var f = form.existentes.splice(indice, 1)[0];
            if (f) form.removidas.push(f.path);
        } else {
            var n = form.novas.splice(indice, 1)[0];
            if (n) {
                URL.revokeObjectURL(n.previewUrl);
                if (n.enviado) form.removidas.push(n.enviado.path);
            }
        }
        renderFormulario();
    }

    function limpar() {
        form.novas.forEach(function (n) { URL.revokeObjectURL(n.previewUrl); });
        form.existentes = [];
        form.novas = [];
        form.removidas = [];
        ['fotosInput', 'fotosCamera'].forEach(function (id) {
            var input = document.getElementById(id);
            if (input) input.value = '';
        });
        renderFormulario();
    }

    function carregarNoFormulario(fotos) {
        limpar();
        form.existentes = (Array.isArray(fotos) ? fotos : []).map(function (f) {
            return { path: f.path, nome: f.nome || '', legenda: f.legenda || '' };
        });
        renderFormulario();
    }

    function emProcessamento() {
        return form.processando > 0;
    }

    // Envia as fotos novas (so as que ainda nao subiram) e devolve a lista final
    async function prepararParaSalvar(aoProgredir) {
        var pendentes = form.novas.filter(function (n) { return !n.enviado; });
        for (var i = 0; i < pendentes.length; i++) {
            if (aoProgredir) aoProgredir(i + 1, pendentes.length);
            pendentes[i].enviado = await enviarBlob(pendentes[i].blob, pendentes[i].nome);
        }
        var limpa = function (texto) { return String(texto || '').trim(); };
        return form.existentes.map(function (f) {
            return { path: f.path, nome: f.nome, legenda: limpa(f.legenda) };
        }).concat(form.novas.map(function (n) {
            return { path: n.enviado.path, nome: n.enviado.nome, legenda: limpa(n.legenda) };
        }));
    }

    // Depois de salvar com sucesso: apaga do storage as fotos removidas
    async function concluirSalvamento() {
        await apagar(form.removidas);
        form.removidas = [];
    }

    function init() {
        ['fotosInput', 'fotosCamera'].forEach(function (id) {
            var input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('change', function () {
                adicionarArquivos(input.files);
                input.value = '';
            });
        });

        var area = document.getElementById('fotosPreview');
        if (area) {
            area.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-foto-tipo]');
                if (!btn) return;
                removerDoFormulario(btn.dataset.fotoTipo, parseInt(btn.dataset.fotoIndice, 10));
            });
            // Legenda: atualiza o estado sem redesenhar (nao perde o foco)
            area.addEventListener('input', function (e) {
                var campo = e.target.closest('input.foto-legenda');
                if (!campo) return;
                var lista = campo.dataset.fotoTipo === 'existente' ? form.existentes : form.novas;
                var item = lista[parseInt(campo.dataset.fotoIndice, 10)];
                if (item) item.legenda = campo.value;
            });
        }

        // Arrastar e soltar fotos (computador)
        var campoFotos = document.querySelector('.fotos-campo');
        if (campoFotos) {
            ['dragenter', 'dragover'].forEach(function (ev) {
                campoFotos.addEventListener(ev, function (e) {
                    e.preventDefault();
                    campoFotos.classList.add('fotos-arrastando');
                });
            });
            ['dragleave', 'drop'].forEach(function (ev) {
                campoFotos.addEventListener(ev, function (e) {
                    e.preventDefault();
                    campoFotos.classList.remove('fotos-arrastando');
                });
            });
            campoFotos.addEventListener('drop', function (e) {
                if (e.dataTransfer && e.dataTransfer.files) adicionarArquivos(e.dataTransfer.files);
            });
        }

        renderFormulario();
    }

    // ---------------------------------------------------------------
    // Detalhes (somente leitura)
    // ---------------------------------------------------------------
    async function renderDetalhe(elemento, fotos) {
        if (!elemento) return;
        fotos = Array.isArray(fotos) ? fotos : [];
        if (fotos.length === 0) {
            elemento.innerHTML = '<p class="fotos-info">Nenhuma foto.</p>';
            return;
        }
        elemento.innerHTML = '<p class="fotos-info">Carregando fotos...</p>';
        try {
            var urls = await urlsAssinadas(fotos);
            elemento.innerHTML = '<div class="fotos-grid">' + urls.map(function (url, i) {
                var legenda = fotos[i].legenda || '';
                return '<div class="foto-card">' +
                    '<a class="foto-img" href="' + escapar(url) + '" target="_blank" rel="noopener">' +
                    '<img src="' + escapar(url) + '" alt="Foto ' + (i + 1) + '">' +
                    '<span class="foto-numero">' + (i + 1) + '</span></a>' +
                    (legenda ? '<p class="foto-legenda-texto">' + escapar(legenda) + '</p>' : '') +
                    '</div>';
            }).join('') + '</div>';
        } catch (e) {
            elemento.innerHTML = '<p class="fotos-info" style="color:#b91c1c;">' + escapar(e.message) + '</p>';
        }
    }

    window.GML_BO_FOTOS = {
        init: init,
        limpar: limpar,
        carregarNoFormulario: carregarNoFormulario,
        prepararParaSalvar: prepararParaSalvar,
        concluirSalvamento: concluirSalvamento,
        emProcessamento: emProcessamento,
        urlsAssinadas: urlsAssinadas,
        apagar: apagar,
        explicarErro: explicarErro,
        renderDetalhe: renderDetalhe,
    };
})();
