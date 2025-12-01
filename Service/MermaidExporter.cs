
using System.Text;
using System.Collections.Generic;
using canvasplanner.Data;

namespace canvasplanner.Service
{
    public static class MermaidExporter
    {
        public static string ToMermaid(
            IEnumerable<(string Id, double X, double Y, string Text)> blocksTuple,
            IEnumerable<(string From, string To)> linksTuple)
        {
            // In case you accidentally pass ValueTuples instead of Block/Link records.
            var blocks = new List<Block>();
            foreach (var b in blocksTuple)
                blocks.Add(new Block(b.Id, b.X, b.Y, b.Text, "", false, false));

            var links = new List<Link>();
            foreach (var l in linksTuple)
                links.Add(new Link(l.From, l.To));

            return ToMermaid2(blocks, links);
        }

        public static string ToMermaid2(
            IEnumerable<Block> blocks,
            IEnumerable<Link> links)
        {
            var sb = new StringBuilder();
            sb.AppendLine("flowchart TD");

            // Nodes (Mermaid syntax: id["Text"])
            foreach (var b in blocks)
            {
                sb.AppendLine($"    {b.Id}[\"{Escape(b.Text)}\"]");
            }

            // Links (Mermaid syntax: from --> to)
            foreach (var l in links)
            {
                var label = l.Kind == "arrow" ? "" : $"|{l.Kind}|";
                var line = l.Direction switch
                {
                    "backward" => $"{l.From} <--{label}-- {l.To}",
                    "both" => $"{l.From} <--{label}--> {l.To}",
                    "none" => $"{l.From} ---{label}--- {l.To}",
                    _ => $"{l.From} --{label}--> {l.To}"
                };

                sb.AppendLine($"    {line}");
            }

            return sb.ToString();
        }

        private static string Escape(string text)
        {
            if (string.IsNullOrEmpty(text))
                return "";

            return text
                .Replace("\"", "\\\"")
                .Replace("\n", "\\n");
        }
    }
}
