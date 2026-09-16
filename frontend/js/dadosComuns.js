(function () {
    'use strict';

    window.GML_DADOS = {
        VIATURAS: [
            { value: 'Nissan Frontier 0110', label: 'Nissan Frontier 0110' },
            { value: 'Chevrolet S10 0111', label: 'Chevrolet S10 0111' },
            { value: 'Vectra 0109', label: 'Vectra 0109' },
            { value: 'MOTO 1350 HARLEY DAVIDSON 0107', label: 'MOTO GM07' },
        ],

        MOTORISTAS: [
            { value: 'Sayonara Jacques Vieira', label: 'Jacques' },
            { value: 'Leandro De Araujo', label: 'Leandro' },
            { value: 'Arlon Luiz Da Silva', label: 'Arlon' },
            { value: 'Luiz Eduardo Cortegrosso Silva', label: 'Luiz' },
            { value: 'Jair pacheco Dos Reis Junior', label: 'Reis' },
            { value: 'Luciano Ferreira', label: 'Ferreira' },
            { value: 'Saleide Flor Duarte', label: 'Duarte' },
            { value: 'Maik custodio Agostinho', label: 'Maik' },
        ],

        INSPETORES: [
            { value: 'Maik', label: 'Maik' },
            { value: 'Leandro', label: 'Leandro' },
            { value: 'Ferreira', label: 'Ferreira' },
        ],

        EQUIPES: [
            'Equipe Alpha',
            'Equipe Bravo',
            'Equipe Charlie',
            'Equipe Delta',
        ],

        TURNOS: ['Diurno', 'Noturno', 'Administrativo', 'Plantão'],

        PRIORIDADES: ['Baixa', 'Normal', 'Alta', 'Urgente'],

        STATUS_ORDEM: ['Aberta', 'Em andamento', 'Concluída', 'Cancelada'],

        STATUS_RELATORIO: ['Rascunho', 'Enviado', 'Aprovado', 'Arquivado'],

        TIPOS_SERVICO: [
            'Patrulhamento',
            'Apoio Operacional',
            'Escolta',
            'Manutenção',
            'Transporte',
            'Evento',
            'Outros',
        ],

        PATRULHAMENTOS: [
            'Ronda Preventiva',
            'Apoio Operacional',
            'Evento Especial',
            'Atendimento Emergencial',
            'Missão',
            'Manutenção de viatura',
            'Outros',
        ],
    };

    window.preencherSelect = function (id, itens, valueKey, labelKey) {
        const el = document.getElementById(id);
        if (!el) return;
        const primeiraOpcao = el.options[0];
        el.innerHTML = '';
        if (primeiraOpcao) el.appendChild(primeiraOpcao);
        else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Selecione...';
            el.appendChild(opt);
        }
        itens.forEach(function (item) {
            const opt = document.createElement('option');
            if (typeof item === 'string') {
                opt.value = item;
                opt.textContent = item;
            } else {
                opt.value = item[valueKey || 'value'];
                opt.textContent = item[labelKey || 'label'];
            }
            el.appendChild(opt);
        });
    };

    window.preencherSelectMultiplo = function (id, itens) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        itens.forEach(function (item) {
            const opt = document.createElement('option');
            opt.value = item.value || item;
            opt.textContent = item.label || item;
            el.appendChild(opt);
        });
    };
})();
