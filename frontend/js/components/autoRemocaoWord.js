(function () {
    'use strict';

    // ===============================================================
    //  Auto de Remocao de Veiculo - documento Word (.docx)
    //  Preenche o modelo oficial (modelos/auto_remocao_modelo.docx)
    //  com os dados do B.O. e baixa o arquivo pronto.
    //  Bibliotecas: js/vendor/pizzip.min.js e js/vendor/docxtemplater.min.js
    // ===============================================================

    var CAMINHO_MODELO = 'modelos/auto_remocao_modelo.docx';

    function texto(valor) {
        if (valor === null || valor === undefined) return '';
        return String(valor).trim();
    }

    function doisDigitos(n) {
        return String(n).padStart(2, '0');
    }

    // Monta o texto da linha "condutor é proprietário?"
    function textoCondutor(b) {
        var partes = [];
        if (b.condutor_mesmo_proprietario) {
            partes.push('Sim.');
        } else if (texto(b.condutor_nome)) {
            var dados = ['Não. Condutor: ' + texto(b.condutor_nome)];
            if (texto(b.condutor_cpf)) dados.push('CPF ' + texto(b.condutor_cpf));
            if (texto(b.condutor_rg)) dados.push('RG ' + texto(b.condutor_rg));
            if (texto(b.condutor_cnh)) dados.push('CNH ' + texto(b.condutor_cnh));
            partes.push(dados.join(' – ') + '.');
        }
        if (texto(b.situacao_condutor)) partes.push(texto(b.situacao_condutor));
        return partes.join(' ');
    }

    // Converte o registro do banco nos campos do modelo
    function montarCampos(b) {
        var numero = texto(b.numero_bo).split('/');
        var d = b.data_hora ? new Date(b.data_hora) : null;
        var valida = d && !isNaN(d.getTime());

        return {
            num_seq: numero[0] || '',
            num_ano: numero[1] || (valida ? String(d.getFullYear()) : ''),
            data: valida ? doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1) + '/' + d.getFullYear() : '',
            hora: valida ? doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes()) : '',
            local: texto(b.local),
            local_complemento: texto(b.local_complemento),

            motivo: texto(b.motivo_recolhimento),
            infracao: texto(b.infracao),
            ait: texto(b.ait_numero),
            medida: texto(b.medida_administrativa),

            placa: texto(b.veiculo_placa).toUpperCase(),
            pais: texto(b.veiculo_pais),
            especie: texto(b.veiculo_especie),
            tipo: texto(b.veiculo_tipo),
            marca_modelo: texto(b.veiculo_marca_modelo),
            uf: texto(b.veiculo_uf).toUpperCase(),
            municipio: texto(b.veiculo_municipio),
            categoria: texto(b.veiculo_categoria),
            lugares: texto(b.veiculo_lugares),
            chassi: texto(b.veiculo_chassi),
            renavam: texto(b.veiculo_renavam),

            prop_nome: texto(b.proprietario_nome),
            prop_cpf: texto(b.proprietario_cpf),
            prop_rg: texto(b.proprietario_rg),
            prop_cnh: texto(b.proprietario_cnh),
            condutor_texto: textoCondutor(b),

            avarias: texto(b.avarias),
            equipamento: texto(b.equipamento),
            pneus: texto(b.pneus),
            combustivel: texto(b.combustivel_nivel),
            odometro: texto(b.odometro),
            info_compl: texto(b.informacoes_complementares),
            observacoes: texto(b.observacoes),

            guinchado: texto(b.guinchado),
            empresa_guincho: texto(b.empresa_guincho),
            motorista_guincho: texto(b.motorista_guincho),

            agente: texto(b.agente_responsavel),
            matricula: texto(b.matricula_agente),
        };
    }

    function nomeArquivo(b) {
        var numero = texto(b.numero_bo).replace(/[^0-9A-Za-z]+/g, '_') || 'sem_numero';
        return 'ARVC_' + numero + '.docx';
    }

    function baixar(blob, nome) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }

    // ---------------------------------------------------------------
    // Fotos no Word: substitui o paragrafo marcador FOTOS_AQUI (logo
    // abaixo de "9. Fotos" no modelo) pelas imagens, duas por linha.
    // ---------------------------------------------------------------
    var EMU_POR_MM = 36000;

    function dimensoesImagem(blob) {
        return new Promise(function (ok) {
            var url = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () { URL.revokeObjectURL(url); ok({ w: img.naturalWidth, h: img.naturalHeight }); };
            img.onerror = function () { URL.revokeObjectURL(url); ok({ w: 4, h: 3 }); };
            img.src = url;
        });
    }

    function xmlImagem(rid, id, cx, cy) {
        return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
            '<wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
            '<wp:docPr id="' + id + '" name="Foto ' + id + '"/>' +
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
            '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:nvPicPr><pic:cNvPr id="' + id + '" name="foto' + id + '.jpeg"/><pic:cNvPicPr/></pic:nvPicPr>' +
            '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
            '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }

    async function inserirFotosWord(zip, fotos) {
        var docXml = zip.file('word/document.xml').asText();
        var regexMarcador = /<w:p\b(?:(?!<w:p\b)[\s\S])*?FOTOS_AQUI[\s\S]*?<\/w:p>/;
        if (!regexMarcador.test(docXml)) return;

        fotos = Array.isArray(fotos) ? fotos : [];
        var urls = [];
        if (fotos.length && window.GML_BO_FOTOS) {
            try { urls = await window.GML_BO_FOTOS.urlsAssinadas(fotos); } catch (e) { urls = []; }
        }

        var runs = [];
        var relsXml = zip.file('word/_rels/document.xml.rels').asText();
        for (var i = 0; i < urls.length; i++) {
            if (!urls[i]) continue;
            try {
                var resp = await fetch(urls[i]);
                if (!resp.ok) continue;
                var blob = await resp.blob();
                var dim = await dimensoesImagem(blob);
                var cx = 80 * EMU_POR_MM;
                var cy = Math.round(cx * dim.h / dim.w);
                var maxCy = 100 * EMU_POR_MM;
                if (cy > maxCy) { cx = Math.round(cx * maxCy / cy); cy = maxCy; }

                var n = runs.length + 1;
                var rid = 'rIdFotoBO' + n;
                zip.file('word/media/foto_bo_' + n + '.jpeg', await blob.arrayBuffer());
                relsXml = relsXml.replace('</Relationships>',
                    '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ' +
                    'Target="media/foto_bo_' + n + '.jpeg"/></Relationships>');
                runs.push(xmlImagem(rid, 9000 + n, cx, cy));
            } catch (e) {
                console.warn('Foto nao incluida no Word:', e);
            }
        }

        var paragrafos = '';
        if (runs.length === 0) {
            paragrafos = '<w:p><w:r><w:t>Sem fotos.</w:t></w:r></w:p>';
        } else {
            for (var j = 0; j < runs.length; j += 2) {
                paragrafos += '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>' +
                    runs[j] +
                    (runs[j + 1] ? '<w:r><w:t xml:space="preserve">  </w:t></w:r>' + runs[j + 1] : '') +
                    '</w:p>';
            }
        }

        zip.file('word/document.xml', docXml.replace(regexMarcador, paragrafos));
        zip.file('word/_rels/document.xml.rels', relsXml);
    }

    async function gerarWordBoletim(b) {
        if (!b) return;
        if (!window.PizZip || !window.docxtemplater) {
            mostrarToast('Não foi possível carregar o gerador de Word.', 'error');
            return;
        }

        try {
            var resposta = await fetch(CAMINHO_MODELO, { cache: 'no-cache' });
            if (!resposta.ok) throw new Error('modelo não encontrado (' + resposta.status + ')');
            var conteudo = await resposta.arrayBuffer();

            var zip = new window.PizZip(conteudo);
            var doc = new window.docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: function () { return ''; },
            });
            doc.render(montarCampos(b));
            await inserirFotosWord(doc.getZip(), b.fotos);

            var blob = doc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                compression: 'DEFLATE',
            });
            baixar(blob, nomeArquivo(b));
            mostrarToast('Documento Word gerado!', 'success');
        } catch (err) {
            console.error('Erro ao gerar Word do B.O.:', err);
            mostrarToast('Erro ao gerar o documento Word: ' + err.message, 'error');
        }
    }

    // ===============================================================
    //  PDF no visual do modelo oficial (impressao do navegador)
    //  Cabecalho e rodape da Prefeitura se repetem em todas as paginas.
    // ===============================================================
    var IMG_CABECALHO = 'modelos/auto_remocao_cabecalho.jpg';
    var IMG_RODAPE = 'modelos/auto_remocao_rodape.jpg';

    function esc(valor) {
        var t = texto(valor);
        if (!t) return '-';
        return t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/\n/g, '<br>');
    }

    function urlAbsoluta(caminho) {
        return new URL(caminho, document.baseURI).href;
    }

    // Linha com 1 ou 2 pares [rotulo, valor]. Com 1 par o valor ocupa o resto da linha.
    function linha(pares) {
        return '<tr>' + pares.map(function (par) {
            var span = pares.length === 1 ? ' colspan="3"' : '';
            return '<th>' + esc(par[0]) + '</th><td' + span + '>' + esc(par[1]) + '</td>';
        }).join('') + '</tr>';
    }

    function secao(titulo, linhas) {
        return '<table class="sec">' +
            '<colgroup><col style="width:21%"><col style="width:29%"><col style="width:21%"><col style="width:29%"></colgroup>' +
            (titulo ? '<thead><tr><td colspan="4" class="tit">' + esc(titulo) + '</td></tr></thead>' : '') +
            '<tbody>' + linhas.join('') + '</tbody></table>';
    }

    function secaoFotos(urls) {
        urls = (urls || []).filter(Boolean);
        var conteudo = urls.length === 0
            ? '<div class="sem-fotos">Sem fotos.</div>'
            : urls.map(function (u) {
                return '<div class="foto"><img src="' + u.replace(/"/g, '&quot;') + '" alt=""></div>';
            }).join('');
        return '<table class="sec sec-cab"><thead><tr><td class="tit">FOTOS</td></tr></thead></table>' +
            '<div class="fotos">' + conteudo + '</div>';
    }

    function montarHtmlPdf(b, urlsFotos) {
        var c = montarCampos(b);
        var local = c.local + (c.local_complemento ? ' — ' + c.local_complemento : '');

        var condutor = b.condutor_mesmo_proprietario
            ? [linha([['Condutor', 'O próprio proprietário']])]
            : [
                linha([['Nome', b.condutor_nome]]),
                linha([['CPF', b.condutor_cpf], ['RG', b.condutor_rg]]),
                linha([['CNH', b.condutor_cnh]]),
            ];
        condutor.push(linha([['Situação do condutor', b.situacao_condutor]]));

        var corpo =
            '<div class="titulo">AUTO DE REMOÇÃO DE VEÍCULO</div>' +
            '<div class="numero">Nº <span>' + esc(c.num_seq) + '</span>/' + esc(c.num_ano) + '</div>' +

            secao('', [
                linha([['Data', c.data], ['Hora', c.hora]]),
                linha([['Local', local]]),
            ]) +
            secao('MOTIVO DO RECOLHIMENTO', [
                linha([['Motivo do Recolhimento', c.motivo]]),
                linha([['Infração', c.infracao]]),
                linha([['AIT Nº', c.ait]]),
                linha([['Medida Administrativa', c.medida]]),
            ]) +
            secao('IDENTIFICAÇÃO DO VEÍCULO', [
                linha([['Placa', c.placa], ['País', c.pais]]),
                linha([['Espécie', c.especie], ['Tipo', c.tipo]]),
                linha([['Marca/Modelo', c.marca_modelo]]),
                linha([['UF', c.uf], ['Município', c.municipio]]),
                linha([['Categoria', c.categoria], ['Lugares', c.lugares]]),
                linha([['Chassi', c.chassi]]),
                linha([['Renavam', c.renavam]]),
            ]) +
            secao('IDENTIFICAÇÃO DO PROPRIETÁRIO', [
                linha([['Nome', c.prop_nome]]),
                linha([['CPF', c.prop_cpf], ['RG', c.prop_rg]]),
                linha([['CNH', c.prop_cnh]]),
            ]) +
            secao('IDENTIFICAÇÃO DO CONDUTOR', condutor) +
            secao('CONDIÇÕES DO VEÍCULO', [
                linha([['Avarias', c.avarias], ['Equipamento', c.equipamento]]),
                linha([['Pneus', c.pneus], ['Combustível', c.combustivel]]),
                linha([['Odômetro', c.odometro], ['Informações complementares', c.info_compl]]),
                linha([['Observações', c.observacoes]]),
            ]) +
            secao('TRANSPORTE DO VEÍCULO', [
                linha([['Guinchado', c.guinchado]]),
                linha([['Empresa', c.empresa_guincho], ['Motorista', c.motorista_guincho]]),
            ]) +
            secaoFotos(urlsFotos) +
            secao('AGENTE RESPONSÁVEL', [
                linha([['Agente Responsável', c.agente], ['Matrícula', c.matricula]]),
            ]) +
            '<div class="assinatura"><div class="traco"></div>' +
            '<div>' + esc(texto(b.assinatura) || c.agente) + '</div>' +
            '<div class="rotulo">Assinatura do Agente</div></div>';

        var estilos =
            '@page { size: A4; margin: 0; }' +
            '* { box-sizing: border-box; }' +
            'html, body { margin: 0; padding: 0; }' +
            'body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000;' +
            '  -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
            '.cab { position: fixed; top: 0; left: 0; width: 210mm; }' +
            '.rod { position: fixed; bottom: 0; left: 0; width: 210mm; }' +
            '.cab img, .rod img { display: block; width: 100%; }' +
            'table.pagina { width: 210mm; border-collapse: collapse; }' +
            'table.pagina > thead td { height: 38mm; padding: 0; }' +
            'table.pagina > tfoot td { height: 36mm; padding: 0; }' +
            'table.pagina > tbody > tr > td { padding: 0 19mm; }' +
            '.titulo { font-family: Arial, Helvetica, sans-serif; font-weight: bold; font-size: 12pt; text-align: center; }' +
            '.numero { font-family: Arial, Helvetica, sans-serif; font-weight: bold; font-size: 11pt; text-align: center; margin: 2px 0 12px; }' +
            '.numero span { color: #e00000; }' +
            'table.sec { width: 100%; border-collapse: collapse; margin: 0 0 12px; page-break-inside: avoid; }' +
            'table.sec th, table.sec td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; text-align: left; }' +
            'table.sec th { font-weight: bold; }' +
            'table.sec td.tit { background: #5b9bd5; color: #fff; font-weight: bold; text-align: center; padding: 6px; }' +
            'table.sec-cab { margin-bottom: 0; }' +
            '.fotos { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 3mm;' +
            '  border: 1px solid #000; border-top: none; padding: 3mm; margin: 0 0 12px; }' +
            '.foto { width: calc(50% - 1.5mm); text-align: center; break-inside: avoid; page-break-inside: avoid; }' +
            '.foto img { max-width: 100%; max-height: 85mm; }' +
            '.sem-fotos { width: 100%; }' +
            '.assinatura { width: 60%; margin: 40px auto 0; text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; page-break-inside: avoid; }' +
            '.assinatura .traco { border-top: 1px solid #000; margin-bottom: 4px; }' +
            '.assinatura .rotulo { font-weight: bold; }' +
            '@media screen { body { background: #888; } table.pagina { background: #fff; margin: 0 auto; }' +
            '  .cab, .rod { position: static; margin: 0 auto; } }';

        var numero = texto(b.numero_bo) || 'sem número';

        return '<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8">' +
            '<title>A.R.V.C ' + esc(numero) + ' - Auto de Remoção de Veículo</title>' +
            '<style>' + estilos + '</style></head><body>' +
            '<div class="cab"><img src="' + urlAbsoluta(IMG_CABECALHO) + '" alt=""></div>' +
            '<table class="pagina">' +
            '<thead><tr><td></td></tr></thead>' +
            '<tfoot><tr><td></td></tr></tfoot>' +
            '<tbody><tr><td>' + corpo + '</td></tr></tbody>' +
            '</table>' +
            '<div class="rod"><img src="' + urlAbsoluta(IMG_RODAPE) + '" alt=""></div>' +
            '</body></html>';
    }

    async function gerarPdfBoletim(b) {
        if (!b) return;

        // A janela precisa abrir no clique (senao o navegador bloqueia o pop-up)
        var janela = window.open('', '_blank');
        if (!janela) {
            mostrarToast('Permita pop-ups no navegador para gerar o PDF.', 'warning');
            return;
        }
        janela.document.write('<p style="font-family:Arial;padding:20px;">Gerando o PDF...</p>');

        var urlsFotos = [];
        if (Array.isArray(b.fotos) && b.fotos.length && window.GML_BO_FOTOS) {
            try {
                urlsFotos = await window.GML_BO_FOTOS.urlsAssinadas(b.fotos);
            } catch (e) {
                console.warn('Nao foi possivel carregar as fotos para o PDF:', e);
            }
        }

        janela.document.open();
        janela.document.write(montarHtmlPdf(b, urlsFotos));
        janela.document.close();

        // So abre a impressao depois que cabecalho e rodape carregarem
        var imagens = Array.prototype.slice.call(janela.document.images);
        var carregadas = imagens.map(function (img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function (ok) { img.onload = ok; img.onerror = ok; });
        });
        var limite = new Promise(function (ok) { setTimeout(ok, 15000); });

        Promise.race([Promise.all(carregadas), limite]).then(function () {
            try {
                janela.focus();
                janela.print();
            } catch (e) {
                console.warn('Nao foi possivel abrir a impressao automaticamente.', e);
            }
        });
    }

    window.GML_AUTO_REMOCAO = {
        gerarWord: gerarWordBoletim,
        gerarPdf: gerarPdfBoletim,
        montarCampos: montarCampos,
        montarHtmlPdf: montarHtmlPdf,
    };
})();
