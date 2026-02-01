const express = require("express");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST", "DELETE"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DB_PATH = path.join(__dirname, "users.json");
const REQ_PATH = path.join(__dirname, "requests.json");

const getData = (p, def = []) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : def;
const saveData = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

const apikey = "ptlc_xnU77ND3STp01jeh49ikjVzxc4GiKvswjUp71uK5FP9";
const domain = "https://pterodactyl.depstore.my.id";
const nestid = "5";
const egg = "15";
const loc = "1";

if (!fs.existsSync(DB_PATH)) {
  saveData(DB_PATH, [{ nama: "d", password: "d", kategori: "developer" }]);
}

app.post("/login", (req, res) => {
  const { nama, password } = req.body;
  const users = getData(DB_PATH);
  const user = users.find(u => u.nama === nama && u.password === password);
  if (!user) return res.status(401).json({ error: "Akun tidak ditemukan atau belum aktif!" });
  res.json({ success: true, user: { nama: user.nama, role: user.kategori } });
});

// --- FITUR BARU: UPDATE PROFILE ---
app.post("/update-profile", (req, res) => {
    const { oldName, newValue, type } = req.body;
    let users = getData(DB_PATH);
    let userIndex = users.findIndex(u => u.nama === oldName);

    if (userIndex === -1) return res.status(404).json({ error: "User tidak ditemukan!" });

    if (type === 'name') {
        if (users.some(u => u.nama === newValue)) return res.status(400).json({ error: "Username sudah digunakan!" });
        users[userIndex].nama = newValue;
    } else if (type === 'pass') {
        users[userIndex].password = newValue;
    }

    saveData(DB_PATH, users);
    res.json({ success: true, message: "Profil berhasil diperbarui!" });
});
// ----------------------------------

app.post("/register-request", (req, res) => {
  const { nama, password, kategori } = req.body;
  const requests = getData(REQ_PATH);
  const users = getData(DB_PATH);
  if (requests.find(r => r.nama === nama) || users.find(u => u.nama === nama)) {
    return res.status(400).json({ error: "Username sudah terdaftar atau dalam antrean!" });
  }
  requests.push({ nama, password, kategori, date: new Date().toISOString() });
  saveData(REQ_PATH, requests);
  res.json({ success: true, message: "Request terkirim! Tunggu konfirmasi Developer." });
});

app.get("/requests", (req, res) => {
  res.json(getData(REQ_PATH));
});

app.post("/confirm-user", (req, res) => {
  const { devName, userName, action } = req.body;
  const users = getData(DB_PATH);
  const requests = getData(REQ_PATH);
  const dev = users.find(u => u.nama === devName && u.kategori === "developer");
  if (!dev) return res.status(403).json({ error: "Akses ditolak!" });

  const targetIdx = requests.findIndex(r => r.nama === userName);
  if (targetIdx === -1) return res.status(404).json({ error: "Data tidak ditemukan" });

  if (action === "approve") {
    const newUser = requests[targetIdx];
    users.push({ nama: newUser.nama, password: newUser.password, kategori: newUser.kategori });
    saveData(DB_PATH, users);
  }
  requests.splice(targetIdx, 1);
  saveData(REQ_PATH, requests);
  res.json({ success: true });
});

app.post("/create", async (req, res) => {
  const { username, email, ram, disk, cpu } = req.body;
  const password = username + Math.floor(Math.random() * 1000);
  try {
    const userRes = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apikey}`, Accept: "application/json" },
      body: JSON.stringify({ email, username, first_name: username, last_name: "User", password, language: "en" }),
    });
    const userData = await userRes.json();
    if (userData.errors) return res.status(400).json({ error: userData.errors[0].detail });

    const serverRes = await fetch(`${domain}/api/application/servers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apikey}`, Accept: "application/json" },
      body: JSON.stringify({
        name: username + "-srv", user: userData.attributes.id, egg: parseInt(egg),
        docker_image: "ghcr.io/pterodactyl/yolks:node_18", startup: "npm start",
        environment: { INST: "npm", USER_UPLOAD: "0", AUTO_UPDATE: "0", CMD_RUN: "npm start" },
        limits: { memory: parseInt(ram), swap: 0, disk: parseInt(disk || ram), io: 500, cpu: parseInt(cpu || 100) },
        feature_limits: { databases: 5, backups: 5, allocations: 5 },
        deploy: { locations: [parseInt(loc)], dedicated_ip: false, port_range: [] },
      }),
    });
    const serverData = await serverRes.json();
    res.json({ success: true, username, password, panel_url: domain, server_id: serverData.attributes?.id });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/servers", async (req, res) => {
  try {
    const response = await fetch(`${domain}/api/application/servers`, {
      headers: { Authorization: `Bearer ${apikey}`, Accept: "application/json" },
    });
    const data = await response.json();
    res.json(data.data || []);
  } catch (err) { res.status(500).json({ error: "Error fetch servers" }); }
});

app.delete("/server/:id", async (req, res) => {
  try {
    await fetch(`${domain}/api/application/servers/${req.params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apikey}`, Accept: "application/json" },
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Gagal hapus" }); }
});

app.get("/", (req, res) => res.json({ status: "online", system: "Depstore-API" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ API Server aktif di port ${PORT}`));
