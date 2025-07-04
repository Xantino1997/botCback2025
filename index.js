const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const mongoose = require('mongoose');
const { MongoStore } = require('wwebjs-mongo');
const qrcode = require('qrcode');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

let qrCodeBase64 = '';
let client;
const usuariosUnicos = new Set();

mongoose.connect('mongodb+srv://devprueba2025:devprueba2025@cluster0.9x8yltr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0/wwebjs', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('🟢 Conectado exitosamente a MongoDB');

  const store = new MongoStore({ mongoose });

  client = new Client({
    authStrategy: new RemoteAuth({
      store,
      backupSyncIntervalMs: 60000
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', async (qr) => {
    qrCodeBase64 = await qrcode.toDataURL(qr);
    console.log("🔄 Nuevo QR generado.");
  });

  client.on('ready', () => {
    console.log('✅ Cliente de WhatsApp listo.');
  });

  client.on('authenticated', () => {
    console.log('🔐 Cliente autenticado.');
    qrCodeBase64 = '';
  });

  client.on('auth_failure', () => {
    console.error('❌ Fallo de autenticación');
  });

  client.on('disconnected', async (reason) => {
    console.warn('📴 Cliente desconectado:', reason);
    qrCodeBase64 = ''; // Resetear QR para que el frontend pueda pedir uno nuevo si es necesario

    // Si no es logout explícito, reintentar conexión automática
    if (reason !== 'logout') {
      try {
        console.log('🔄 Reintentando conexión automática...');
        await client.destroy();
        await client.initialize();
      } catch (err) {
        console.error('❌ Error al reconectar:', err);
      }
    }
  });

  await client.initialize();

  // Listener de mensajes
  client.on('message', async (msg) => {
    if (msg.from) usuariosUnicos.add(msg.from);
  
    if (msg.body.toLowerCase() === 'hola') {
      const hora = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      await msg.reply(`Hola 👋, son las ${hora}. ¿Cómo te llamás?`);
    } else if (msg.body.length < 25 && !msg.body.includes(' ')) {
      // Si responde con una sola palabra (supuesto nombre)
      const nombre = msg.body.trim();
      await msg.reply(`Gracias por escribir, ${nombre}. Ahí te atiendo 😊`);
    }
  });
  
}).catch(err => {
  console.error("⚠️ Error conectando a MongoDB:", err);
});

app.get('/api/users', (req, res) => {
  res.json({ count: usuariosUnicos.size });
});

app.get('/api/qr', (req, res) => {
  if (qrCodeBase64) {
    res.json({ qr: qrCodeBase64 });
  } else {
    res.json({ message: '✅ Sesión activa o esperando conexión.' });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: client?.info ? 'activo' : 'no conectado' });
});

app.get('/api/logout', async (req, res) => {
  try {
    if (client) {
      await client.logout();
      await client.destroy();
      console.log('🔒 Sesión cerrada desde el frontend.');
      res.json({ message: 'Sesión cerrada correctamente' });
    } else {
      res.status(400).json({ error: 'Cliente no iniciado' });
    }
  } catch (err) {
    console.error('❌ Error al cerrar sesión:', err);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en puerto ${PORT}`);
});
