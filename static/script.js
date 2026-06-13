const robot = document.getElementById("robotMascota");
const btnSaludar = document.getElementById("btnSaludar");
const estado = document.getElementById("estado");

const formImagen = document.getElementById("formImagen");
const inputImagen = document.getElementById("inputImagen");

let recognizer = null;
let escuchandoAudio = false;

const URL_AUDIO = "/static/my_model/";

// ROBOT SALUDA
if (btnSaludar && robot) {
    btnSaludar.addEventListener("click", () => {
        const animaciones = robot.availableAnimations || [];
        const saludo = animaciones.includes("Wave") ? "Wave" : animaciones[0];

        if (saludo) {
            robot.animationName = saludo;
            robot.currentTime = 0;
            robot.play({ repetitions: 1 });
        } else if (estado) {
            estado.textContent = "El robot está listo, pero este modelo no tiene animación de saludo.";
        }
    });
}

// IMAGEN: al seleccionar archivo, se envía sin botón extra
if (inputImagen && formImagen) {
    inputImagen.addEventListener("change", () => {
        if (inputImagen.files.length > 0) {
            estado.textContent = "Imagen seleccionada. Enviando al backend...";
            formImagen.submit();
        }
    });
}

// AUDIO: Teachable Machine en vivo con speech-commands
async function iniciarAudioTeachable() {
    try {
        if (escuchandoAudio) {
            estado.textContent = "El micrófono ya está escuchando.";
            return;
        }

        if (typeof speechCommands === "undefined") {
            estado.textContent = "No cargó la librería speech-commands. Revisa el HTML.";
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            estado.textContent = "Tu navegador no soporta acceso al micrófono o requiere HTTPS.";
            return;
        }

        cambiarBotonAudio("⏳", "Cargando modelo", "Espera unos segundos...");

        const checkpointURL = URL_AUDIO + "model.json";
        const metadataURL = URL_AUDIO + "metadata.json";

        recognizer = speechCommands.create(
            "BROWSER_FFT",
            undefined,
            checkpointURL,
            metadataURL
        );

        estado.textContent = "Cargando modelo de audio...";
        await recognizer.ensureModelLoaded();

        const etiquetas = recognizer.wordLabels();
        console.log("Etiquetas del modelo:", etiquetas);

        escuchandoAudio = true;
        cambiarBotonAudio("👂", "Escuchando audio", "Habla o reproduce un audio para analizar");
        estado.textContent = "Micrófono activo. El modelo está analizando en vivo.";

        recognizer.listen(result => {
            const scores = result.scores;

            let indiceMayor = 0;
            let confianzaMayor = scores[0];

            for (let i = 1; i < scores.length; i++) {
                if (scores[i] > confianzaMayor) {
                    confianzaMayor = scores[i];
                    indiceMayor = i;
                }
            }

            const etiqueta = etiquetas[indiceMayor];
            const confianza = (confianzaMayor * 100).toFixed(1);

            actualizarResultado(
                "🎙️",
                etiqueta,
                "El modelo detectó: " + etiqueta + " con una confianza de " + confianza + "%."
            );

            estado.textContent = "Resultado detectado: " + etiqueta + " (" + confianza + "%)";

            console.log("Resultado:", etiqueta, confianza + "%");
            console.log("Scores:", scores);
        }, {
            includeSpectrogram: true,
            probabilityThreshold: 0,
            invokeCallbackOnNoiseAndUnknown: true,
            overlapFactor: 0.50
        });

    } catch (error) {
        cambiarBotonAudio("🎙️", "Activar micrófono", "El audio se analizará en vivo con Teachable Machine");
        const mensaje = error && error.message ? error.message : String(error);
        estado.textContent = "Error de audio: " + mensaje;
        console.error("Audio error:", error);
    }
}

// CAMBIA TEXTO DEL BOTÓN DE AUDIO
function cambiarBotonAudio(icono, titulo, texto) {
    const iconoAudio = document.getElementById("iconoAudio");
    const tituloAudio = document.getElementById("tituloAudio");
    const textoAudio = document.getElementById("textoAudio");

    if (iconoAudio && tituloAudio && textoAudio) {
        iconoAudio.textContent = icono;
        tituloAudio.textContent = titulo;
        textoAudio.textContent = texto;
    }
}

// ACTUALIZA TARJETA DE RESULTADO
function actualizarResultado(icono, titulo, detalle) {
    const iconoResultado = document.getElementById("iconoResultado");
    const tituloResultado = document.getElementById("tituloResultado");
    const detalleResultado = document.getElementById("detalleResultado");

    if (iconoResultado && tituloResultado && detalleResultado) {
        iconoResultado.textContent = icono;
        tituloResultado.textContent = titulo;
        detalleResultado.textContent = detalle;
    }
}
