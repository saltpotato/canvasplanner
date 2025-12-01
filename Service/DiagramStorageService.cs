using canvasplanner.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using System.Linq;
namespace canvasplanner.Service;

public class DiagramStorageService
{
    private readonly DiagramDbContext _db;
    private static bool _executionTableReady;

    public DiagramStorageService(DiagramDbContext db)
    {
        _db = db;
        EnsureExecutionTable();
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

    public async Task<int> LogBlockExecutionAsync(
        int? diagramId,
        string blockId,
        string blockText,
        string command,
        string prompt,
        string output,
        List<string> chunks)
    {
        EnsureExecutionTable();

        var execution = new BlockExecution
        {
            DiagramId = diagramId,
            BlockId = blockId,
            BlockText = blockText,
            Command = command,
            Prompt = prompt,
            Output = output,
            ChunkedOutput = JsonSerializer.Serialize(chunks),
            CreatedAt = DateTime.UtcNow
        };

        _db.BlockExecutions.Add(execution);
        await _db.SaveChangesAsync();
        return execution.Id;
    }

    public async Task<bool> DeleteDiagramAsync(int id)
    {
        var existing = await _db.Diagrams.FindAsync(id);
        if (existing == null) return false;

        _db.Diagrams.Remove(existing);

        // best-effort cleanup of executions
        try
        {
            var execs = _db.BlockExecutions.Where(e => e.DiagramId == id);
            _db.BlockExecutions.RemoveRange(execs);
        }
        catch
        {
            // non-fatal
        }

        await _db.SaveChangesAsync();
        return true;
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
                b.UseSearch,
                b.ChunkWithLlm))
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

    private void EnsureExecutionTable()
    {
        if (_executionTableReady) return;

        try
        {
            _db.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS BlockExecutions (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    DiagramId INTEGER NULL,
                    BlockId TEXT NOT NULL,
                    BlockText TEXT NOT NULL,
                    Command TEXT NOT NULL,
                    Prompt TEXT NOT NULL,
                    Output TEXT NOT NULL,
                    ChunkedOutput TEXT NOT NULL,
                    CreatedAt TEXT NOT NULL,
                    FOREIGN KEY (DiagramId) REFERENCES Diagrams(Id)
                );
            ");

            _executionTableReady = true;
        }
        catch
        {
            // Let callers proceed; failures will surface on insert and be logged by EF.
        }
    }
}
