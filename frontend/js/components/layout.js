(function () {
    'use strict';

    var NAV_ITEMS = [
        { href: 'dashboard.html', label: 'Dashboard', icon: '📊' },
        { href: 'viaturas.html', label: 'Viaturas', icon: '🚔' },
        { href: 'relatorio-diario.html', label: 'Relatório Diário', icon: '📋' },
        { href: 'ordens-servico.html', label: 'Ordens de Serviço', icon: '📝' },
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
            '    <span class="sidebar-brand-icon">🛡️</span>' +
            '    <div><strong>GML</strong><small>Controle Operacional</small></div>' +
            '  </div>' +
            '  <nav class="sidebar-nav">' + links + '</nav>' +
            '</div>';
    }

    function renderHeaderUsuario() {
        var container = document.getElementById('headerUsuario');
        if (!container) return;

        var auth = getStoredAuth();
        var email = auth && auth.user ? auth.user.email : 'Usuário';

        container.innerHTML =
            '<div class="header-usuario">' +
            '  <button type="button" class="sidebar-toggle" id="btnSidebarToggle" aria-label="Menu">☰</button>' +
            '  <div class="header-usuario-info">' +
            '    <span class="header-usuario-nome">' + email + '</span>' +
            '  </div>' +
            '  <nav class="header-usuario-nav">' +
            '    <button type="button" class="btn btn-secondary" id="btnLogout">Sair</button>' +
            '  </nav>' +
            '</div>';

        var btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.addEventListener('click', logout);

        var btnToggle = document.getElementById('btnSidebarToggle');
        if (btnToggle) {
            btnToggle.addEventListener('click', function () {
                document.body.classList.toggle('sidebar-open');
            });
        }
    }

    function initLayout() {
        renderSidebar();
        renderHeaderUsuario();
    }

    window.renderSidebar = renderSidebar;
    window.renderHeaderUsuario = renderHeaderUsuario;
    window.initLayout = initLayout;
})();
