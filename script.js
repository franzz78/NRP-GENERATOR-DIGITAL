import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// KONFIGURASI FIREBASE MILIK ANDA
const firebaseConfig = {
  apiKey: "AIzaSyD9BmV4XKXuMWa4PZHpb7Bbt-rHs61m3lE",
  authDomain: "absensi-polri.firebaseapp.com",
  databaseURL: "https://absensi-polri-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "absensi-polri",
  storageBucket: "absensi-polri.firebasestorage.app",
  messagingSenderId: "19006760644",
  appId: "1:19006760644:web:b7dac0410e47877ded4b91",
  measurementId: "G-82KHRYZBN0"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Data Kredensial Owner Tetap Sesuai Ketentuan
const OWNER_USER = "AFI_JAYA_2026#";
const OWNER_PASS = "AFIJAYAA_2026##";

// State Aplikasi
let currentUser = null;
let currentRole = null;
let registeredUsers = {};

// DOM Elements
const loginPage = document.getElementById('login-page');
const dashboardPage = document.getElementById('dashboard-page');
const loginForm = document.getElementById('login-form');
const userBadge = document.getElementById('user-badge');
const userDisplayName = document.getElementById('user-display-name');
const btnLogout = document.getElementById('btn-logout');
const ownerOptions = document.getElementById('owner-nrp-options');
const nrpMode = document.getElementById('nrp-mode');
const nrpOutput = document.getElementById('nrp-output');
const btnGenerate = document.getElementById('btn-generate');
const btnSaveNrp = document.getElementById('btn-save-nrp');
const sectionOwnerOnly = document.getElementById('section-owner-only');
const registerMemberForm = document.getElementById('register-member-form');
const userListTbody = document.getElementById('user-list-tbody');

// --- PENDENGAR UTAMA (REAL-TIME DATABASE listeners) ---

// 1. Sinkronisasi Tema Global (Dark/White Mode)
onValue(ref(db, 'settings/globalTheme'), (snapshot) => {
    const theme = snapshot.val();
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
});

// 2. Sinkronisasi Data Anggota & Status Online / Offline
onValue(ref(db, 'users'), (snapshot) => {
    registeredUsers = snapshot.val() || {};
    renderUserList();
});

// --- SISTEM AUTENTIKASI & LOGOUT ---

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value.trim();

    // Cek Akses Mode Owner (Mutlak)
    if (userIn === OWNER_USER && passIn === OWNER_PASS) {
        doLogin(userIn, 'owner');
        return;
    }

    // Cek Akses Terdaftar yang dibuat oleh Owner (Admin / Moderator)
    let foundUser = null;
    let foundKey = null;
    Object.keys(registeredUsers).forEach(key => {
        if (registeredUsers[key].username === userIn && registeredUsers[key].password === passIn) {
            foundUser = registeredUsers[key];
            foundKey = key;
        }
    });

    if (foundUser) {
        doLogin(userIn, foundUser.role, foundKey);
    } else {
        alert("Kredensial salah atau akun Anda belum didaftarkan oleh Owner!");
    }
});

function doLogin(username, role, key = null) {
    currentUser = username;
    currentRole = role;

    loginPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');

    userBadge.textContent = role;
    userDisplayName.textContent = username;

    // Proteksi pembatasan Menu berdasarkan Role masing-masing
    if (role === 'owner') {
        sectionOwnerOnly.classList.remove('hidden');
        ownerOptions.classList.remove('hidden');
        nrpMode.value = 'random';
        toggleNrpReadonly(true);
    } else if (role === 'admin') {
        sectionOwnerOnly.classList.add('hidden');
        ownerOptions.classList.add('hidden');
        toggleNrpReadonly(true);
    } else if (role === 'moderator') {
        // Moderator hanya berfokus pada pembuatan NRP (Seksi generator saja)
        sectionOwnerOnly.classList.add('hidden');
        ownerOptions.classList.add('hidden');
        toggleNrpReadonly(true);
    }

    // Ubah Status Kehadiran Secara Real-time ke Database jika status login valid
    if (key) {
        const userStatusRef = ref(db, `users/${key}`);
        update(userStatusRef, { status: 'online' });
        
        // Deteksi otomatis jika tab ditutup / putus koneksi menjadi offline
        onDisconnect(userStatusRef).update({ status: 'offline' });
    }
}

btnLogout.addEventListener('click', () => {
    if (currentRole !== 'owner') {
        // Mengubah status admin atau moderator menjadi offline di pangkalan data saat keluar
        Object.keys(registeredUsers).forEach(key => {
            if (registeredUsers[key].username === currentUser) {
                update(ref(db, `users/${key}`), { status: 'offline' });
            }
        });
        
        // Langsung terlempar kembali ke halaman login utama (Kecuali Owner)
        currentUser = null;
        currentRole = null;
        dashboardPage.classList.add('hidden');
        loginPage.classList.remove('hidden');
        loginForm.reset();
    } else {
        // Khusus menu Owner, dia akan tetap berada di halaman menu Owner tersebut
        alert("Sesi Owner tetap dipertahankan di halaman ini.");
    }
});

