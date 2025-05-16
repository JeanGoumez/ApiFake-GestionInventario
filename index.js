const express = require('express');
const fs = require('fs');
const path = require('path');
const { routes } = require('./config');

const app = express();
const port = 3000;

app.use(express.json());

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
  } else {
    return res.status(400).json({
      error: 'Arregla tu parametro 1 pues',
      missing: []
    });
  }
    
     
    
  } 
  let response;
  try {

    if(isPOST){
response = {
      status: '200',
      message: 'ok'
    }
    }else{
  const responsePath = path.join(__dirname, 'responses', `${api}.json`);
       const data = fs.readFileSync(responsePath, 'utf8');
    response = JSON.parse(data); 
    }
    
  } catch (err) {
    const defaultPath = path.join(__dirname, 'responses', 'default.json');
    response = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
  }

  res.json(response);
});

app.listen(port, () => {
  console.log(`Servidor fake corriendo en http://localhost:${port}`);
});
