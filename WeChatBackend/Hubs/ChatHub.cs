using Microsoft.AspNetCore.SignalR;

namespace WeChatBackend.Hubs
{
    // Hub adalah terminal WebSocket tempat React akan "menelepon"
    public class ChatHub : Hub
    {
        // Untuk saat ini, kelas ini bisa dibiarkan kosong.
        // Karena kita hanya akan "mendorong" data dari Controller ke React,
        // bukan sebaliknya.
    }
}