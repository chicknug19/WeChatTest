import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

export default function HomePage() {
  const [pesan, setPesan] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const messagesEndRef = useRef(null);

  // URL Backend Azure
  const BASE_URL = "https://wechatbackend-gvcyhxbua7f6cqey.southeastasia-01.azurewebsites.net";
  const API_URL_MESSAGES = `${BASE_URL}/api/WeChat/messages`;
  const API_URL_USERS = `${BASE_URL}/api/WeChat/users`;
  const API_URL_SEND = `${BASE_URL}/api/WeChat/send`;
  const API_URL_MARKREAD = `${BASE_URL}/api/WeChat/markread`;
  const HUB_URL = `${BASE_URL}/chathub`;

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
      fetchMessages(); 
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
          new Notification("Pesan Baru", { body: "Ada pesan baru masuk dari klien." });
      }
    });

    connection.start().catch(err => console.error("SignalR Error: ", err));

    return () => connection.stop();
  }, []);

  // Filter pesan untuk ruang chat yang sedang terbuka
  const filteredMessages = chatHistory.filter(m => 
    activeContact ? m.openId === activeContact.openid : false
  );

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredMessages]);

  const handleKirim = async () => {
    if (!pesan.trim() || !activeContact) return;

    try {
      await axios.post(API_URL_SEND, {
        openId: activeContact.openid, 
        content: pesan
      });
      setPesan(""); 
      fetchMessages(); // Refresh chat setelah kirim
    } catch (error) {
      console.error("Gagal mengirim pesan:", error);
    }
  };

  // Saat chat diklik: buka chat, ubah status pesan jadi "Read" secara lokal dan di Database
  const handleContactClick = async (user) => {
    setActiveContact(user);
    
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    // Ubah state lokal secara instan agar lencana hijau langsung hilang
    setChatHistory(prev => prev.map(msg => 
      (msg.openId === user.openid && msg.isFromClient && !msg.isRead)
        ? { ...msg, isRead: true }
        : msg
    ));

    // Tembak API untuk mengubah status IsRead di Database Azure
    try {
      await axios.post(API_URL_MARKREAD, { openId: user.openid });
    } catch (err) {
      console.error("Gagal update status read:", err);
    }
  };

  // --- LOGIKA TAMPILAN & FORMAT WAKTU ---
  const showSidebar = !isMobile || !activeContact;
  const showChatRoom = !isMobile || activeContact;

  const formatDateSeparator = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((today - dateOnly) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hari ini";
    if (diffDays === 1) return "Kemarin";
    if (diffDays < 7 && diffDays > 1) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[date.getDay()];
    }
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // Hitung jumlah Unread dari database (isFromClient = true & isRead = false)
  const unreadCounts = {};
  chatHistory.forEach(msg => {
     if (msg.isFromClient && !msg.isRead) {
         unreadCounts[msg.openId] = (unreadCounts[msg.openId] || 0) + 1;
     }
  });

  // Urutkan sidebar kontak
  const sidebarContacts = contacts.map(contact => {
     const contactMsgs = chatHistory.filter(m => m.openId === contact.openid);
     const latestMsg = contactMsgs.length > 0 ? contactMsgs[contactMsgs.length - 1] : null;
     return { ...contact, latestMsg };
  }).sort((a, b) => {
     if (!a.latestMsg) return 1;
     if (!b.latestMsg) return -1;
     return new Date(b.latestMsg.createdAt) - new Date(a.latestMsg.createdAt);
  });

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', fontFamily: 'Segoe UI, sans-serif', overflow: 'hidden' }}>
      
      {/* ================= SIDEBAR KIRI ================= */}
      <div style={{ 
        width: isMobile ? '100%' : '35%', 
        backgroundColor: '#111b21', 
        color: '#e9edef', 
        display: showSidebar ? 'flex' : 'none', 
        flexDirection: 'column',
        borderRight: '1px solid #222d34'
      }}>
        <div style={{ padding: '15px 20px', backgroundColor: '#202c33', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Chats</h3>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarContacts.length === 0 ? (
             <div style={{ padding: '20px', textAlign: 'center', color: '#8696a0' }}>Memuat kontak...</div>
          ) : (
             sidebarContacts.map(user => {
               const unreadCount = unreadCounts[user.openid] || 0;
               const isActive = activeContact?.openid === user.openid;
               const lastMsgContent = user.latestMsg ? user.latestMsg.messageContent : "Belum ada pesan";
               const lastMsgTime = user.latestMsg ? formatTime(user.latestMsg.createdAt) : "";

               return (
                 <div 
                   key={user.openid} 
                   onClick={() => handleContactClick(user)}
                   style={{
                     padding: '12px 20px',
                     cursor: 'pointer',
                     display: 'flex',
                     alignItems: 'center',
                     backgroundColor: isActive ? '#2a3942' : 'transparent',
                     transition: 'background-color 0.2s',
                     borderBottom: '1px solid #222d34'
                   }}
                 >
                   <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#6b7c85', marginRight: '15px', flexShrink: 0 }} />
                   
                   <div style={{ flex: 1, overflow: 'hidden' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontWeight: '500', fontSize: '1.05rem' }}>{user.nickname}</span>
                        <span style={{ fontSize: '0.75rem', color: unreadCount > 0 ? '#00a884' : '#8696a0' }}>
                           {lastMsgTime}
                        </span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#8696a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lastMsgContent}
                        </span>
                        
                        {unreadCount > 0 && (
                          <div style={{ backgroundColor: '#00a884', color: '#111b21', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', minWidth: '20px', textAlign: 'center' }}>
                            {unreadCount}
                          </div>
                        )}
                     </div>
                   </div>
                 </div>
               );
             })
          )}
        </div>
      </div>

      {/* ================= AREA CHAT KANAN ================= */}
      <div style={{ 
        width: isMobile ? '100%' : '65%', 
        display: showChatRoom ? 'flex' : 'none', 
        flexDirection: 'column', 
        backgroundColor: '#efeae2',
        backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
        backgroundSize: 'cover'
      }}>
        
        <div style={{ padding: '10px 20px', backgroundColor: '#f0f2f5', display: 'flex', alignItems: 'center', borderBottom: '1px solid #d1d7db' }}>
          {isMobile && (
            <button onClick={() => setActiveContact(null)} style={{ marginRight: '15px', border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
              ⬅
            </button>
          )}
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#6b7c85', marginRight: '15px' }} />
          <h3 style={{ margin: 0, color: '#111b21', fontSize: '1.1rem', fontWeight: '500' }}>
            {activeContact ? activeContact.nickname : ''}
          </h3>
        </div>

        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!activeContact ? (
            <div style={{ margin: 'auto', backgroundColor: '#fff', padding: '10px 20px', borderRadius: '20px', color: '#54656f', fontSize: '0.9rem', boxShadow: '0 1px 1px rgba(11,20,26,.05)' }}>
               Silakan pilih kontak untuk memulai obrolan
            </div>
          ) : filteredMessages.length === 0 ? (
            <div style={{ margin: 'auto', backgroundColor: '#fff', padding: '10px 20px', borderRadius: '20px', color: '#54656f', fontSize: '0.9rem' }}>
               Kirim pesan pertama ke klien ini.
            </div>
          ) : (
            filteredMessages.map((chat, index) => {
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

              const isClient = chat.isFromClient;

              return (
                <div key={chat.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  
                  {showSeparator && (
                    <div style={{ 
                      alignSelf: 'center', 
                      backgroundColor: '#fff', 
                      color: '#54656f', 
                      padding: '5px 12px', 
                      borderRadius: '10px', 
                      fontSize: '0.75rem', 
                      margin: '12px 0',
                      boxShadow: '0 1px 1px rgba(11,20,26,.05)'
                    }}>
                      {formatDateSeparator(chat.createdAt)}
                    </div>
                  )}

                  <div style={{ 
                    alignSelf: isClient ? 'flex-start' : 'flex-end', 
                    backgroundColor: isClient ? '#fff' : '#d9fdd3', 
                    padding: '6px 7px 8px 9px', 
                    borderRadius: '7.5px', 
                    maxWidth: isMobile ? '85%' : '65%',
                    boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: '80px',
                    position: 'relative'
                  }}>
                    <div style={{ wordBreak: 'break-word', fontSize: '0.9rem', color: '#111b21', paddingRight: '40px' }}>
                      {chat.messageContent}
                    </div>

                    <div style={{ fontSize: '0.68rem', color: '#667781', position: 'absolute', bottom: '4px', right: '7px', display: 'flex', alignItems: 'center' }}>
                      {formatTime(chat.createdAt)} 
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '10px 15px', backgroundColor: '#f0f2f5', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="text" 
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            disabled={!activeContact}
            placeholder="Type a message" 
            style={{ flex: 1, padding: '12px 20px', borderRadius: '8px', border: 'none', outline: 'none', fontSize: '0.95rem', color: '#111b21' }}
            onKeyDown={(e) => {
               if (e.key === 'Enter') handleKirim();
            }}
          />
          <button 
            onClick={handleKirim}
            disabled={!activeContact || !pesan.trim()}
            style={{ 
              background: 'none',
              border: 'none',
              color: pesan.trim() ? '#00a884' : '#8696a0',
              cursor: pesan.trim() ? 'pointer' : 'not-allowed',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
          </button>
        </div>
      </div>
      
    </div>
  );
}