require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ===== WHATSAPP =====
let wClient = null;
let wReady = false;

function iniciarWhatsApp() {
  wClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './auth_data' }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      // No Railway/Linux: usa o Chromium do sistema
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  });

  wClient.on('qr', (qr) => {
    console.log('\n📱 Escaneie o QR Code no WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    console.log('\n⏳ Aguardando leitura...\n');
  });

  wClient.on('ready', () => {
    wReady = true;
    console.log('✅ WhatsApp conectado e pronto!\n');
  });

  wClient.on('auth_failure', () => {
    console.error('❌ Falha de autenticação — delete a pasta auth_data e reinicie.');
  });

  wClient.on('disconnected', (reason) => {
    wReady = false;
    console.warn('⚠️  WhatsApp desconectado:', reason, '— reconectando em 10s...');
    setTimeout(iniciarWhatsApp, 10000);
  });

  wClient.initialize().catch(err => {
    console.error('Erro ao inicializar WhatsApp:', err.message);
    setTimeout(iniciarWhatsApp, 15000);
  });
}

async function enviarMensagem(telefone, texto) {
  if (!wClient || !wReady) throw new Error('WhatsApp não está conectado.');
  const numero = telefone.replace(/\D/g, '');
  if (!numero) throw new Error('Número inválido: ' + telefone);
  const chatId = numero.includes('@') ? numero : `${numero}@c.us`;
  await wClient.sendMessage(chatId, texto);
}

// ===== EXPRESS =====
const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = process.env.WEBHOOK_TOKEN || 'token123';

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Status — útil para verificar se está rodando
app.get('/status', (req, res) => {
  res.json({ ok: true, whatsapp: wReady });
});

// Webhook chamado pelo gerenciador de tarefas
app.post('/webhook', async (req, res) => {
  if (req.query.token !== TOKEN) {
    console.warn('Tentativa com token inválido:', req.query.token);
    return res.status(401).json({ ok: false, error: 'Token inválido.' });
  }

  const { tipo, tarefa, usuario, telefone, prazo, prioridade } = req.body;

  if (!telefone) {
    return res.json({ ok: true, aviso: 'Usuário sem telefone cadastrado.' });
  }

  if (tipo === 'nova_tarefa') {
    const prioridadeLabel = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' };
    const linhas = [
      `📋 *Nova tarefa atribuída a você!*`,
      '',
      `*${tarefa}*`,
      `👤 Para: ${usuario}`,
      `⚡ Prioridade: ${prioridadeLabel[prioridade] || prioridade}`,
    ];
    if (prazo) linhas.push(`📅 Prazo: ${formatarData(prazo)}`);

    try {
      await enviarMensagem(telefone, linhas.join('\n'));
      console.log(`✅ Notificação enviada → ${usuario} (${telefone})`);
      return res.json({ ok: true });
    } catch (err) {
      console.error(`❌ Erro ao enviar para ${usuario}:`, err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  res.json({ ok: true, aviso: 'Tipo de evento não reconhecido.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Bot webhook rodando na porta ${PORT}`);
  console.log(`📡 Endpoint: POST /webhook?token=${TOKEN}`);
  console.log(`🔍 Status:   GET  /status\n`);
});

iniciarWhatsApp();
