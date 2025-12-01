namespace canvasplanner.Data;

public class BlockExecution
{
    public int Id { get; set; }
    public int? DiagramId { get; set; }
    public string BlockId { get; set; } = "";
    public string BlockText { get; set; } = "";
    public string Command { get; set; } = "";
    public string Prompt { get; set; } = "";
    public string Output { get; set; } = "";
    public string ChunkedOutput { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
