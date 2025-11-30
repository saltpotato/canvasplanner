using System.Net.Http.Json;
using System.Text.Json;
using System.Collections.Generic;
using System.Linq;

namespace canvasplanner.Service;

public class LlmService
{
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly ILogger<LlmService> _logger;

    public LlmService(IHttpClientFactory http, IConfiguration config, ILogger<LlmService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<string> ExecuteAsync(string prompt, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(prompt))
            return "No prompt provided.";

        var useSearch = ShouldSearch(prompt);
        var llm = await CallOllamaAsync(prompt, ct, useSearch);
        return llm ?? "LLM call failed. Check that Ollama is running and the API endpoint is reachable.";
    }

    private bool ShouldSearch(string prompt)
    {
        var p = prompt.ToLowerInvariant();
        string[] cues = new[]
        {
            "search", "google", "lookup", "look up", "find info", "find information",
            "research", "web", "internet", "latest", "current"
        };
        return cues.Any(c => p.Contains(c));
    }

    private async Task<string?> CallOllamaAsync(string prompt, CancellationToken ct, bool enableSearch = false)
    {
        var baseUrl = _config["Ollama:BaseUrl"] ?? "http://localhost:11434";
        var model = _config["Ollama:Model"] ?? "llama3";

        try
        {
            var client = _http.CreateClient("ollama");
            if (!client.BaseAddress?.AbsoluteUri.StartsWith("http", StringComparison.OrdinalIgnoreCase) ?? true)
            {
                client.BaseAddress = new Uri(baseUrl);
            }

            var payload = new Dictionary<string, object?>
            {
                ["model"] = model,
                ["prompt"] = prompt,
                ["stream"] = false
            };

            if (enableSearch)
            {
                payload["options"] = new Dictionary<string, object?> { ["search"] = true };
            }

            var response = await client.PostAsJsonAsync("/api/generate", payload, cancellationToken: ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                var message = $"Ollama call failed with {response.StatusCode}. {body}";
                _logger.LogWarning(message);
                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return $"{message}. Verify Ollama is running at {client.BaseAddress} and supports the /api/generate endpoint (upgrade if needed for search).";
                }
                return message;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            if (json.TryGetProperty("response", out var respProp))
            {
                return respProp.GetString() ?? "";
            }
            return "Ollama returned an unexpected payload.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ollama call failed");
        }

        return null;
    }
}

file static class JsonElementExtensions
{
    public static string GetPropertyOrDefault(this JsonElement element, string name, string fallback = "")
    {
        return element.TryGetProperty(name, out var prop) ? prop.GetString() ?? fallback : fallback;
    }
}
