/**
 * APPS SCRIPT — Publicar productos desde el sitio (Velas Kukumita)
 * ------------------------------------------------------------------
 * QUÉ HACE:
 *  1) Verifica que quien manda la petición realmente inició sesión
 *     con una de las cuentas de Google autorizadas (no solo confía
 *     en lo que diga el navegador).
 *  2) Aplica un límite de 2 minutos entre publicaciones, por persona,
 *     guardado en el propio servidor (no se puede evadir borrando
 *     datos del navegador).
 *  3) Sube la(s) imagen(es) a ImgBB.
 *  4) Escribe una nueva fila en la hoja, alineando cada dato con la
 *     columna que le corresponde según su encabezado.
 *
 * CÓMO INSTALARLO:
 *  1) Abre tu Google Sheets → Extensiones → Apps Script.
 *  2) Borra el contenido del editor y pega TODO este archivo.
 *  3) Reemplaza CORREOS_AUTORIZADOS y GOOGLE_CLIENT_ID abajo (ver
 *     instrucciones en cada constante).
 *  4) Implementar → Nueva implementación → tipo "Aplicación web".
 *     - Ejecutar como: Yo (tu cuenta)
 *     - Quién tiene acceso: Cualquier usuario
 *  5) Copia la URL que te da (termina en /exec) y pégala en
 *     APPS_SCRIPT_PRODUCTOS_URL dentro de app.js.
 *  6) Cada vez que edites este script, tienes que crear una
 *     "Nueva implementación" otra vez para que los cambios se
 *     publiquen (o usar "Administrar implementaciones" → editar).
 */

// ════════════════════════════════════════════════════════════
// CONFIGURACIÓN — edita estas 3 cosas antes de publicar
// ════════════════════════════════════════════════════════════

// Tu clave de API de ImgBB (la que ya tenías).
const IMGBB_API_KEY = "1fe0257b2f626d49dfcce373de6b3daf";

// Los ÚNICOS correos de Google que pueden publicar productos.
const CORREOS_AUTORIZADOS = [
  "REEMPLAZA-CON-TU-CORREO@gmail.com",
  "REEMPLAZA-CON-EL-CORREO-DE-TU-MAMA@gmail.com"
];

// El "Web client ID" de OAuth de tu proyecto de Firebase. Lo encuentras en:
// Firebase Console → Authentication → Sign-in method → Google → despliega
// el bloque "Configuración del SDK web" → ahí aparece como "Web client ID"
// (termina en ".apps.googleusercontent.com"). NO es la misma API key que
// usas en firebaseConfig dentro de app.js.
const GOOGLE_CLIENT_ID = "REEMPLAZA-CON-TU-WEB-CLIENT-ID.apps.googleusercontent.com";

// Tiempo mínimo entre publicaciones, por persona.
const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutos

// Columnas del catálogo, EN EL MISMO ORDEN en que aparecen en tu hoja.
const COLUMNAS = [
  "Nombre", "precio", "precio mayoreo", "Descripción", "video youtube",
  "Imagen", "Etiqueta Principal", "SubEtiqueta", "Etiquetas Evento",
  "en oferta", "más vendido", "Alto", "Ancho", "SubImagen",
  "youtube img/vid", "existencia"
];

// ════════════════════════════════════════════════════════════
// LÓGICA — no necesitas tocar nada de aquí para abajo
// ════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // 1) Verificar identidad real contra Google (no solo lo que diga el navegador)
    var email = verificarToken(data.idToken);
    if (CORREOS_AUTORIZADOS.indexOf(email) === -1) {
      return responder({ status: "error", mensaje: "Esta cuenta no está autorizada para publicar productos." });
    }

    // 2) Límite de 2 minutos entre publicaciones, por persona (guardado en el servidor)
    var props = PropertiesService.getScriptProperties();
    var clave = "ultimo_" + email;
    var ahora = Date.now();
    var ultimo = Number(props.getProperty(clave) || 0);
    if (ahora - ultimo < RATE_LIMIT_MS) {
      var restante = Math.ceil((RATE_LIMIT_MS - (ahora - ultimo)) / 1000);
      return responder({ status: "error", mensaje: "Espera " + restante + " segundos antes de publicar otro producto." });
    }

    // 3) Subir imagen(es) a ImgBB
    var urlImagen = data.imagenBase64 ? subirAImgBB(data.imagenBase64) : "";
    var urlSubImagen = data.subImagenBase64 ? subirAImgBB(data.subImagenBase64) : "";

    // 4) Armar la fila en el mismo orden que COLUMNAS
    var fila = COLUMNAS.map(function (col) {
      switch (col) {
        case "Nombre": return data.nombre || "";
        case "precio": return data.precio || "";
        case "precio mayoreo": return data.precioMayoreo || "";
        case "Descripción": return data.descripcion || "";
        case "video youtube": return data.videoYoutube || "";
        case "Imagen": return urlImagen;
        case "Etiqueta Principal": return data.etiquetaPrincipal || "";
        case "SubEtiqueta": return data.subEtiqueta || "";
        case "Etiquetas Evento": return data.etiquetasEvento || "";
        case "en oferta": return data.enOferta ? "Si" : "";
        case "más vendido": return data.masVendido ? "Si" : "";
        case "Alto": return data.alto || "";
        case "Ancho": return data.ancho || "";
        case "SubImagen": return urlSubImagen;
        case "youtube img/vid": return data.youtubeImgVid || "";
        case "existencia": return data.existencia || "";
        default: return "";
      }
    });

    // 5) Escribir en la hoja, en la siguiente fila vacía, sin tocar las demás columnas (hasta la 186)
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var siguienteFila = hoja.getLastRow() + 1;
    hoja.getRange(siguienteFila, 1, 1, fila.length).setValues([fila]);

    // 6) Registrar el momento de esta publicación (para el límite de 2 minutos)
    props.setProperty(clave, String(ahora));

    return responder({ status: "success", mensaje: "Producto agregado correctamente." });

  } catch (error) {
    return responder({ status: "error", mensaje: error.toString() });
  }
}

/**
 * Verifica el idToken de Google contra el propio servidor de Google
 * (no confía en nada que venga solo del navegador) y regresa el
 * correo si es válido. Lanza un error si el token es inválido,
 * expiró, o no fue emitido para esta aplicación (GOOGLE_CLIENT_ID).
 */
function verificarToken(idToken) {
  if (!idToken) throw new Error("Falta iniciar sesión con Google.");
  var resp = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  var info = JSON.parse(resp.getContentText());
  if (!info.email) throw new Error("Token inválido.");
  if (info.aud !== GOOGLE_CLIENT_ID) throw new Error("Token no corresponde a esta aplicación.");
  if (Number(info.exp) * 1000 < Date.now()) throw new Error("La sesión expiró, vuelve a intentarlo.");
  return info.email;
}

function subirAImgBB(base64Data) {
  var base64Limpio = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
  var url = "https://api.imgbb.com/1/upload?key=" + IMGBB_API_KEY;
  var options = {
    method: "post",
    payload: { image: base64Limpio },
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);
  var resultado = JSON.parse(response.getContentText());
  if (resultado.success) return resultado.data.url;
  throw new Error("Error al subir imagen a ImgBB: " + JSON.stringify(resultado));
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
