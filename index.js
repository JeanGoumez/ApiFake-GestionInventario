const express = require('express');
const fs = require('fs');
const path = require('path');
const { routes } = require('./config');

const multer = require('multer');
const puppeteer = require('puppeteer');
const { createCanvas, loadImage } = require('canvas');

const app = express();
const port = 3000;
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.json', '.lottie'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowedTypes.includes(ext));
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

app.use(express.json());
app.use(express.static('public'));

app.all('/sap/bc/zws_app/GSIM/:api/:centro/:almacen/:doc', (req, res) => {

  const { api, centro, almacen, doc } = req.params;
  const sapClient = req.query['sap-client'];
  const routeConfig = routes[api];

  if (!routeConfig) {
    return res.status(404).json({ error: 'API no registrada en config.js' });
  }

  // Validar método
  if (req.method !== routeConfig.method) {
    return res.status(405).json({ error: `Método ${req.method} no permitido para ${api}` });
  }

  // Validar estructura de body si es POST
  var isPOST = false;
  if (req.method === 'POST') {
    isPOST = true;
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Body JSON requerido para esta API' });
    }

    var requiredFields = []
    if (api === 'API_TRASLADO_CE_1') {
      requiredFields = [
        // 'Fecha_documento',
        // 'Fecha_contabilizacion',
        'Glosa',
        'Referencia',
        // 'Centro_desde',
        // 'Centro_hasta',
        // 'Almacen_desde',
        // 'Almacen_hasta',
        // 'Material',
        // 'Lote',
        // 'Cantidad',
        // 'Unidad_medida'
      ];
    }
    if (api === 'API_TRASLADO_ALM_1') {
      requiredFields = [
        'Fecha_documento',
        'Fecha_contabilizacion',
        'Glosa',
        'Referencia',
        'Centro_desde',
        'Centro_hasta',
        'Almacen_desde',
        'Almacen_hasta'
      ];
    }
    if (requiredFields.length > 0) {
      const missing = requiredFields.filter(field => {
        const value = req.body[field];
        return (
          value === undefined ||
          typeof value !== 'string' ||
          value.trim().length < 2
        );
      });

      if (missing.length > 0) {
        return res.status(400).json({
          error: 'Faltan campos válidos en el body',
          missing
        });
      }
    } 
    // else {
    //   return res.status(400).json({
    //     error: 'Arregla tu parametro 1 pues',
    //     missing: []
    //   });
    // }



  }
  let response;
  try {

    // if (isPOST) {
    //   response = {
    //     status: '200',
    //     message: 'ok'
    //   }
    // }
    if (isPOST) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-'); // formato seguro para nombre de archivo
  const filename = `post_body_${timestamp}.txt`;
  const savePath = path.join(__dirname, 'saved_bodies', filename);

  // Asegúrate de que la carpeta exista
  fs.mkdirSync(path.dirname(savePath), { recursive: true });

  fs.writeFileSync(savePath, JSON.stringify(req.body, null, 2), 'utf8');

  response = {
    status: '200',
    message: 'ok',
    saved_to: filename
  };
}
    
    else {
      if (api == "GET_MAT_LOTE") {
        const responsePath = path.join(__dirname, 'responses', 'GET_MAT_LOTE', `${centro}`, `${almacen}.json`);
        const data = fs.readFileSync(responsePath, 'utf8');
        response = JSON.parse(data);
      }
      if (api == "GET_ALM") {
  console.log("Valor de centro:", centro);

  if (centro != 0) {
    const responsePath = path.join(__dirname, 'responses', 'GET_ALM', `${centro}.json`);
    console.log("responsePath:", responsePath);

    const data = fs.readFileSync(responsePath, 'utf8'); 
    response = JSON.parse(data); 
  } else {
    console.log("Centro es 0, no se busca archivo específico.");
    // Aquí probablemente se intenta abrir 'responses/GET_ALM.json' en otra parte
  }
}

      if (api == "GET_RESERVA") {
        if (centro != 0) {
          const responsePath = path.join(__dirname, 'responses', 'GET_RESERVA', `${centro}.json`);
          const data = fs.readFileSync(responsePath, 'utf8');
          response = JSON.parse(data);
        }


      }

      else {
        const responsePath = path.join(__dirname, 'responses', `${api}.json`);
        const data = fs.readFileSync(responsePath, 'utf8');
        response = JSON.parse(data);
      }
    }


  } catch (err) {
          console.log("centro_final", err)

    const defaultPath = path.join(__dirname, 'responses', 'default.json');
    response = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
  } 
  res.json(response);
});



