const express = require("express");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors({ 
    origin: "*", 
    methods: ["GET", "POST", "DELETE"], 
    allowedHeaders: ["Content-Type"] 
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DB_PATH = path.join(__dirname, "users.json");
const REQ_PATH = path.join(__dirname, "requests.json");

const getData = (p, def = []) => {
    try {
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p));
        }
        return def;
    } catch (error) {
        return def;
    }
};

const saveData = (p, d) => {
    try {
        fs.writeFileSync(p, JSON.stringify(d, null, 2));
    } catch (error) {
        console.log("Gagal menyimpan data: Sistem file mungkin Read-Only di Vercel.");
    }
};

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
    
    if (!user) {
        return res.status(401).json({ success: false, error: "Username atau Password salah!" });
    }
    
    res.json({ 
        success: true, 
        user: { 
            nama: user.nama, 
            role: user.kategori 
        } 
    });
});

app.post("/register", (req, res) => {
    const { nama, password } = req.body;
    const requests = getData(REQ_PATH);
    const users = getData(DB_PATH);

    if (requests.find(r => r.nama === nama) || users.find(u => u.nama === nama)) {
        return res.status(400).json({ success: false, error: "Username sudah digunakan atau sedang dalam antrean!" });
    }

    requests.push({ 
        nama, 
        password, 
        kategori: "user", 
        date: new Date().toISOString() 
    });
    
    saveData(REQ_PATH, requests);
    res.json({ success: true, message: "Pendaftaran berhasil, silakan tunggu persetujuan admin." });
});

app.post("/update-profile", (req, res) => {
    const { oldName, newValue, type } = req.body;
    let users = getData(DB_PATH);
    let userIndex = users.findIndex(u => u.nama === oldName);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, error: "User tidak ditemukan!" });
    }

    if (type === 'name') {
        if (users.some(u => u.nama === newValue)) {
            return res.status(400).json({ success: false, error: "Username baru sudah digunakan!" });
        }
        users[userIndex].nama = newValue;
    } else if (type === 'pass') {
        users[userIndex].password = newValue;
    }

    saveData(DB_PATH, users);
    res.json({ success: true, message: "Profil berhasil diperbarui!" });
});

app.get("/requests", (req, res) => {
    const requests = getData(REQ_PATH);
    res.json(requests);
});

app.post("/confirm-user", (req, res) => {
    const { devName, userName, action } = req.body;
    const users = getData(DB_PATH);
    const requests = getData(REQ_PATH);

    const dev = users.find(u => u.nama === devName && u.kategori === "developer");
    if (!dev) {
        return res.status(403).json({ success: false, error: "Hanya Developer yang diizinkan!" });
    }

    const targetIndex = requests.findIndex(r => r.nama === userName);
    if (targetIndex === -1) {
        return res.status(404).json({ success: false, error: "Permintaan tidak ditemukan!" });
    }

    if (action === "approve") {
        const newUser = requests[targetIndex];
        users.push({ 
            nama: newUser.nama, 
            password: newUser.password, 
            kategori: newUser.kategori 
        });
        saveData(DB_PATH, users);
    }

    requests.splice(targetIndex, 1);
    saveData(REQ_PATH, requests);
    res.json({ success: true });
});

app.post("/create", async (req, res) => {
    const { username, email, ram, disk, cpu } = req.body;
    const userPassword = username + Math.floor(Math.random() * 10000);

    try {
        const userResponse = await fetch(`${domain}/api/application/users`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${apikey}`, 
                "Accept": "application/json" 
            },
            body: JSON.stringify({ 
                email: email, 
                username: username, 
                first_name: username, 
                last_name: "User", 
                password: userPassword, 
                language: "en" 
            }),
        });

        const userData = await userResponse.json();
        if (userData.errors) {
            return res.status(400).json({ success: false, error: userData.errors[0].detail });
        }

        const serverResponse = await fetch(`${domain}/api/application/servers`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${apikey}`, 
                "Accept": "application/json" 
            },
            body: JSON.stringify({
                name: username + "-server",
                user: userData.attributes.id,
                nest: parseInt(nestid),
                egg: parseInt(egg),
                docker_image: "ghcr.io/pterodactyl/yolks:node_18",
                startup: "npm start",
                environment: { 
                    INST: "npm", 
                    USER_UPLOAD: "0", 
                    AUTO_UPDATE: "0", 
                    CMD_RUN: "npm start" 
                },
                limits: { 
                    memory: parseInt(ram), 
                    swap: 0, 
                    disk: parseInt(disk || ram), 
                    io: 500, 
                    cpu: parseInt(cpu || 100) 
                },
                feature_limits: { 
                    databases: 5, 
                    backups: 5, 
                    allocations: 5 
                },
                deploy: { 
                    locations: [parseInt(loc)], 
                    dedicated_ip: false, 
                    port_range: [] 
                },
            }),
        });

        const serverData = await serverResponse.json();
        if (serverData.errors) {
            return res.status(400).json({ success: false, error: serverData.errors[0].detail });
        }

        res.json({ 
            success: true, 
            username: username, 
            password: userPassword, 
            panel_url: domain, 
            server_id: serverData.attributes.id 
        });

    } catch (err) {
        res.status(500).json({ success: false, error: "Gagal memproses pembuatan server." });
    }
});

app.get("/servers", async (req, res) => {
    try {
        const response = await fetch(`${domain}/api/application/servers`, {
            headers: { 
                "Authorization": `Bearer ${apikey}`, 
                "Accept": "application/json" 
            },
        });
        const data = await response.json();
        res.json(data.data || []);
    } catch (err) {
        res.status(500).json({ success: false, error: "Gagal mengambil daftar server." });
    }
});

app.delete("/server/:id", async (req, res) => {
    try {
        const response = await fetch(`${domain}/api/application/servers/${req.params.id}`, {
            method: "DELETE",
            headers: { 
                "Authorization": `Bearer ${apikey}`, 
                "Accept": "application/json" 
            },
        });

        if (response.status === 204 || response.ok) {
            res.json({ success: true, message: "Server berhasil dihapus." });
        } else {
            res.status(400).json({ success: false, error: "Gagal menghapus server dari panel." });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Kesalahan internal saat menghapus server." });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server Pterodactyl Cpanel aktif di port ${PORT}`);
});

module.exports = app;
