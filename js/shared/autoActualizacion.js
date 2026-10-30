window.AutoActualizacion = (function () {
    const INTERVALO_MS = 30000; // único lugar donde se cambia el intervalo
    let ultimaCarga = 0;
    let proximaEjecucion = 0;
    let cargando = false;

    async function ejecutar(funcionCarga) {
        if (cargando) return;
        cargando = true;
        try {
            await funcionCarga();
            ultimaCarga = Date.now();
        } finally {
            cargando = false;
        }
    }

    function programar(funcionCarga) {
        const margen = Math.random() * 3000; // reparte a los usuarios en el tiempo
        const espera = INTERVALO_MS + margen;
        proximaEjecucion = Date.now() + espera;
        setTimeout(async () => {
            if (!document.hidden) await ejecutar(funcionCarga);
            programar(funcionCarga);
        }, espera);
    }

    function segundosRestantes() {
        return Math.max(0, Math.ceil((proximaEjecucion - Date.now()) / 1000));
    }

    // Si la página tiene un elemento con id "proximaActualizacion", muestra la cuenta regresiva.
    // Las páginas que no lo tienen siguen funcionando igual que antes.
    function iniciarContador() {
        const elemento = document.getElementById('proximaActualizacion');
        if (!elemento) return;

        const mostrar = () => {
            elemento.textContent = `Próxima actualización en: ${segundosRestantes()}s`;
        };

        mostrar();
        setInterval(mostrar, 1000);
    }

    function iniciar(funcionCarga) {
        ultimaCarga = Date.now();
        programar(funcionCarga);
        iniciarContador();
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && Date.now() - ultimaCarga > INTERVALO_MS) {
                ejecutar(funcionCarga);
            }
        });
    }

    return { iniciar };
})();