// --- ENGINE GENERATOR NRP ---

nrpMode.addEventListener('change', () => {
    // Fitur Custom/Acak dikontrol sepenuhnya dari hak akses pilihan Owner
    if (nrpMode.value === 'custom') {
        toggleNrpReadonly(false);
        btnSaveNrp.classList.remove('hidden');
        btnGenerate.classList.add('hidden');
        nrpOutput.value = "";
    } else {
        toggleNrpReadonly(true);
        btnSaveNrp.classList.add('hidden');
        btnGenerate.classList.remove('hidden');
    }
});

function toggleNrpReadonly(isReadonly) {
    if (isReadonly) {
        nrpOutput.setAttribute('readonly', true);
    } else {
        nrpOutput.removeAttribute('readonly');
    }
}

// Tombol Pembuatan NRP Acak (Akses: Admin, Moderator, Owner)
btnGenerate.addEventListener('click', () => {
    // Membuat susunan NRP Acak digital standard 11-digit
    let randomNrp = "11" + Math.floor(100000000 + Math.random() * 900000000).toString();
    nrpOutput.value = randomNrp;

    // Menyimpan rekap log pembuatan secara berkala ke pangkalan data
    const logRef = push(ref(db, 'nrp_logs'));
    set(logRef, {
        nrp: randomNrp,
        generatedBy: currentUser,
        timestamp: new Date().toLocaleString('id-ID')
    });

    alert("NRP Acak Sukses Dibuat!");
});

// Tombol Simpan NRP Custom (Akses: Hanya Muncul pada Mode Owner Custom)
btnSaveNrp.addEventListener('click', () => {
    const customVal = nrpOutput.value.trim();
    if (!customVal) return alert("Silakan masukkan nomor NRP Custom manual Anda!");

    const logRef = push(ref(db, 'nrp_logs'));
    set(logRef, {
        nrp: customVal,
        generatedBy: currentUser,
        timestamp: new Date().toLocaleString('id-ID')
    });

    alert("NRP Custom Berhasil Disimpan ke Database Global!");
    nrpOutput.value = "";
});

// --- MANAJEMEN KELOLA AKSES USER (HANYA OWNER) ---

registerMemberForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('reg-username').value.trim();
    const p = document.getElementById('reg-password').value.trim();
    const r = document.getElementById('reg-role').value;

    // Validasi agar tidak terjadi duplikasi username
    let exists = Object.values(registeredUsers).some(user => user.username === u);
    if (exists || u === OWNER_USER) return alert("Username ini sudah terdaftar di sistem!");

    const newUserRef = push(ref(db, 'users'));
    set(newUserRef, {
        username: u,
        password: p,
        role: r,
        status: 'offline' // default awal pendaftaran offline
    });

    registerMemberForm.reset();
    alert(`Berhasil mendaftarkan akun ${u} sebagai ${r}.`);
});

function renderUserList() {
    userListTbody.innerHTML = "";
    Object.keys(registeredUsers).forEach(key => {
        const u = registeredUsers[key];
        const tr = document.createElement('tr');

        // Indikator Warna Hijau untuk Online dan Abu-abu untuk Offline sesuai permintaan
        const statusDot = u.status === 'online' ? '<span class="status-dot online"></span>' : '<span class="status-dot offline"></span>';
        
        tr.innerHTML = `
            <td>${u.username}</td>
            <td><span class="badge" style="background:#34495e">${u.role}</span></td>
            <td>${statusDot} ${u.status || 'offline'}</td>
            <td><button class="btn btn-danger delete-user-btn" data-key="${key}"><i class="fas fa-trash"></i> Hapus</button></td>
        `;
        userListTbody.appendChild(tr);
    });

    // Fitur Menghapus Akses Admin/Moderator oleh Owner
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const keyToDelete = btn.getAttribute('data-key');
            if(confirm("Apakah Anda yakin ingin menghapus mutlak akses pengguna ini?")) {
                remove(ref(db, `users/${keyToDelete}`));
            }
        });
    });
}

// --- PENGATURAN TEMA GLOBAL (HANYA OWNER) ---

document.getElementById('btn-theme-light').addEventListener('click', () => {
    set(ref(db, 'settings/globalTheme'), 'light');
});
document.getElementById('btn-theme-dark').addEventListener('click', () => {
    set(ref(db, 'settings/globalTheme'), 'dark');
});

// --- REKAP EXCEL DATA GENERATE NRP (HANYA OWNER) ---

document.getElementById('btn-export-excel').addEventListener('click', () => {
    onValue(ref(db, 'nrp_logs'), (snapshot) => {
        const data = snapshot.val();
        if(!data) return alert("Data log pembuatan NRP masih kosong!");

        const rows = Object.values(data).map(item => ({
            "Nomor NRP": item.nrp,
            "Dibuat Oleh": item.generatedBy,
            "Waktu Input": item.timestamp
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data Rekap NRP");
        
        // Mengunduh lembar kerja rekap berformat Excel (.xlsx) langsung
        XLSX.writeFile(workbook, "Rekap_NRP_AFI_2026.xlsx");
    }, { onlyOnce: true });
});
  
