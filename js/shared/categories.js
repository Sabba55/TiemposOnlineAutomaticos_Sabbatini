window.UtilidadesCategorias = (function () {
    function normalizarCategoria(categoria) {
        return String(categoria || '').trim().toUpperCase();
    }

    function obtenerPrioridadCategoria(categoria) {
        const cat = normalizarCategoria(categoria);

        if (cat === 'RC1' || cat === 'RALLY1') return 0;
        if (cat === 'RC2' || cat === 'RALLY2') return 1;
        if (cat === 'RCMR') return 2;
        if (cat === 'RC4') return 3;
        if (cat === 'RC3' || cat === 'JUNIOR') return 4;
        if (cat === 'RC5') return 5;

        return 6;
    }

    function ordenarCategorias(categorias) {
        return [...(categorias || [])].sort((a, b) => {
            const prioridadA = obtenerPrioridadCategoria(a);
            const prioridadB = obtenerPrioridadCategoria(b);

            if (prioridadA !== prioridadB) {
                return prioridadA - prioridadB;
            }

            return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
        });
    }

    return {
        normalizarCategoria,
        obtenerPrioridadCategoria,
        ordenarCategorias,
    };
})();
