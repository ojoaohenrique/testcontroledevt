(function () {
    'use strict';

    // ===============================================================
    //  Componente reutilizavel de geracao de PDF
    //  Usa a janela de impressao do navegador (sem dependencias extras)
    //  Padrao GML - Guarda Municipal de Laguna
    // ===============================================================

    function escaparHtml(valor) {
        if (valor === null || valor === undefined || valor === '') return '-';
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function estilosPdf() {
        return [
            '* { box-sizing: border-box; }',
            'body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 32px; font-size: 12px; }',
            '.pdf-header { border-bottom: 3px solid #0056b3; padding-bottom: 12px; margin-bottom: 20px; }',
            '.pdf-header h1 { color: #0056b3; font-size: 18px; margin: 0 0 4px; }',
            '.pdf-header p { margin: 0; font-size: 11px; color: #555; }',
            '.pdf-secao { margin-bottom: 18px; page-break-inside: avoid; }',
            '.pdf-secao h2 { font-size: 13px; color: #0056b3; background: #e6f0ff;',
            '  padding: 6px 10px; margin: 0 0 8px; border-radius: 4px; }',
            '.pdf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }',
            '.pdf-item { border: 1px solid #d9d9d9; border-radius: 4px; padding: 6px 8px; }',
            '.pdf-item label { display: block; font-size: 9px; text-transform: uppercase;',
            '  color: #777; margin-bottom: 2px; letter-spacing: 0.04em; }',
            '.pdf-item span { font-size: 12px; color: #222; font-weight: bold; }',
            '.pdf-texto { border: 1px solid #d9d9d9; border-radius: 4px; padding: 8px;',
            '  white-space: pre-wrap; min-height: 28px; }',
            '.pdf-tabela { width: 100%; border-collapse: collapse; }',
            '.pdf-tabela th, .pdf-tabela td { border: 1px solid #d9d9d9; padding: 5px 7px;',
            '  text-align: left; font-size: 10.5px; vertical-align: top; }',
            '.pdf-tabela thead th { background: #e6f0ff; color: #0056b3; }',
            '.pdf-assinatura { margin-top: 48px; display: flex; justify-content: space-around;',
            '  gap: 40px; page-break-inside: avoid; }',
            '.pdf-assinatura div { flex: 1; text-align: center; border-top: 1px solid #333;',
            '  padding-top: 6px; font-size: 11px; }',
            '.pdf-footer { margin-top: 24px; border-top: 1px solid #d9d9d9; padding-top: 8px;',
            '  text-align: center; font-size: 9px; color: #777; }',
            '@media print { body { padding: 0; } .pdf-secao { page-break-inside: avoid; } }',
        ].join('\n');
    }

    /**
     * Monta um bloco de campos em grade (3 colunas).
     * @param {Array<{label: string, valor: any}>} campos
     */
    function blocoGrid(campos) {
        var itens = campos.map(function (campo) {
            return '<div class="pdf-item"><label>' + escaparHtml(campo.label) + '</label>' +
                '<span>' + escaparHtml(campo.valor) + '</span></div>';
        }).join('');
        return '<div class="pdf-grid">' + itens + '</div>';
    }

    /**
     * Monta um bloco de texto longo com titulo.
     */
    function blocoTexto(titulo, valor) {
        return '<div class="pdf-secao"><h2>' + escaparHtml(titulo) + '</h2>' +
            '<div class="pdf-texto">' + escaparHtml(valor) + '</div></div>';
    }

    /**
     * Monta uma tabela com titulo, a partir de colunas e linhas.
     * @param {string} titulo
     * @param {Array<string>} colunas
     * @param {Array<Array<any>>} linhas
     */
    function blocoTabela(titulo, colunas, linhas) {
        var cabecalho = '<tr>' + colunas.map(function (c) {
            return '<th>' + escaparHtml(c) + '</th>';
        }).join('') + '</tr>';

        var corpo = linhas.length === 0
            ? '<tr><td colspan="' + colunas.length + '" style="text-align:center;">Nenhum registro.</td></tr>'
            : linhas.map(function (linha) {
                return '<tr>' + linha.map(function (v) {
                    return '<td>' + escaparHtml(v) + '</td>';
                }).join('') + '</tr>';
            }).join('');

        return '<div class="pdf-secao"><h2>' + escaparHtml(titulo) + '</h2>' +
            '<table class="pdf-tabela"><thead>' + cabecalho + '</thead><tbody>' + corpo + '</tbody></table></div>';
    }

    /**
     * Abre a janela de impressao com o conteudo formatado.
     * @param {Object} opcoes
     * @param {string} opcoes.titulo   Titulo do documento
     * @param {string} opcoes.subtitulo Subtitulo (numero/data do registro)
     * @param {string} opcoes.corpo    HTML interno ja montado
     * @param {Array<string>} [opcoes.assinaturas] Rotulos das linhas de assinatura
     */
    function gerarPdf(opcoes) {
        var titulo = opcoes.titulo || 'Documento';
        var assinaturas = opcoes.assinaturas || [];

        var blocoAssinatura = '';
        if (assinaturas.length > 0) {
            blocoAssinatura = '<div class="pdf-assinatura">' +
                assinaturas.map(function (nome) {
                    return '<div>' + escaparHtml(nome) + '</div>';
                }).join('') +
                '</div>';
        }

        var emissao = new Date().toLocaleString('pt-BR');

        var html = '<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8">' +
            '<title>' + escaparHtml(titulo) + '</title>' +
            '<style>' + estilosPdf() + '</style></head><body>' +
            '<div class="pdf-header">' +
            '  <h1>GUARDA MUNICIPAL DE LAGUNA</h1>' +
            '  <p><strong>' + escaparHtml(titulo) + '</strong>' +
            (opcoes.subtitulo ? ' &nbsp;|&nbsp; ' + escaparHtml(opcoes.subtitulo) : '') + '</p>' +
            '</div>' +
            (opcoes.corpo || '') +
            blocoAssinatura +
            '<div class="pdf-footer">Documento gerado pelo Sistema de Controle Operacional GML em ' +
            emissao + '</div>' +
            '</body></html>';

        var janela = window.open('', '_blank');
        if (!janela) {
            if (window.mostrarToast) {
                mostrarToast('Permita pop-ups no navegador para gerar o PDF.', 'warning');
            }
            return;
        }

        janela.document.open();
        janela.document.write(html);
        janela.document.close();

        // Aguarda a renderizacao antes de abrir a caixa de impressao
        janela.onload = function () {
            janela.focus();
            janela.print();
        };
        setTimeout(function () {
            try {
                janela.focus();
                janela.print();
            } catch (e) {
                console.warn('Nao foi possivel abrir a impressao automaticamente.', e);
            }
        }, 500);
    }

    window.GML_PDF = {
        gerar: gerarPdf,
        blocoGrid: blocoGrid,
        blocoTexto: blocoTexto,
        blocoTabela: blocoTabela,
        escapar: escaparHtml,
    };
})();
