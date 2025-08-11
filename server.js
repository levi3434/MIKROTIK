// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const RouterOSClient = require('node-routeros').RouterOSClient;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

const API_BASE = '/api';

// قراءة البيانات من ملف JSON
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const json = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// حفظ البيانات في ملف JSON
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// دالة لجلب المستخدمين من راوتر Mikrotik
async function fetchMikrotikUsers(routerConfig) {
  const client = new RouterOSClient({
    host: routerConfig.ip,
    user: routerConfig.username,
    password: routerConfig.password,
    port: routerConfig.port || 8728,
  });

  try {
    await client.connect();
    // جلب المستخدمين المتصلين عبر PPP (يمكن تعديل المسار حسب نوع المستخدمين)
    const usersRaw = await client.menu('/ppp/active').getAll();
    await client.close();

    return usersRaw.map(u => ({
      username: u.name,
      ip: u.address,
      uptime: u.uptime,
    }));
  } catch (err) {
    console.error('خطأ في الاتصال بالراوتر:', err.message);
    throw err;
  }
}

// API: حفظ بيانات الراوتر
app.post(`${API_BASE}/router`, (req, res) => {
  const { ip, port, username, password } = req.body;
  if (!ip || !username || !password) {
    return res.status(400).json({ error: 'يرجى ملء جميع حقول الراوتر المطلوبة' });
  }
  const data = readData();
  data.router = { ip, port: port || 8728, username, password };
  saveData(data);
  res.json({ message: 'تم حفظ بيانات الراوتر' });
});

// API: جلب بيانات الراوتر والمستخدمين
app.get(`${API_BASE}/data`, (req, res) => {
  const data = readData();
  res.json(data);
});

// API: جلب المستخدمين من الراوتر مباشرة
app.get(`${API_BASE}/fetch-users`, async (req, res) => {
  const data = readData();
  if (!data.router) {
    return res.status(400).json({ error: 'لم يتم ضبط بيانات الراوتر' });
  }
  try {
    const users = await fetchMikrotikUsers(data.router);
    data.users = users;
    saveData(data);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'فشل في جلب المستخدمين من الراوتر' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
