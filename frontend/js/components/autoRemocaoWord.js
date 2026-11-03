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
        return 'AUTO_DE_REMOCAO_' + numero + '.docx';
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

    window.GML_AUTO_REMOCAO = {
        gerarWord: gerarWordBoletim,
        montarCampos: montarCampos,
    };
})();
