(function () {
    'use strict';

    // ===============================================================
    //  Fotos do B.O. (Auto de Remocao de Veiculo)
    //  Arquivos no Supabase Storage (bucket privado "bo-fotos");
    //  a lista fica na coluna boletins_ocorrencia.fotos (JSONB):
    //  [{ path: 'fotos/....jpg', nome: 'IMG_123.jpg' }]
    // ===============================================================

    var BUCKET = 'bo-fotos';
    var MAX_FOTOS = 10;
    var LADO_MAXIMO = 1600;   // px - reduz fotos de celular antes de enviar
    var QUALIDADE_JPEG = 0.8;

    // Estado do formulario
    var form = {
        existentes: [],  // fotos ja salvas no B.O. em edicao
        novas: [],       // { file, previewUrl } ainda nao enviadas
        removidas: [],   // paths a apagar do storage depois de salvar
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

    // ---------------------------------------------------------------
    // Compressao no aparelho
    // ---------------------------------------------------------------
    function carregarImagem(file) {
        return new Promise(function (ok, falha) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () { URL.revokeObjectURL(url); ok(img); };
            img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Arquivo de imagem inválido: ' + file.name)); };
            img.src = url;
        });
    }

    async function comprimir(file) {
        var img = await carregarImagem(file);
        var escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * escala);
        canvas.height = Math.round(img.naturalHeight * escala);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return new Promise(function (ok, falha) {
            canvas.toBlob(function (blob) {
                blob ? ok(blob) : falha(new Error('Não foi possível processar a foto ' + file.name));
            }, 'image/jpeg', QUALIDADE_JPEG);
        });
    }

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------
    async function enviar(file) {
        var blob = await comprimir(file);
        var path = 'fotos/' + idAleatorio() + '.jpg';
        var res = await storage().upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (res.error) throw new Error('Falha ao enviar a foto ' + file.name + ': ' + res.error.message);
        return { path: path, nome: file.name };
    }

    async function urlsAssinadas(fotos) {
        fotos = Array.isArray(fotos) ? fotos : [];
        if (fotos.length === 0) return [];
        var res = await storage().createSignedUrls(fotos.map(function (f) { return f.path; }), 3600);
        if (res.error) throw res.error;
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
    function totalNoFormulario() {
        return form.existentes.length + form.novas.length;
    }

    async function renderFormulario() {
        var area = document.getElementById('fotosPreview');
        var info = document.getElementById('fotosInfo');
        if (!area) return;

        if (info) {
            info.textContent = totalNoFormulario() === 0
                ? 'Nenhuma foto adicionada.'
                : totalNoFormulario() + ' de ' + MAX_FOTOS + ' fotos.';
        }

        var urlsExistentes = [];
        try {
            urlsExistentes = await urlsAssinadas(form.existentes);
        } catch (e) {
            console.warn('Nao foi possivel carregar as fotos salvas:', e);
        }

        var html = '';
        form.existentes.forEach(function (f, i) {
            html += cartao(urlsExistentes[i], f.nome, 'existente', i);
        });
        form.novas.forEach(function (n, i) {
            html += cartao(n.previewUrl, n.file.name, 'nova', i);
        });
        area.innerHTML = html;
    }

    function cartao(url, nome, tipo, indice) {
        return '<div class="foto-card">' +
            (url ? '<img src="' + escapar(url) + '" alt="' + escapar(nome) + '">' : '<div class="foto-sem">Foto</div>') +
            '<button type="button" class="foto-remover" title="Remover foto" ' +
            'data-foto-tipo="' + tipo + '" data-foto-indice="' + indice + '">✕</button>' +
            '</div>';
    }

    function adicionarArquivos(lista) {
        var arquivos = Array.prototype.slice.call(lista || []).filter(function (f) {
            return f.type.indexOf('image/') === 0;
        });
        var vagas = MAX_FOTOS - totalNoFormulario();
        if (arquivos.length > vagas) {
            mostrarToast('Limite de ' + MAX_FOTOS + ' fotos por A.R.V.C. Algumas não foram adicionadas.', 'warning');
            arquivos = arquivos.slice(0, Math.max(0, vagas));
        }
        arquivos.forEach(function (file) {
            form.novas.push({ file: file, previewUrl: URL.createObjectURL(file) });
        });
        renderFormulario();
    }

    function removerDoFormulario(tipo, indice) {
        if (tipo === 'existente') {
            var f = form.existentes.splice(indice, 1)[0];
            if (f) form.removidas.push(f.path);
        } else {
            var n = form.novas.splice(indice, 1)[0];
            if (n) URL.revokeObjectURL(n.previewUrl);
        }
        renderFormulario();
    }

    function limpar() {
        form.novas.forEach(function (n) { URL.revokeObjectURL(n.previewUrl); });
        form.existentes = [];
        form.novas = [];
        form.removidas = [];
        var input = document.getElementById('fotosInput');
        if (input) input.value = '';
        renderFormulario();
    }

    function carregarNoFormulario(fotos) {
        limpar();
        form.existentes = (Array.isArray(fotos) ? fotos : []).slice();
        renderFormulario();
    }

    // Envia as fotos novas e devolve a lista final para gravar no B.O.
    async function prepararParaSalvar(aoProgredir) {
        var enviadas = [];
        for (var i = 0; i < form.novas.length; i++) {
            if (aoProgredir) aoProgredir(i + 1, form.novas.length);
            enviadas.push(await enviar(form.novas[i].file));
        }
        return form.existentes.concat(enviadas);
    }

    // Depois de salvar com sucesso: apaga do storage as fotos removidas
    async function concluirSalvamento() {
        await apagar(form.removidas);
        form.removidas = [];
    }

    function init() {
        var input = document.getElementById('fotosInput');
        if (input) {
            input.addEventListener('change', function () {
                adicionarArquivos(input.files);
                input.value = '';
            });
        }
        var area = document.getElementById('fotosPreview');
        if (area) {
            area.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-foto-tipo]');
                if (!btn) return;
                removerDoFormulario(btn.dataset.fotoTipo, parseInt(btn.dataset.fotoIndice, 10));
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
            elemento.innerHTML = '<p style="color:#666;margin:0;">Nenhuma foto.</p>';
            return;
        }
        elemento.innerHTML = '<p style="color:#666;margin:0;">Carregando fotos...</p>';
        try {
            var urls = await urlsAssinadas(fotos);
            elemento.innerHTML = '<div class="fotos-grid">' + urls.map(function (url, i) {
                return '<a class="foto-card" href="' + escapar(url) + '" target="_blank" rel="noopener">' +
                    '<img src="' + escapar(url) + '" alt="' + escapar(fotos[i].nome) + '"></a>';
            }).join('') + '</div>';
        } catch (e) {
            elemento.innerHTML = '<p style="color:#c00;margin:0;">Não foi possível carregar as fotos.</p>';
        }
    }

    window.GML_BO_FOTOS = {
        init: init,
        limpar: limpar,
        carregarNoFormulario: carregarNoFormulario,
        prepararParaSalvar: prepararParaSalvar,
        concluirSalvamento: concluirSalvamento,
        quantidadeNovas: function () { return form.novas.length; },
        urlsAssinadas: urlsAssinadas,
        apagar: apagar,
        renderDetalhe: renderDetalhe,
    };
})();
