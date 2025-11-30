using canvasplanner.Data;
using System.Text.Json;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
namespace canvasplanner.Service;
    public class DiagramStorageService
{
    private readonly DiagramDbContext _db;

    public DiagramStorageService(DiagramDbContext db)
    {
        _db = db;
    }

    public async Task SaveAsync(string label, List<Block> blocks, List<Link> links)
    {
        var payload = JsonSerializer.Serialize(new { blocks, links });

        var entry = new DiagramState
        {
            Label = label,
            Json = payload,
            SavedAt = DateTime.UtcNow
        };

        _db.Diagrams.Add(entry);
        await _db.SaveChangesAsync();
    }

    public async Task<List<(int Id, string Label)>> ListAllAsync()
    {
        return await _db.Diagrams
            .OrderByDescending(d => d.SavedAt)
            .Select(d => new ValueTuple<int, string>(d.Id, d.Label))
            .ToListAsync();
    }

    public async Task<(List<Block>, List<Link>)> LoadAsync(int id)
    {
        var item = await _db.Diagrams.FindAsync(id);
        if (item == null) return (new List<Block>(), new List<Link>());

        var obj = JsonSerializer.Deserialize<DiagramPayload>(item.Json);

        return (obj.blocks ?? new(), obj.links ?? new());
    }

    record DiagramPayload
    {
        public List<Block>? blocks { get; set; }
        public List<Link>? links { get; set; }
    }
}