// Ruta GET para convertir desde URL
app.get('/api/lottie-to-gif', async (req, res) => {
  const { url, speed = 0.5, width = 300, height = 300, quality = 10, fps = 30 } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL de archivo Lottie requerida' });
  }

  let browser;
  try {
    // Descargar archivo Lottie desde URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error descargando archivo: ${response.statusText}`);
    }

    const lottieData = await response.json();

    // Procesar igual que el POST
    if (lottieData.fr) {
      lottieData.fr = lottieData.fr * parseFloat(speed);
    }

    const htmlContent = createLottieHTML(lottieData, parseInt(width), parseInt(height));
    const htmlPath = `temp_${Date.now()}.html`;
    await fs.writeFile(htmlPath, htmlContent);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: parseInt(width), height: parseInt(height) });
    await page.goto(`file://${path.resolve(htmlPath)}`);
    await page.waitForFunction(() => window.lottieLoaded === true, { timeout: 10000 });

    // ... resto del procesamiento igual que POST
    // (código similar al anterior)

    res.json({ message: 'Funcionalidad completa disponible en ruta POST' });

  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close().catch(console.error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta de estado/salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Lottie to GIF Converter'
  });
});

// Función para crear HTML con Lottie
function createLottieHTML(lottieData, width, height) {
  return `
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
    <style>
        body { margin: 0; padding: 0; }
        #lottie { width: ${width}px; height: ${height}px; }
    </style>
</head>
<body>
    <div id="lottie"></div>
    <script>
        window.lottieLoaded = false;
        window.lottieAnimation = lottie.loadAnimation({
            container: document.getElementById('lottie'),
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: ${JSON.stringify(lottieData)}
        });
        
        window.lottieAnimation.addEventListener('DOMLoaded', () => {
            window.lottieLoaded = true;
        });
    </script>
</body>
</html>`;
}

// Ruta donde se almacenarán las imágenes
const imageDir = path.join(__dirname, 'uploads/images');
fs.mkdirSync(imageDir, { recursive: true });

// // Función para generar nombre secuencial
// function generarNombreSecuencial(extension) {
//   const archivos = fs.readdirSync(imageDir).filter(f => f.startsWith('imagen') && f.endsWith(extension));
//   const numero = archivos.length + 1;
//   return `imagen${numero}${extension}`;
// }

// // Configuración de multer para imágenes
// const imageStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, imageDir);
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();
//     const nombre = generarNombreSecuencial(ext);
//     cb(null, nombre);
//   }
// });

// const uploadImage = multer({
//   storage: imageStorage,
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = ['.jpg', '.jpeg', '.png'];
//     const ext = path.extname(file.originalname).toLowerCase();
//     cb(null, allowedTypes.includes(ext));
//   },
//   limits: {
//     fileSize: 5 * 1024 * 1024 // máximo 5MB
//   }
// });

function generarNombreSecuencial(extension) {
  const archivos = fs.readdirSync(imageDir).filter(f => f.startsWith('imagen') && f.endsWith(extension));
  const numeroBase = archivos.length;

  return (index) => `imagen${numeroBase + index + 1}${extension}`;
}

// Cambiar filename dinámicamente para múltiples archivos
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imageDir);
  },
  filename: (req, file, cb) => {
    if (!req.generatedNames) req.generatedNames = [];

    const ext = path.extname(file.originalname).toLowerCase();
    const generarNombre = generarNombreSecuencial(ext);
    const nombre = generarNombre(req.generatedNames.length);

    req.generatedNames.push(nombre);
    cb(null, nombre);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowedTypes.includes(ext));
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // máximo 5MB por archivo
  }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload-images', uploadImage.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una imagen' });
  }

  const urls = req.files.map(file => ({
    filename: file.filename,
    url: `https://79d4-2803-9810-6109-e008-74d8-2483-c79b-c0f1.ngrok-free.app/uploads/images/${file.filename}`
  }));

  res.json({
    message: 'Imágenes guardadas correctamente',
    cantidad: urls.length,
    archivos: urls
  });
});
app.listen(port, () => {
  console.log(`Servidor fake corriendo en http://localhost:${port}`);
});
