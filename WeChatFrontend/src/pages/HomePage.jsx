import { useState, useEffect } from 'react';
import axios from 'axios';

export default function HomePage() {
  const [pesan, setPesan] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);

  // URL Backend Azure
  const API_URL_MESSAGES = "https://wechatbackend-gvcyhxbua7f6cqey.southeastasia-01.azurewebsites.net/api/WeChat/messages";
  const API_URL_USERS = "https://wechatbackend-gvcyhxbua7f6cqey.southeastasia-01.azurewebsites.net/api/WeChat/users";
  const API_URL_SEND = "https://wechatbackend-gvcyhxbua7f6cqey.southeastasia-01.azurewebsites.net/api/WeChat/send";

  // Tarik riwayat pesan
  const fetchMessages = async () => {
    try {
      const response = await axios.get(API_URL_MESSAGES);
      setChatHistory(response.data);
    } catch (error) {
      console.error("Gagal menarik data chat:", error);
    }
  };

  // Tarik data saat pertama kali buka
  useEffect(() => {
    // 1. Tarik Kontak (User)
    axios.get(API_URL_USERS)
      .then(res => setContacts(res.data))
      .catch(err => console.error("Gagal menarik kontak:", err));

    // 2. Tarik Pesan & Jalankan Polling 5 Detik
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter pesan: Hanya tampilkan pesan dari kontak yang sedang diklik
  const filteredMessages = chatHistory.filter(m => 
    activeContact ? m.openId === activeContact.openid : false
  );

  // Fungsi Kirim Pesan
  const handleKirim = async () => {
    if (!pesan.trim()) return;

    if (!activeContact) {
        alert("Pilih klien di sebelah kiri terlebih dahulu!");
        return;
    }

    try {
      await axios.post(API_URL_SEND, {
        openId: activeContact.openid, // Otomatis mengirim ke kontak yang sedang aktif
        content: pesan
      });
      
      setPesan(""); 
      fetchMessages(); 
      
    } catch (error) {
      console.error("Gagal mengirim pesan:", error);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      
      {/* ================= SIDEBAR KIRI ================= */}
      <div style={{ width: '30%', backgroundColor: '#111b21', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', backgroundColor: '#202c33', borderBottom: '1px solid #333' }}>
          <h3 style={{ margin: 0 }}>PT Cipta Utama Karya CS</h3>
        </div>
        
        {/* Daftar Klien */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {contacts.length === 0 ? (
             <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Memuat kontak...</div>
          ) : (
             contacts.map(user => (
               <div 
                 key={user.openid} 
                 onClick={() => setActiveContact(user)}
                 style={{
                   padding: '15px 20px',
                   cursor: 'pointer',
                   borderBottom: '1px solid #202c33',
                   // Ubah warna background jika kontak ini sedang dipilih
                   backgroundColor: activeContact?.openid === user.openid ? '#2a3942' : 'transparent',
                   transition: 'background-color 0.2s'
                 }}
               >
                 <div style={{ fontWeight: 'bold' }}>{user.nickname}</div>
                 <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                    ID: {user.openid.substring(0,8)}...
                 </div>
               </div>
             ))
          )}
        </div>
      </div>

      {/* ================= AREA CHAT KANAN ================= */}
      <div style={{ width: '70%', display: 'flex', flexDirection: 'column', backgroundColor: '#efeae2' }}>
        
        {/* Header Chat */}
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', borderBottom: '1px solid #ccc' }}>
          <h3 style={{ margin: 0, color: '#111b21' }}>
            {activeContact ? activeContact.nickname : 'Pilih klien untuk memulai obrolan'}
          </h3>
        </div>

        {/* Balon Chat */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!activeContact ? (
            <div style={{ margin: 'auto', backgroundColor: 'white', padding: '10px 20px', borderRadius: '20px', color: '#555', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
               Silakan pilih kontak di daftar sebelah kiri.
            </div>
          ) : filteredMessages.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888' }}>Belum ada riwayat pesan dengan klien ini.</p>
          ) : (
            filteredMessages.map((chat) => (
              <div 
                key={chat.id} 
                style={{ 
                  alignSelf: chat.isFromClient ? 'flex-start' : 'flex-end', 
                  backgroundColor: chat.isFromClient ? 'white' : '#dcf8c6', 
                  padding: '10px 15px', 
                  borderRadius: '10px', 
                  maxWidth: '60%',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '5px' }}>
                  {chat.isFromClient ? activeContact.nickname : 'Radianda Sandbox Acc'}
                </div>
                {chat.messageContent}
              </div>
            ))
          )}
        </div>

        {/* Kolom Ketik Pesan */}
        <div style={{ padding: '15px', backgroundColor: '#f0f2f5', display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            disabled={!activeContact} // Matikan input jika belum pilih orang
            placeholder={activeContact ? "Ketik balasan..." : "Pilih klien terlebih dahulu..."} 
            style={{ flex: 1, padding: '12px 20px', borderRadius: '20px', border: 'none', outline: 'none', fontSize: '1rem' }}
            onKeyDown={(e) => {
               if (e.key === 'Enter') handleKirim(); // Bisa kirim pakai tombol Enter
            }}
          />
          <button 
            onClick={handleKirim}
            disabled={!activeContact}
            style={{ 
              padding: '10px 25px', 
              backgroundColor: activeContact ? '#128C7E' : '#ccc', 
              color: 'white', 
              border: 'none', 
              borderRadius: '20px', 
              cursor: activeContact ? 'pointer' : 'not-allowed', 
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}>
            Kirim
          </button>
        </div>
      </div>
      
    </div>
  );
}