(function () {
    'use strict';

    var NAV_ITEMS = [
        { href: 'dashboard.html', label: 'Dashboard', icon: '📊' },
        { href: 'viaturas.html', label: 'Viaturas', icon: '🚔' },
        { href: 'relatorio-diario.html', label: 'Relatório Diário', icon: '📋' },
        { href: 'ordens-servico.html', label: 'Ordens de Serviço', icon: '📝' },
        { href: 'boletim-ocorrencia.html', label: 'A.R.V.C', icon: '🚨' },
    ];

    function paginaAtual() {
        var path = window.location.pathname.split('/').pop() || 'dashboard.html';
        return path;
    }

    function renderSidebar() {
        var container = document.getElementById('sidebar');
        if (!container) return;

        var atual = paginaAtual();
        var links = NAV_ITEMS.map(function (item) {
            var active = atual === item.href ? ' active' : '';
            return '<a href="' + item.href + '" class="sidebar-link' + active + '">' +
                '<span class="sidebar-icon">' + item.icon + '</span>' +
                '<span class="sidebar-label">' + item.label + '</span></a>';
        }).join('');

        container.innerHTML =
            '<div class="sidebar-inner">' +
            '  <div class="sidebar-brand">' +
            '    <img class="sidebar-brand-logo" src="icons/logo-guarda.png" alt="Brasão da Guarda Municipal de Laguna">' +
            '    <div><strong>Guarda Municipal</strong><small>Laguna/SC · Controle Operacional</small></div>' +
            '  </div>' +
            '  <nav class="sidebar-nav">' + links + '</nav>' +
            '  <div class="sidebar-rodape">GML · Sistema Operacional</div>' +
            '</div>';
    }

    function renderHeaderUsuario() {
        var container = document.getElementById('headerUsuario');
        if (!container) return;

        var auth = getStoredAuth();
        var email = auth && auth.user ? auth.user.email : 'Usuário';
        var inicial = String(email).trim().charAt(0) || 'U';
        var emailSeguro = String(email).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        container.innerHTML =
            '<div class="header-usuario">' +
            '  <button type="button" class="sidebar-toggle" id="btnSidebarToggle" aria-label="Abrir menu">☰</button>' +
            '  <a class="header-marca" href="dashboard.html" aria-label="Início">' +
            '    <img src="icons/logo-guarda.png" alt=""><span>GML</span>' +
            '  </a>' +
            '  <div class="header-usuario-info">' +
            '    <span class="header-usuario-avatar">' + inicial.replace(/[<>&"]/g, '') + '</span>' +
            '    <span class="header-usuario-nome">' + emailSeguro + '</span>' +
            '  </div>' +
            '  <nav class="header-usuario-nav">' +
            '    <button type="button" class="btn btn-secondary" id="btnLogout">Sair</button>' +
            '  </nav>' +
            '</div>';

        var btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.addEventListener('click', logout);

        var btnToggle = document.getElementById('btnSidebarToggle');
        if (btnToggle) {
            btnToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                document.body.classList.toggle('sidebar-open');
            });
        }

        // ESC fecha o menu
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') document.body.classList.remove('sidebar-open');
        });

        // No celular: tocar fora do menu fecha o menu
        document.addEventListener('click', function (e) {
            if (!document.body.classList.contains('sidebar-open')) return;
            var sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.contains(e.target)) {
                document.body.classList.remove('sidebar-open');
            }
        });
    }

    function initLayout() {
        renderSidebar();
        renderHeaderUsuario();
    }

    window.renderSidebar = renderSidebar;
    window.renderHeaderUsuario = renderHeaderUsuario;
    window.initLayout = initLayout;

    // ---------------------------------------------------------------
    // Tabelas responsivas: no celular cada linha vira um cartao.
    // Copia o titulo de cada coluna (th) para o atributo data-label
    // das celulas, usado pelo CSS (td::before). Acompanha as tabelas
    // que sao redesenhadas pelos modulos (filtros, paginacao...).
    // ---------------------------------------------------------------
    function rotularTabelas() {
        document.querySelectorAll('.registro-container table').forEach(function (tabela) {
            var titulos = Array.prototype.map.call(
                tabela.querySelectorAll('thead th'),
                function (th) { return th.textContent.trim(); }
            );
            if (!titulos.length) return;
            tabela.querySelectorAll('tbody tr').forEach(function (tr) {
                var coluna = 0;
                Array.prototype.forEach.call(tr.children, function (td) {
                    var span = parseInt(td.getAttribute('colspan') || '1', 10);
                    if (span > 1) {
                        td.classList.add('td-cheia');
                    } else if (titulos[coluna] && td.getAttribute('data-label') !== titulos[coluna]) {
                        td.setAttribute('data-label', titulos[coluna]);
                    }
                    coluna += span;
                });
            });
        });
    }

    var agendado = false;
    function agendarRotulos() {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(function () {
            agendado = false;
            rotularTabelas();
        });
    }

    function iniciarTabelasResponsivas() {
        rotularTabelas();
        if (!window.MutationObserver) return;
        document.querySelectorAll('.registro-container').forEach(function (area) {
            new MutationObserver(agendarRotulos).observe(area, { childList: true, subtree: true });
        });
    }

    document.body.classList.add('gml-app');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarTabelasResponsivas);
    } else {
        iniciarTabelasResponsivas();
    }
})();
