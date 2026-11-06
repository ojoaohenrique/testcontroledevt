(function () {
    'use strict';

    var NAV_ITEMS = [
        { href: 'dashboard.html', label: 'Dashboard', icon: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>' },
        { href: 'viaturas.html', label: 'Viaturas', icon: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>' },
        { href: 'relatorio-diario.html', label: 'Relatório Diário', icon: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>' },
        { href: 'ordens-servico.html', label: 'Ordens de Serviço', icon: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>' },
        { href: 'boletim-ocorrencia.html', label: 'A.R.V.C', icon: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>' },
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
            '  <button type="button" class="sidebar-toggle" id="btnSidebarToggle" aria-label="Abrir menu"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg></button>' +
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
