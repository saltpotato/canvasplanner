using canvasplanner.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using System.Linq;
namespace canvasplanner.Service;

public class DiagramStorageService
{
    private readonly DiagramDbContext _db;

    public DiagramStorageService(DiagramDbContext db)
    {
        _db = db;
    }

    public async Task<int> SaveAsync(string label, List<Block> blocks, List<Link> links, int? id = null)
    {
        var payload = JsonSerializer.Serialize(new { blocks, links });

        DiagramState entry;
        if (id.HasValue)
        {
            entry = await _db.Diagrams.FindAsync(id.Value) ?? new DiagramState();
        }
        else
        {
            entry = new DiagramState();
        }

        if (entry.Id == 0)
        {
            _db.Diagrams.Add(entry);
        }

        entry.Label = label;
        entry.Json = payload;
        entry.SavedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return entry.Id;
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

        var obj = JsonSerializer.Deserialize<DiagramPayload>(item.Json) ?? new DiagramPayload();

        var loadedBlocks = (obj.blocks ?? new())
            .Select(b => new Block(
                b.Id,
                b.X,
                b.Y,
                b.Text,
                string.IsNullOrWhiteSpace(b.Command) ? "" : b.Command,
                b.UseSearch))
            .ToList();

        var loadedLinks = obj.links ?? new();
        // normalize defaults for legacy diagrams
        loadedLinks = loadedLinks
            .Select(l => new Link(
                l.From,
                l.To,
                string.IsNullOrWhiteSpace(l.FromSide) ? "right" : l.FromSide,
                string.IsNullOrWhiteSpace(l.ToSide) ? "left" : l.ToSide,
                string.IsNullOrWhiteSpace(l.Direction) ? "forward" : l.Direction,
                string.IsNullOrWhiteSpace(l.Kind) ? "arrow" : l.Kind))
            .ToList();

        return (loadedBlocks, loadedLinks);
    }

    record DiagramPayload
    {
        public List<Block>? blocks { get; set; }
        public List<Link>? links { get; set; }
    }
}
