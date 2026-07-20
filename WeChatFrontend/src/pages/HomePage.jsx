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
    axios.get(API_URL_USERS)
      .then(res => setContacts(res.data))
      .catch(err => console.error("Gagal menarik kontak:", err));
      
    fetchMessages();

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    connection.on("ReceiveNewMessage", () => {
      console.log("Sinyal masuk: Ada pesan baru! Me-refresh layar otomatis...");
      fetchMessages(); 
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
  // Di HP: Tampilkan sidebar JIKA belum ada kontak yang dipilih
  const showSidebar = !isMobile || !activeContact;
  // Di HP: Tampilkan ruang chat JIKA sudah ada kontak yang dipilih
  const showChatRoom = !isMobile || activeContact;

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
          {/* Tombol KEMBALI khusus untuk versi Mobile */}
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

        {/* Balon Chat */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!activeContact ? (
            <div style={{ margin: 'auto', backgroundColor: 'white', padding: '10px 20px', borderRadius: '20px', color: '#555', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', textAlign: 'center' }}>
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
                  maxWidth: isMobile ? '85%' : '60%', // Balon chat lebih lebar di HP
                  boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '5px' }}>
                  {chat.isFromClient ? activeContact.nickname : 'Admin'}
                </div>
                {chat.messageContent}
              </div>
            ))
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