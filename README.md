# WhatsApp Multi-Session API (Node.js & Baileys)

API REST berbasis Express.js yang memungkinkan kamu untuk menjalankan banyak sesi WhatsApp secara bersamaan menggunakan library Baileys. Setiap sesi WhatsApp diidentifikasi dengan `sessionId` unik dan dikelola secara independen.

---

## 📦 Teknologi

* **Node.js**
* **Express.js**
* **Baileys** (WhatsApp Web API)
* **qrcode-terminal, QRCode**

---

## 🚀 Instalasi

Clone repository dan instal dependensi:

```bash
git clone https://github.com/username/whatsapp-multisession-api.git
cd whatsapp-multisession-api
npm install
```

---

## ⚙️ Menjalankan Server

Gunakan perintah berikut untuk menjalankan server:

```bash
npm start
```

Server akan berjalan di port `5000` secara default:

```
API running on port 5000
```

---

## 📌 Endpoint

### ✅ Memulai Sesi Baru

**POST** `/start-session`

```json
{
  "sessionId": "user1"
}
```

### ✅ Mendapatkan QR Code

* **GET** `/qr/:sessionId` (String QR)
* **GET** `/qr-image/:sessionId` (QR Image PNG Base64)

### ✅ Cek Status Sesi

**GET** `/status/:sessionId`

### ✅ Reset Sesi

**POST** `/reset-session`

```json
{
  "sessionId": "user1"
}
```

### ✅ Logout

**POST** `/logout`

```json
{
  "sessionId": "user1"
}
```

---

## 📨 Mengirim Pesan

### Pesan Teks

**POST** `/send-message`

```json
{
  "sessionId": "user1",
  "number": "628xxxx",
  "message": "Halo, ini pesan teks!"
}
```

### Pesan Gambar

**POST** `/send-image`

Form Data:

* `sessionId`
* `number`
* `image` (file)
* `caption` (opsional)

### Kirim Dokumen/File

**POST** `/send-file`

Form Data:

* `sessionId`
* `number`
* `file` (file)
* `caption` (opsional)

### Kirim Pesan ke Grup

**POST** `/send-group`

```json
{
  "sessionId": "user1",
  "groupId": "group-id",
  "message": "Halo grup!"
}
```

---

## 📥 Pesan Masuk (Inbox)

**GET** `/inbox/:sessionId`

---

## 🔄 Forward Pesan

**POST** `/forward`

```json
{
  "sessionId": "user1",
  "messageId": "id-pesan-dari-inbox",
  "to": "628xxxx"
}
```

---

## 🔍 Cek Nomor dan Profil

### Cek Nomor WhatsApp Aktif

**GET** `/check-number/:sessionId/:number`

### Info Profil Nomor

**GET** `/profile/:sessionId/:number`

---

## ⚡️ Auto-Reply

### Set Auto-Reply

**POST** `/auto-reply`

```json
{
  "rules": [
    { "keyword": "hai", "reply": "Halo!" }
  ]
}
```

### Lihat Auto-Reply

**GET** `/auto-reply`

---

## 📂 Struktur Folder

```
.
├── auth_info_baileys_<sessionId>/
├── inbox_<sessionId>.json
├── autoreply.json
└── uploads/
```

---

## 🔧 Troubleshooting

* Jika nodemon restart terus, tambahkan ignore ke `nodemon.json`:

```json
{
  "ignore": ["auth_info_baileys_*/*", "inbox_*.json"]
}
```

* Jika pesan tidak terkirim (timeout), pastikan session sudah connected menggunakan `/status/:sessionId`.

---

## 📖 Lisensi

Proyek ini open-source dan bebas digunakan.
