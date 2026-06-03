window.UtilidadesTiempo = (function () {
    function normalizarFormatoTiempo(cadenaTiempo) {
        if (!cadenaTiempo || cadenaTiempo === '') return '';

        let tiempo = cadenaTiempo.trim();
        const separadores = (tiempo.match(/[:.,]/g) || []).length;

        if (separadores === 2) {
            const partes = tiempo.split(/[:.,]/);
            if (partes.length === 3) {
                tiempo = `${partes[0]}:${partes[1]}.${partes[2]}`;
            }
        } else if (separadores === 1) {
            tiempo = tiempo.replace(/[,]/, '.');
        }

        return tiempo;
    }

    function esDNF(cadenaTiempo) {
        if (!cadenaTiempo) return false;
        const valorLimpio = cadenaTiempo.trim().toUpperCase();
        return valorLimpio === 'DNF' || valorLimpio === 'D.N.F' || valorLimpio === 'D.N.F.';
    }

    function tiempoASegundos(cadenaTiempo) {
        if (!cadenaTiempo || cadenaTiempo === '') return 999999;
        if (esDNF(cadenaTiempo)) return 999999;

        const tiempoNormalizado = normalizarFormatoTiempo(cadenaTiempo);
        const partes = tiempoNormalizado.split(':');

        if (partes.length === 2) {
            return parseInt(partes[0]) * 60 + parseFloat(partes[1]);
        }

        if (partes.length === 3) {
            return parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60 + parseFloat(partes[2]);
        }

        return 999999;
    }

    function segundosATiempo(segundos, decimales = 2) {
        if (segundos >= 999999) return '-';

        const horas = Math.floor(segundos / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);
        const segs = (segundos % 60).toFixed(decimales);
        const ancho = decimales + 3;

        if (horas > 0) {
            return `${horas}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(ancho, '0')}`;
        }

        return `${minutos}:${String(segs).padStart(ancho, '0')}`;
    }

    function obtenerTiempoEtapa(registro, numeroEtapa) {
        if (!registro || numeroEtapa === null || numeroEtapa === undefined || numeroEtapa === '') {
            return '';
        }

        const clavePE = `PE${numeroEtapa}`;
        const claveSS = `SS${numeroEtapa}`;

        return registro[clavePE] || registro[claveSS] || '';
    }

    function obtenerClavesTiempo(registro) {
        if (!registro) return [];

        const etapas = new Map();

        Object.keys(registro)
            .filter(clave => /^(PE|SS)\d+$/.test(clave))
            .forEach(clave => {
                const numero = parseInt(clave.replace(/^(PE|SS)/, ''), 10);
                const existente = etapas.get(numero);

                if (!existente || (existente.startsWith('SS') && clave.startsWith('PE'))) {
                    etapas.set(numero, clave);
                }
            });

        return [...etapas.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, clave]) => clave);
    }

    return {
        normalizarFormatoTiempo,
        esDNF,
        tiempoASegundos,
        segundosATiempo,
        obtenerTiempoEtapa,
        obtenerClavesTiempo
    };
})();
