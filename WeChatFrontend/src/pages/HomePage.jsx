import { useState, useEffect } from 'react';
import axios from 'axios';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

export default function HomePage() {
  const [pesan, setPesan] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  
  // State untuk mendeteksi apakah layar berukuran HP (mobile)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // URL Backend Azure
  const BASE_URL = "https://wechatbackend-gvcyhxbua7f6cqey.southeastasia-01.azurewebsites.net";
  const API_URL_MESSAGES = `${BASE_URL}/api/WeChat/messages`;
  const API_URL_USERS = `${BASE_URL}/api/WeChat/users`;
  const API_URL_SEND = `${BASE_URL}/api/WeChat/send`;
  const HUB_URL = `${BASE_URL}/chathub`;

  // Deteksi perubahan ukuran layar (Resize Listener)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await axios.get(API_URL_MESSAGES);
      setChatHistory(response.data);
    } catch (error) {
      console.error("Gagal menarik data chat:", error);
    }
  };

  useEffect(() => {
    // 1. Minta Izin Notifikasi Desktop ke Browser
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    axios.get(API_URL_USERS)
      .then(res => setContacts(res.data))
      .catch(err => console.error("Gagal menarik kontak:", err));
      
    fetchMessages();

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    // 2. Tampilkan Notifikasi saat SignalR menerima pesan
    connection.on("ReceiveNewMessage", () => {
      console.log("Sinyal masuk: Ada pesan baru!");
      fetchMessages(); 
      
      // Trigger Notifikasi Windows/Mac jika diizinkan
      if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Pesan WeChat Baru", {
              body: "Ada pesan baru masuk dari klien. Cek sekarang!",
          });
      }
    });

    connection.start()
      .then(() => console.log("WebSocket/SignalR Connected!"))
      .catch(err => console.error("SignalR Connection Error: ", err));

    return () => {
      connection.stop();
    };
  }, []);

  const filteredMessages = chatHistory.filter(m => 
    activeContact ? m.openId === activeContact.openid : false
  );

  const handleKirim = async () => {
    if (!pesan.trim()) return;
    if (!activeContact) {
        alert("Pilih klien di sebelah kiri terlebih dahulu!");
        return;
    }

    try {
      await axios.post(API_URL_SEND, {
        openId: activeContact.openid, 
        content: pesan
      });
      setPesan(""); 
    } catch (error) {
      console.error("Gagal mengirim pesan:", error);
    }
  };

  // --- LOGIKA TAMPILAN ---
  const showSidebar = !isMobile || !activeContact;
  const showChatRoom = !isMobile || activeContact;

  // --- FUNGSI FORMAT WAKTU ---
  const formatDateSeparator = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    
    // Setel jam ke 00:00:00 untuk perbandingan murni hari
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = today - dateOnly;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hari ini";
    if (diffDays === 1) return "Kemarin";
    if (diffDays < 7 && diffDays > 1) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[date.getDay()];
    }
    
    // Jika lebih dari 7 hari, tampilkan tanggal lengkap
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* ================= SIDEBAR KIRI ================= */}
      <div style={{ 
        width: isMobile ? '100%' : '30%', 
        backgroundColor: '#111b21', 
        color: 'white', 
        display: showSidebar ? 'flex' : 'none', 
        flexDirection: 'column' 
      }}>
        <div style={{ padding: '20px', backgroundColor: '#202c33', borderBottom: '1px solid #333' }}>
          <h3 style={{ margin: 0 }}>WeChat Test</h3>
        </div>
        
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
      <div style={{ 
        width: isMobile ? '100%' : '70%', 
        display: showChatRoom ? 'flex' : 'none', 
        flexDirection: 'column', 
        backgroundColor: '#efeae2' 
      }}>
        
        {/* Header Chat */}
        <div style={{ padding: '15px 20px', backgroundColor: '#f0f2f5', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
          {isMobile && activeContact && (
            <button 
              onClick={() => setActiveContact(null)}
              style={{ marginRight: '15px', padding: '8px 12px', border: 'none', backgroundColor: '#e0e0e0', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ⬅ Kembali
            </button>
          )}
          <h3 style={{ margin: 0, color: '#111b21', fontSize: isMobile ? '1.1rem' : '1.17em' }}>
            {activeContact ? activeContact.nickname : 'Pilih klien untuk memulai obrolan'}
          </h3>
        </div>

        {/* Balon Chat & Pemisah Tanggal */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!activeContact ? (
            <div style={{ margin: 'auto', backgroundColor: 'white', padding: '10px 20px', borderRadius: '20px', color: '#555', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', textAlign: 'center' }}>
               Silakan pilih kontak di daftar sebelah kiri.
            </div>
          ) : filteredMessages.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888' }}>Belum ada riwayat pesan dengan klien ini.</p>
          ) : (
            filteredMessages.map((chat, index) => {
              
              // Logika penentu apakah harus memunculkan pemisah tanggal
              let showSeparator = false;
              if (index === 0) {
                  showSeparator = true;
              } else {
                  const prevChatDate = new Date(filteredMessages[index - 1].createdAt).toDateString();
                  const currentChatDate = new Date(chat.createdAt).toDateString();
                  if (prevChatDate !== currentChatDate) {
                      showSeparator = true;
                  }
              }

              return (
                <div key={chat.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  
                  {/* DIV PEMISAH TANGGAL (Tengah Layar) */}
                  {showSeparator && (
                    <div style={{ 
                      alignSelf: 'center', 
                      backgroundColor: '#e1f2fb', 
                      color: '#555', 
                      padding: '5px 12px', 
                      borderRadius: '8px', 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold',
                      margin: '15px 0 10px 0',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.05)'
                    }}>
                      {formatDateSeparator(chat.createdAt)}
                    </div>
                  )}

                  {/* DIV BALON CHAT UTAMA */}
                  <div style={{ 
                    alignSelf: chat.isFromClient ? 'flex-start' : 'flex-end', 
                    backgroundColor: chat.isFromClient ? 'white' : '#dcf8c6', 
                    padding: '8px 12px', 
                    borderRadius: '10px', 
                    maxWidth: isMobile ? '85%' : '60%',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: '120px' 
                  }}>
                    {/* Nama Pengirim */}
                    <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px', fontWeight: 'bold' }}>
                      {chat.isFromClient ? activeContact.nickname : 'Admin'}
                    </div>
                    
                    {/* Isi Pesan */}
                    <div style={{ wordBreak: 'break-word', fontSize: '0.95rem' }}>
                      {chat.messageContent}
                    </div>

                    {/* Waktu Spesifik Pesan (Jam Saja) */}
                    <div style={{ fontSize: '0.7rem', color: '#999', alignSelf: 'flex-end', marginTop: '4px' }}>
                      {formatTime(chat.createdAt)} 
                    </div>
                  </div>
                  
                </div>
              );
            })
          )}
        </div>

        {/* Kolom Ketik Pesan */}
        <div style={{ padding: '10px 15px', backgroundColor: '#f0f2f5', display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            disabled={!activeContact}
            placeholder={activeContact ? "Ketik pesan..." : "Pilih klien..."} 
            style={{ flex: 1, padding: '12px', borderRadius: '20px', border: 'none', outline: 'none', fontSize: '1rem' }}
            onKeyDown={(e) => {
               if (e.key === 'Enter') handleKirim();
            }}
          />
          <button 
            onClick={handleKirim}
            disabled={!activeContact}
            style={{ 
              padding: '10px 20px', 
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