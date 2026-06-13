from flask import Flask, render_template, request
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route("/")
def inicio():
    return render_template("index.html")


@app.route("/analizar-imagen", methods=["POST"])
def analizar_imagen():
    archivo = request.files.get("imagen")

    if archivo is None or archivo.filename == "":
        return render_template(
            "index.html",
            resultado="No se seleccionó ninguna imagen."
        )

    nombre_seguro = secure_filename(archivo.filename)
    ruta_archivo = os.path.join(app.config["UPLOAD_FOLDER"], nombre_seguro)

    archivo.save(ruta_archivo)

    return render_template(
        "index.html",
            resultado="Imagen recibida correctamente. Procesando..."
    )


@app.route("/subir-audio", methods=["POST"])
def subir_audio():
    audio = request.files.get("audio")

    if audio is None or audio.filename == "":
        return "No se recibió ningún audio."

    carpeta_audio = os.path.join(app.config["UPLOAD_FOLDER"], "audio")
    os.makedirs(carpeta_audio, exist_ok=True)

    nombre_seguro = secure_filename(audio.filename)
    ruta_audio = os.path.join(carpeta_audio, nombre_seguro)

    audio.save(ruta_audio)

    return "Audio recibido correctamente. Falta conectar el modelo."


if __name__ == "__main__":
    app.run(debug=True)