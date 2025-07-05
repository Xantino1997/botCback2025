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
let isAuthenticated = false;
const usuariosUnicos = new Set();
// Conexión a MongoDB
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
    if (!isAuthenticated) {
      qrCodeBase64 = await qrcode.toDataURL(qr);
      console.log("🔄 Nuevo QR generado.");
    }
  });

  client.on('ready', () => {
    console.log('✅ Cliente de WhatsApp listo.');
  });

  client.on('authenticated', () => {
    console.log('🔐 Cliente autenticado.');
    qrCodeBase64 = '';
    isAuthenticated = true;
  });

  client.on('auth_failure', () => {
    console.error('❌ Fallo de autenticación');
    isAuthenticated = false;
  });

  client.on('disconnected', async (reason) => {
    console.warn('📴 Cliente desconectado:', reason);
    qrCodeBase64 = '';
    isAuthenticated = false;

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

  client.on('message', async (msg) => {
    if (msg.from) usuariosUnicos.add(msg.from);

    const text = msg.body.trim().toLowerCase();

    if (text === 'hola') {
      const hora = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      await msg.reply(`Hola 👋, son las ${hora}. ¿Cómo te llamás?`);
    } else if (text.length < 25 && !text.includes(' ')) {
      const nombre = msg.body.trim();
      await msg.reply(`Gracias por escribir, ${nombre}. Ahí te atiendo 😊`);
    } else {
      await msg.reply('No entendí bien 🤔. ¿Podrías repetirlo de otra forma?');
    }
  });

}).catch(err => {
  console.error("⚠️ Error conectando a MongoDB:", err);
});

// Endpoints
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
  res.json({ status: isAuthenticated ? 'activo' : 'no conectado' });
});

app.get('/api/logout', async (req, res) => {
  try {
    if (client) {
      await client.logout();
      await client.destroy();
      qrCodeBase64 = '';
      isAuthenticated = false;
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
