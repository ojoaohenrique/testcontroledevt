(function () {
    'use strict';

    function mostrarToast(mensagem, tipo) {
        tipo = tipo || 'success';
        var toast = document.getElementById('gml-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'gml-toast';
            toast.style.cssText = [
                'position:fixed', 'bottom:24px', 'right:24px', 'padding:12px 20px',
                'border-radius:8px', 'color:#fff', 'font-size:14px', 'font-weight:500',
                'z-index:9999', 'opacity:0', 'transition:opacity 0.3s ease',
                'max-width:320px', 'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
            ].join(';');
            document.body.appendChild(toast);
        }
        toast.textContent = mensagem;
        toast.style.backgroundColor = tipo === 'success' ? '#28a745' : tipo === 'warning' ? '#ffc107' : '#dc3545';
        toast.style.color = tipo === 'warning' ? '#333' : '#fff';
        toast.style.opacity = '1';
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(function () { toast.style.opacity = '0'; }, 3500);
    }

    function confirmarExclusao(mensagem) {
        return window.confirm(mensagem || 'Deseja realmente excluir este registro?');
    }

    function formatarData(data) {
        if (!data) return '-';
        var d = data.includes('T') ? new Date(data) : new Date(data + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    }

    function formatarDataHora(data) {
        if (!data) return '-';
        return new Date(data).toLocaleString('pt-BR');
    }

    function hojeISO() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function inicioDiaISO() {
        return hojeISO() + 'T00:00:00';
    }

    function fimDiaISO() {
        return hojeISO() + 'T23:59:59';
    }

    function obterValoresMultiSelect(id) {
        var el = document.getElementById(id);
        if (!el) return [];
        return Array.from(el.selectedOptions).map(function (o) { return o.value; });
    }

    function definirValoresMultiSelect(id, valores) {
        var el = document.getElementById(id);
        if (!el || !valores) return;
        Array.from(el.options).forEach(function (opt) {
            opt.selected = valores.indexOf(opt.value) >= 0;
        });
    }

    function criarPaginacao(containerId, totalItens, paginaAtual, itensPorPagina, onPaginaChange) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
        container.innerHTML = '';
        if (totalPaginas <= 1) return;

        var nav = document.createElement('div');
        nav.className = 'paginacao';

        function criarBtn(texto, pagina, disabled) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-secondary btn-pag';
            btn.textContent = texto;
            btn.disabled = !!disabled;
            if (!disabled) {
                btn.addEventListener('click', function () { onPaginaChange(pagina); });
            }
            return btn;
        }

        nav.appendChild(criarBtn('« Anterior', paginaAtual - 1, paginaAtual <= 1));
        var info = document.createElement('span');
        info.className = 'paginacao-info';
        info.textContent = 'Página ' + paginaAtual + ' de ' + totalPaginas + ' (' + totalItens + ' registros)';
        nav.appendChild(info);
        nav.appendChild(criarBtn('Próxima »', paginaAtual + 1, paginaAtual >= totalPaginas));
        container.appendChild(nav);
    }

    function paginarLista(lista, pagina, itensPorPagina) {
        var inicio = (pagina - 1) * itensPorPagina;
        return lista.slice(inicio, inicio + itensPorPagina);
    }

    function gerarNumeroOrdem() {
        var agora = new Date();
        return 'OS-' + agora.getFullYear() +
            String(agora.getMonth() + 1).padStart(2, '0') +
            String(agora.getDate()).padStart(2, '0') + '-' +
            String(agora.getHours()).padStart(2, '0') +
            String(agora.getMinutes()).padStart(2, '0') +
            String(agora.getSeconds()).padStart(2, '0');
    }

    window.mostrarToast = mostrarToast;
    window.confirmarExclusao = confirmarExclusao;
    window.formatarData = formatarData;
    window.formatarDataHora = formatarDataHora;
    window.hojeISO = hojeISO;
    window.inicioDiaISO = inicioDiaISO;
    window.fimDiaISO = fimDiaISO;
    window.obterValoresMultiSelect = obterValoresMultiSelect;
    window.definirValoresMultiSelect = definirValoresMultiSelect;
    window.criarPaginacao = criarPaginacao;
    window.paginarLista = paginarLista;
    window.gerarNumeroOrdem = gerarNumeroOrdem;
})();
