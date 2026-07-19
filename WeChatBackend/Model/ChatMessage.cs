using System;

namespace WeChatBackend.Models
{
    public class ChatMessage
    {
        public Guid Id { get; set; }
        public string OpenId { get; set; }
        public string MessageContent { get; set; }
        public bool IsFromClient { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}