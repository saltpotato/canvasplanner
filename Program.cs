using canvasplanner.Data;
using canvasplanner.Service;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Data.Sqlite; // Fix: Hinzufügen des erforderlichen using-Statements für UseSqlite
using Microsoft.EntityFrameworkCore;
using SQLitePCL;

var builder = WebApplication.CreateBuilder(args);
Batteries.Init();
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

builder.Services.AddDbContext<DiagramDbContext>(o =>
    o.UseSqlite("Data Source=diagrams.db"));  // or SQL Server
builder.Services.AddScoped<DiagramStorageService>();
var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DiagramDbContext>();
    db.Database.EnsureCreated();   // AUTO-CREATE TABLES
}


if (!app.Environment.IsDevelopment())
{
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();
