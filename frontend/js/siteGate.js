(function () {
    'use strict';

    // ===============================================================
    //  Gate simples de acesso - apenas para ambiente de teste/demo.
    //  NAO substitui o login real (Supabase Auth), que continua
    //  acontecendo normalmente depois que a senha aqui é aceita.
    //  A senha fica em texto puro no código-fonte: é só uma barreira
    //  leve para evitar visitas casuais enquanto o projeto é testado.
    // ===============================================================

    var STORAGE_KEY = 'gml_gate_ok';
    var SENHA = '159753';

    try {
        if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch (e) {
        // localStorage indisponivel (modo privado etc.): segue e sempre pede a senha.
    }

    // Esconde a página inteira imediatamente para evitar qualquer "flash"
    // de conteúdo antes da senha ser digitada.
    document.documentElement.style.visibility = 'hidden';

    function montarOverlay() {
        var overlay = document.createElement('div');
        overlay.id = 'gml-gate-overlay';
        overlay.style.cssText = 'visibility:visible;position:fixed;inset:0;background:#0056b3;' +
            'display:flex;align-items:center;justify-content:center;z-index:999999;' +
            'font-family:Arial,sans-serif;padding:16px;box-sizing:border-box;';
        overlay.innerHTML =
            '<div style="background:#fff;border-radius:10px;padding:32px 28px;max-width:320px;width:100%;' +
            'box-shadow:0 8px 24px rgba(0,0,0,.25);text-align:center;">' +
            '  <h2 style="margin:0 0 6px;color:#0056b3;font-size:1.2rem;">GML — Acesso restrito</h2>' +
            '  <p style="margin:0 0 18px;color:#555;font-size:.85rem;">Ambiente em teste. Digite a senha para continuar.</p>' +
            '  <input type="password" id="gml-gate-input" placeholder="Senha" autocomplete="off" ' +
            '    style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;font-size:1rem;box-sizing:border-box;margin-bottom:10px;">' +
            '  <p id="gml-gate-erro" style="display:none;color:#dc3545;font-size:.8rem;margin:0 0 10px;">Senha incorreta.</p>' +
            '  <button type="button" id="gml-gate-btn" style="width:100%;padding:10px;border:none;border-radius:6px;' +
            'background:#0056b3;color:#fff;font-weight:bold;cursor:pointer;">Entrar</button>' +
            '</div>';

        document.body.appendChild(overlay);

        var input = overlay.querySelector('#gml-gate-input');
        var btn = overlay.querySelector('#gml-gate-btn');
        var erro = overlay.querySelector('#gml-gate-erro');

        function tentar() {
            if (input.value === SENHA) {
                try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* ignora */ }
                document.documentElement.style.visibility = '';
                overlay.remove();
            } else {
                erro.style.display = 'block';
                input.value = '';
                input.focus();
            }
        }

        btn.addEventListener('click', tentar);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') tentar();
        });
        setTimeout(function () { input.focus(); }, 50);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', montarOverlay);
    } else {
        montarOverlay();
    }
})();
