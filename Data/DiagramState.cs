namespace canvasplanner.Data
{
    public class DiagramState
    {
        public int Id { get; set; }
        public string Label { get; set; } = "";
        public string Json { get; set; } = "";     // serialized blocks + links
        public DateTime SavedAt { get; set; }
    }
    public record Block(
    string Id,     // unique identifier: "node1", "node2", ...
    double X,      // position on canvas
    double Y,
    string Text    // display label
);

    public record Link(
        string From,   // source node ID
        string To      // destination node ID
    );
}
