using Microsoft.EntityFrameworkCore;
using WeChatBackend.Models;

namespace WeChatBackend
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();
            builder.Services.AddSignalR();

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowSemua",
                    policy =>
                    {
                        policy.AllowAnyHeader()
                              .AllowAnyMethod()
                              .SetIsOriginAllowed(origin => true) // Menggantikan AllowAnyOrigin()
                              .AllowCredentials(); // Diwajibkan oleh SignalR
                    });
            });

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            app.UseCors("AllowSemua");

            app.UseAuthorization();

            app.MapControllers();
            app.MapHub<WeChatBackend.Hubs.ChatHub>("/chathub");

            app.Run();
        }
    }
}