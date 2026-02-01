const API_URL = "https://pterodactyl.depstore.my.id";

function toggleMenu() {
    document.querySelector('.burger').classList.toggle('active');
    document.querySelector('.menu-overlay').classList.toggle('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const ses = { n: sessionStorage.getItem("nama"), r: sessionStorage.getItem("role"), a: sessionStorage.getItem("akses") };
    if (ses.a !== "true") return window.location.href = "index.html";

    document.getElementById("userName").textContent = ses.n;
    document.getElementById("roleBadge").textContent = ses.r;

    if (ses.r !== "developer") {
        document.querySelectorAll('.admin-only').forEach(e => e.remove());
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = (e) => {
            const target = link.dataset.section;
            if (!target) return;
            e.preventDefault();
            document.querySelectorAll('.nav-link, .content-section').forEach(x => x.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(target).classList.add('active');
            if (target === 'requests') fetchRequests();
        };
    });
});

async function updateProfile(type) {
    const rb = document.getElementById("p_result");
    const val = type === 'name' ? document.getElementById("new_name").value : document.getElementById("new_pass").value;
    if(!val) return;
    rb.style.display = "block"; rb.innerHTML = "Processing...";
    try {
        const res = await fetch(`${API_URL}/update-profile`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ oldName: sessionStorage.getItem("nama"), newValue: val, type: type })
        });
        const d = await res.json();
        if(d.success) {
            rb.innerHTML = "Success! Profile Updated.";
            rb.style.borderColor = "#4ade80";
            if(type === 'name') { sessionStorage.setItem("nama", val); location.reload(); }
        } else {
            rb.innerHTML = "Error: " + d.error;
            rb.style.borderColor = "#f87171";
        }
    } catch (e) { rb.innerHTML = "Connection Error."; }
}

async function createServer() {
    const rb = document.getElementById("c_result");
    rb.style.display = "block"; rb.innerHTML = "Deploying Instance...";
    try {
        const res = await fetch(`${API_URL}/create`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                username: document.getElementById("c_user").value,
                email: document.getElementById("c_email").value,
                ram: document.getElementById("c_ram").value
            })
        });
        const d = await res.json();
        if(d.success) {
            rb.innerHTML = `<b>Success!</b> Password: <code>${d.password}</code>`;
            rb.style.borderColor = "#4ade80";
        } else {
            rb.innerHTML = `<b>Fail:</b> ${d.error}`;
            rb.style.borderColor = "#f87171";
        }
    } catch (e) { rb.innerHTML = "Server Error."; }
}

async function fetchRequests() {
    const list = document.getElementById("requestList");
    const res = await fetch(`${API_URL}/requests`);
    const data = await res.json();
    list.innerHTML = data.length ? data.map(r => `
        <div style="padding:15px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span><b>${r.nama}</b><br><small style="color:#666">${r.kategori}</small></span>
            <div style="display:flex; gap:8px">
                <button onclick="confirmUser('${r.nama}','approve')" style="color:#4ade80; background:none; border:1px solid #4ade80; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:11px">Approve</button>
                <button onclick="confirmUser('${r.nama}','reject')" style="color:#f87171; background:none; border:1px solid #f87171; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:11px">Reject</button>
            </div>
        </div>
    `).join('') : '<p style="color:#666; font-size:12px">No pending requests.</p>';
}

async function confirmUser(u, a) {
    await fetch(`${API_URL}/confirm-user`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ devName: sessionStorage.getItem("nama"), userName: u, action: a })
    });
    fetchRequests();
}

function logout() { sessionStorage.clear(); window.location.href = "index.html"; }
