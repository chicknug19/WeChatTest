using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using WeChatBackend.Models;
using System.Text.Json;
using System.Net.Http;

namespace WeChatBackend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WeChatController : ControllerBase
    {
        private readonly AppDbContext _context;
        // Gunakan token yang persis sama dengan di Sandbox WeChat
        private const string WECHAT_TOKEN = "token_sandbox_radi";

        // Inject AppDbContext agar bisa akses database
        public WeChatController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("webhook")]
        public IActionResult VerifyUrl(
            [FromQuery] string? signature,
            [FromQuery] string? timestamp,
            [FromQuery] string? nonce,
            [FromQuery] string? echostr)
        {
            // Jika ada parameter yang kosong, langsung tolak
            if (string.IsNullOrEmpty(signature) || string.IsNullOrEmpty(timestamp) || string.IsNullOrEmpty(nonce))
            {
                return Unauthorized("Verifikasi Gagal: Parameter tidak lengkap");
            }

            // Urutkan array token, timestamp, nonce
            string[] tmpArr = { WECHAT_TOKEN, timestamp, nonce };
            Array.Sort(tmpArr);
            string tmpStr = string.Join("", tmpArr);

            using (SHA1 sha1 = SHA1.Create())
            {
                byte[] hashBytes = sha1.ComputeHash(Encoding.UTF8.GetBytes(tmpStr));
                string hashStr = BitConverter.ToString(hashBytes).Replace("-", "").ToLower();

                if (hashStr == signature)
                {
                    return Content(echostr ?? "", "text/plain");
                }
            }

            // Ganti Forbid() menjadi ini
            return Unauthorized("Verifikasi Gagal: Signature tidak cocok");
        }

        // ==========================================
        // 2. POST: MENERIMA & MENYIMPAN PESAN (SILENT LISTENER)
        // ==========================================
        [HttpPost("webhook")]
        public async Task<IActionResult> ReceiveMessage()
        {
            // Baca raw XML dari body request
            using StreamReader reader = new StreamReader(Request.Body, Encoding.UTF8);
            string xmlStr = await reader.ReadToEndAsync();

            if (string.IsNullOrEmpty(xmlStr))
                return Ok("success");

            // Parsing XML
            XDocument doc = XDocument.Parse(xmlStr);
            string msgType = doc.Root.Element("MsgType")?.Value;

            if (msgType == "text")
            {
                string fromUser = doc.Root.Element("FromUserName")?.Value; // OpenID Client
                string content = doc.Root.Element("Content")?.Value;

                // Simpan ke Database (Tabel ChatMessages)
                var newMessage = new ChatMessage
                {
                    OpenId = fromUser,
                    MessageContent = content,
                    IsFromClient = true, // Karena ini pesan masuk, berarti dari Client
                    CreatedAt = DateTime.Now
                };

                _context.ChatMessages.Add(newMessage);
                await _context.SaveChangesAsync();

                // Print ke console (opsional, untuk memastikan data masuk)
                Console.WriteLine($"[DB SAVED] Klien {fromUser} bilang: {content}");
            }

            // Selalu kembalikan "success" agar WeChat tahu kita sudah menerima pesannya
            return Content("success", "text/plain");
        }


        // ==========================================
        // 3. GET: MENGAMBIL RIWAYAT CHAT UNTUK REACT
        // ==========================================
        [HttpGet("messages")]
        public IActionResult GetMessages()
        {
            // Mengambil semua pesan dari database, diurutkan dari yang terlama ke terbaru
            var messages = _context.ChatMessages
                                   .OrderBy(m => m.CreatedAt)
                                   .ToList();

            return Ok(messages);
        }


        // ==========================================
        // 4. POST: MENGIRIM PESAN DARI ADMIN KE KLIEN
        // ==========================================
        public class SendMessageDto
        {
            public string OpenId { get; set; }
            public string Content { get; set; }
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendMessageToClient([FromBody] SendMessageDto request)
        {
            try
            {
                // LANGKAH A: Simpan riwayat chat Admin ke Database SQL Server
                var adminMessage = new ChatMessage
                {
                    OpenId = request.OpenId,
                    MessageContent = request.Content,
                    IsFromClient = false,
                    CreatedAt = DateTime.Now
                };
                _context.ChatMessages.Add(adminMessage);
                await _context.SaveChangesAsync();

                // LANGKAH B: Tarik Access Token dari WeChat
                // Menggunakan kredensial Sandbox yang sudah kamu berikan sebelumnya
                string appId = "wx314e2871cd0011bb";
                string appSecret = "7a2683215908c98da4214bda90baf4dc";

                using var httpClient = new HttpClient();
                string tokenUrl = $"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={appId}&secret={appSecret}";

                var tokenResponse = await httpClient.GetAsync(tokenUrl);
                string tokenJson = await tokenResponse.Content.ReadAsStringAsync();

                // Membedah JSON response untuk mengambil nilai "access_token"
                using JsonDocument doc = JsonDocument.Parse(tokenJson);
                if (!doc.RootElement.TryGetProperty("access_token", out JsonElement tokenElement))
                {
                    return StatusCode(500, "Gagal mendapatkan Access Token dari WeChat: " + tokenJson);
                }
                string accessToken = tokenElement.GetString();

                // LANGKAH C: Tembak API Custom Send WeChat
                string sendUrl = $"https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token={accessToken}";

                // Susun payload/body sesuai dokumentasi WeChat API
                var payload = new
                {
                    touser = request.OpenId,
                    msgtype = "text",
                    text = new { content = request.Content }
                };

                string payloadJson = JsonSerializer.Serialize(payload);
                var httpContent = new StringContent(payloadJson, Encoding.UTF8, "application/json");

                // Eksekusi POST request ke WeChat
                var sendResponse = await httpClient.PostAsync(sendUrl, httpContent);
                string sendResult = await sendResponse.Content.ReadAsStringAsync();

                return Ok(new { status = "Sukses", wechat_response = sendResult });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Terjadi kesalahan internal: {ex.Message}");
            }
        }


        // ==========================================
        // 5. GET: MENGAMBIL DAFTAR KLIEN (OPEN ID)
        // ==========================================
        [HttpGet("users")]
        public async Task<IActionResult> GetFollowers()
        {
            try
            {
                string appId = "wx314e2871cd0011bb";
                string appSecret = "7a2683215908c98da4214bda90baf4dc";

                using var httpClient = new HttpClient();

                // 1. Ambil Token
                string tokenUrl = $"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={appId}&secret={appSecret}";
                var tokenRes = await httpClient.GetStringAsync(tokenUrl);
                string token = JsonDocument.Parse(tokenRes).RootElement.GetProperty("access_token").GetString();

                // 2. Ambil List OpenID
                string listUrl = $"https://api.weixin.qq.com/cgi-bin/user/get?access_token={token}";
                var listRes = await httpClient.GetStringAsync(listUrl);
                var openIds = JsonDocument.Parse(listRes).RootElement.GetProperty("data").GetProperty("openid");

                // 3. Loop untuk ambil Nickname setiap orang
                // 3. Loop untuk ambil Nickname setiap orang
                var userList = new List<object>();
                foreach (var id in openIds.EnumerateArray())
                {
                    string openId = id.GetString();
                    string infoUrl = $"https://api.weixin.qq.com/cgi-bin/user/info?access_token={token}&openid={openId}&lang=en";
                    var infoRes = await httpClient.GetStringAsync(infoUrl);
                    var infoDoc = JsonDocument.Parse(infoRes).RootElement;

                    // Ambil property nickname dari JSON
                    string nickname = "";
                    if (infoDoc.TryGetProperty("nickname", out var nick))
                    {
                        nickname = nick.GetString();
                    }

                    // Jika WeChat mengembalikan string kosong (aturan privasi API baru)
                    if (string.IsNullOrWhiteSpace(nickname))
                    {
                        // Buat nama fallback yang rapi (misal: "Klien ovXyq2")
                        nickname = "Klien " + openId.Substring(0, 9);
                    }

                    userList.Add(new
                    {
                        openid = openId,
                        nickname = nickname
                    });
                }
                return Ok(userList);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

    }
}