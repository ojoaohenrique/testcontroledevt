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
                runs.push({ xml: xmlImagem(rid, 9000 + n, cx, cy), numero: i + 1, legenda: texto(fotos[i].legenda) });
            } catch (e) {
                console.warn('Foto nao incluida no Word:', e);
            }
        }

        var paragrafos = '';
        if (runs.length === 0) {
            paragrafos = '<w:p><w:r><w:t>Sem fotos.</w:t></w:r></w:p>';
        } else {
            var escXml = function (t) {
                return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            };
            var legendaDe = function (r) {
                return 'Foto ' + r.numero + (r.legenda ? ' – ' + r.legenda : '');
            };
            for (var j = 0; j < runs.length; j += 2) {
                var par = runs.slice(j, j + 2);
                paragrafos += '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>' +
                    par.map(function (r) { return r.xml; }).join('<w:r><w:t xml:space="preserve">  </w:t></w:r>') +
                    '</w:p>' +
                    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>' +
                    '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">' +
                    escXml(par.map(legendaDe).join('     |     ')) +
                    '</w:t></w:r></w:p>';
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
            console.error('Erro ao gerar Word do A.R.V.C:', err);
            mostrarToast('Erro ao gerar o documento Word: ' + err.message, 'error');
        }
    }

    // ===============================================================
    //  PDF do A.R.V.C - arquivo gerado no navegador (jsPDF + autoTable)
    //  Baixa direto o .pdf, sem tela de impressao. Visual do modelo
    //  oficial: cabecalho/rodape da Prefeitura em todas as paginas,
    //  tabelas com faixa azul, fotos 2 por linha com legenda.
    // ===============================================================
    var IMG_CABECALHO = 'modelos/auto_remocao_cabecalho.jpg';
    var IMG_RODAPE = 'modelos/auto_remocao_rodape.jpg';

    var PAG_L = 210;
    var PAG_A = 297;
    var MARGEM = 19;
    var LARGURA = PAG_L - 2 * MARGEM;          // 172 mm
    var AZUL = [91, 155, 213];
    var TEXTO = [25, 25, 25];
    var VERMELHO = [220, 0, 0];

    var gerandoPdf = false;

    // Carrega uma imagem como dataURL JPEG (reduzida se ladoMax for informado)
    async function carregarImagemDados(url, ladoMax) {
        var resp = await fetch(url);
        if (!resp.ok) throw new Error('imagem não encontrada (' + resp.status + ')');
        var blob = await resp.blob();
        var img;
        if (window.createImageBitmap) {
            img = await createImageBitmap(blob);
        } else {
            img = await new Promise(function (ok, falha) {
                var u = URL.createObjectURL(blob);
                var el = new Image();
                el.onload = function () { URL.revokeObjectURL(u); ok(el); };
                el.onerror = function () { URL.revokeObjectURL(u); falha(new Error('imagem inválida')); };
                el.src = u;
            });
        }
        var w = img.width || img.naturalWidth;
        var h = img.height || img.naturalHeight;
        var escala = ladoMax ? Math.min(1, ladoMax / Math.max(w, h)) : 1;
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(w * escala);
        canvas.height = Math.round(h * escala);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (img.close) img.close();
        return { dados: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height };
    }

    function valorPdf(v) {
        var t = texto(v);
        return t || '-';
    }

    // Monta as linhas do autoTable a partir de pares [rotulo, valor]
    function linhasTabela(linhas) {
        return linhas.map(function (pares) {
            if (pares.length === 1) {
                return [
                    { content: pares[0][0], styles: { fontStyle: 'bold' } },
                    { content: valorPdf(pares[0][1]), colSpan: 3 },
                ];
            }
            return [
                { content: pares[0][0], styles: { fontStyle: 'bold' } },
                { content: valorPdf(pares[0][1]) },
                { content: pares[1][0], styles: { fontStyle: 'bold' } },
                { content: valorPdf(pares[1][1]) },
            ];
        });
    }

    function criarDocumentoPdf(b, imagens, fotos) {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        var c = montarCampos(b);
        var numero = texto(b.numero_bo) || 'sem número';

        var altCab = imagens.cabecalho ? PAG_L * imagens.cabecalho.h / imagens.cabecalho.w : 30;
        var altRod = imagens.rodape ? PAG_L * imagens.rodape.h / imagens.rodape.w : 22;
        var topo = altCab + 7;
        var limite = PAG_A - altRod - 10;

        doc.setProperties({
            title: 'A.R.V.C ' + numero + ' - Auto de Remoção de Veículo',
            subject: 'Auto de Remoção de Veículo',
            author: 'Guarda Municipal de Laguna',
            creator: 'GML - Controle Operacional',
        });

        var y = topo;

        function novaPagina() {
            doc.addPage();
            y = topo;
        }

        function garantirEspaco(altura) {
            if (y + altura > limite) novaPagina();
        }

        // ---- Titulo e numero (numero em vermelho, como no modelo)
        doc.setTextColor.apply(doc, TEXTO);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('AUTO DE REMOÇÃO DE VEÍCULO', PAG_L / 2, y, { align: 'center' });
        y += 6;

        doc.setFontSize(11.5);
        var p1 = 'Nº ';
        var p2 = c.num_seq || '---';
        var p3 = '/' + (c.num_ano || '');
        var larguraNum = doc.getTextWidth(p1 + p2 + p3);
        var x = (PAG_L - larguraNum) / 2;
        doc.text(p1, x, y);
        x += doc.getTextWidth(p1);
        doc.setTextColor.apply(doc, VERMELHO);
        doc.text(p2, x, y);
        x += doc.getTextWidth(p2);
        doc.setTextColor.apply(doc, TEXTO);
        doc.text(p3, x, y);
        y += 6;

        // ---- Tabelas
        function secao(titulo, linhas) {
            garantirEspaco(titulo ? 22 : 14);
            doc.autoTable({
                startY: y,
                head: titulo ? [[{ content: titulo, colSpan: 4 }]] : undefined,
                body: linhasTabela(linhas),
                theme: 'grid',
                margin: { top: topo, bottom: PAG_A - limite, left: MARGEM, right: MARGEM },
                tableWidth: LARGURA,
                styles: {
                    font: 'helvetica',
                    fontSize: 9.5,
                    textColor: TEXTO,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.2,
                    cellPadding: { top: 1.7, bottom: 1.7, left: 2.2, right: 2.2 },
                    valign: 'middle',
                    overflow: 'linebreak',
                },
                headStyles: {
                    fillColor: AZUL,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                    fontSize: 10,
                },
                columnStyles: {
                    0: { cellWidth: 41 },
                    1: { cellWidth: 45 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 56 },
                },
                rowPageBreak: 'avoid',
                showHead: 'everyPage',
            });
            y = doc.lastAutoTable.finalY + 5;
        }

        var local = c.local + (c.local_complemento ? ' — ' + c.local_complemento : '');

        secao('', [
            [['Data', c.data], ['Hora', c.hora]],
            [['Local', local]],
        ]);
        secao('MOTIVO DO RECOLHIMENTO', [
            [['Motivo do recolhimento', c.motivo]],
            [['Infração', c.infracao]],
            [['AIT Nº', c.ait]],
            [['Medida administrativa', c.medida]],
        ]);
        secao('IDENTIFICAÇÃO DO VEÍCULO', [
            [['Placa', c.placa], ['País', c.pais]],
            [['Espécie', c.especie], ['Tipo', c.tipo]],
            [['Marca/Modelo', c.marca_modelo]],
            [['UF', c.uf], ['Município', c.municipio]],
            [['Categoria', c.categoria], ['Lugares', c.lugares]],
            [['Chassi', c.chassi]],
            [['Renavam', c.renavam]],
        ]);
        secao('IDENTIFICAÇÃO DO PROPRIETÁRIO', [
            [['Nome', c.prop_nome]],
            [['CPF', c.prop_cpf], ['RG', c.prop_rg]],
            [['CNH', c.prop_cnh]],
        ]);
        secao('IDENTIFICAÇÃO DO CONDUTOR', (b.condutor_mesmo_proprietario
            ? [[['Condutor', 'O próprio proprietário']]]
            : [
                [['Nome', b.condutor_nome]],
                [['CPF', b.condutor_cpf], ['RG', b.condutor_rg]],
                [['CNH', b.condutor_cnh]],
            ]).concat([[['Situação do condutor', b.situacao_condutor]]]));
        secao('CONDIÇÕES DO VEÍCULO', [
            [['Avarias', c.avarias]],
            [['Equipamento', c.equipamento]],
            [['Pneus', c.pneus], ['Combustível', c.combustivel]],
            [['Odômetro', c.odometro]],
            [['Informações complementares', c.info_compl]],
            [['Observações', c.observacoes]],
        ]);
        secao('TRANSPORTE DO VEÍCULO', [
            [['Guinchado', c.guinchado]],
            [['Empresa', c.empresa_guincho], ['Motorista', c.motorista_guincho]],
        ]);

        // ---- Fotos: 2 por linha, com numero e legenda
        function faixaFotos(continua) {
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);
            doc.setFillColor.apply(doc, AZUL);
            doc.rect(MARGEM, y, LARGURA, 7, 'FD');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(continua ? 'FOTOS (continuação)' : 'FOTOS', PAG_L / 2, y + 4.8, { align: 'center' });
            doc.setTextColor.apply(doc, TEXTO);
            y += 7;
        }

        garantirEspaco(fotos.length ? 80 : 20);
        faixaFotos(false);

        if (fotos.length === 0) {
            doc.setDrawColor(0, 0, 0);
            doc.rect(MARGEM, y, LARGURA, 8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.text('Sem fotos.', MARGEM + 2.2, y + 5.3);
            y += 13;
        } else {
            var espaco = 4;
            var colW = (LARGURA - espaco) / 2;
            var caixaH = 62;
            doc.setFontSize(8.5);

            for (var i = 0; i < fotos.length; i += 2) {
                var par = fotos.slice(i, i + 2);
                var legendas = par.map(function (f, k) {
                    var t = 'Foto ' + (i + k + 1) + (f.legenda ? ' – ' + f.legenda : '');
                    doc.setFont('helvetica', f.legenda ? 'normal' : 'bold');
                    return doc.splitTextToSize(t, colW - 4);
                });
                var linhasLeg = Math.max.apply(null, legendas.map(function (l) { return l.length; }));
                var alturaLinha = 3 + caixaH + 2 + linhasLeg * 3.6 + 3;

                if (y + alturaLinha > limite) {
                    novaPagina();
                    faixaFotos(true);
                }

                par.forEach(function (f, k) {
                    var xCel = MARGEM + k * (colW + espaco);
                    doc.setDrawColor(190, 190, 190);
                    doc.setLineWidth(0.2);
                    doc.rect(xCel, y + 1.5, colW, alturaLinha - 3);

                    // imagem centralizada dentro da caixa, sem distorcer
                    var maxW = colW - 4;
                    var maxH = caixaH;
                    var esc = Math.min(maxW / f.w, maxH / f.h);
                    var wImg = f.w * esc;
                    var hImg = f.h * esc;
                    doc.addImage(f.dados, 'JPEG', xCel + (colW - wImg) / 2, y + 3 + (maxH - hImg) / 2, wImg, hImg);

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8.5);
                    doc.setTextColor.apply(doc, TEXTO);
                    doc.text(legendas[k], xCel + colW / 2, y + 3 + caixaH + 4.5, { align: 'center' });
                });

                y += alturaLinha;
            }
            y += 4;
        }

        // ---- Agente e assinatura
        secao('AGENTE RESPONSÁVEL', [
            [['Agente responsável', c.agente], ['Matrícula', c.matricula]],
        ]);

        garantirEspaco(32);
        y += 16;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(PAG_L / 2 - 45, y, PAG_L / 2 + 45, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor.apply(doc, TEXTO);
        doc.text(texto(b.assinatura) || c.agente || '', PAG_L / 2, y + 5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text('Assinatura do Agente', PAG_L / 2, y + 10, { align: 'center' });

        // ---- Cabecalho, rodape e numeracao em todas as paginas
        var agora = new Date();
        var emitido = doisDigitos(agora.getDate()) + '/' + doisDigitos(agora.getMonth() + 1) + '/' +
            agora.getFullYear() + ' ' + doisDigitos(agora.getHours()) + ':' + doisDigitos(agora.getMinutes());
        var totalPaginas = doc.getNumberOfPages();
        for (var p = 1; p <= totalPaginas; p++) {
            doc.setPage(p);
            if (imagens.cabecalho) doc.addImage(imagens.cabecalho.dados, 'JPEG', 0, 0, PAG_L, altCab);
            if (imagens.rodape) doc.addImage(imagens.rodape.dados, 'JPEG', 0, PAG_A - altRod, PAG_L, altRod);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(110, 110, 110);
            var yRod = PAG_A - altRod - 3;
            doc.text('A.R.V.C Nº ' + numero + ' · Emitido em ' + emitido, MARGEM, yRod);
            doc.text('Página ' + p + ' de ' + totalPaginas, PAG_L - MARGEM, yRod, { align: 'right' });
        }

        return doc;
    }

    function nomeArquivoPdf(b) {
        var numero = texto(b.numero_bo).replace(/[^0-9A-Za-z]+/g, '_') || 'sem_numero';
        return 'ARVC_' + numero + '.pdf';
    }

    async function gerarPdfBoletim(b) {
        if (!b || gerandoPdf) return;
        if (!window.jspdf || !window.jspdf.jsPDF) {
            mostrarToast('Não foi possível carregar o gerador de PDF. Recarregue a página.', 'error');
            return;
        }

        gerandoPdf = true;
        mostrarToast('Gerando o PDF...', 'info');
        try {
            var imagens = {};
            try { imagens.cabecalho = await carregarImagemDados(IMG_CABECALHO); } catch (e) { console.warn(e); }
            try { imagens.rodape = await carregarImagemDados(IMG_RODAPE); } catch (e) { console.warn(e); }

            var fotos = [];
            var lista = Array.isArray(b.fotos) ? b.fotos : [];
            if (lista.length && window.GML_BO_FOTOS) {
                var urls = await window.GML_BO_FOTOS.urlsAssinadas(lista);
                for (var i = 0; i < urls.length; i++) {
                    if (!urls[i]) continue;
                    try {
                        var img = await carregarImagemDados(urls[i], 1200);
                        img.legenda = texto(lista[i].legenda);
                        fotos.push(img);
                    } catch (e) {
                        console.warn('Foto nao incluida no PDF:', e);
                    }
                }
            }

            var doc = criarDocumentoPdf(b, imagens, fotos);
            doc.save(nomeArquivoPdf(b));
            mostrarToast('PDF gerado!', 'success');
        } catch (err) {
            console.error('Erro ao gerar PDF do A.R.V.C:', err);
            var motivo = window.GML_BO_FOTOS ? window.GML_BO_FOTOS.explicarErro(err) : err.message;
            mostrarToast('Erro ao gerar o PDF: ' + motivo, 'error');
        } finally {
            gerandoPdf = false;
        }
    }

    window.GML_AUTO_REMOCAO = {
        gerarWord: gerarWordBoletim,
        gerarPdf: gerarPdfBoletim,
        montarCampos: montarCampos,
        criarDocumentoPdf: criarDocumentoPdf,
    };
})();
