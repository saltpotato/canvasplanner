using System.Net.Http.Json;
using System.Text.Json;
using System.Collections.Generic;
using System.Linq;
using System.IO;

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

    public async Task<string> ExecuteAsync(string prompt, bool useSearch, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(prompt))
            return "No prompt provided.";

        string fullPrompt = prompt;
        if (useSearch)
        {
            var searchContext = await WebSearchAsync(prompt, ct);
            if (!string.IsNullOrWhiteSpace(searchContext))
            {
                fullPrompt = $"{prompt}\n\nWeb search context:\n{searchContext}\n\nUse the context above only if it helps; keep the answer concise.";
            }
        }

        var llm = await CallOllamaAsync(fullPrompt, ct);
        return llm ?? "LLM call failed. Check that Ollama is running and the API endpoint is reachable.";
    }

    private async Task<string?> CallOllamaAsync(string prompt, CancellationToken ct)
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

    private async Task<string> WebSearchAsync(string query, CancellationToken ct)
    {
        var apiKey = GetApiKey();
        if (string.IsNullOrWhiteSpace(apiKey))
            return "";

        try
        {
            var client = _http.CreateClient("ollama-websearch");
            var request = new HttpRequestMessage(HttpMethod.Post, "https://ollama.com/api/web_search");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = JsonContent.Create(new { query });

            var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Web search failed with {Status}: {Body}", response.StatusCode, body);
                return "";
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            if (!json.TryGetProperty("results", out var results) || results.ValueKind != JsonValueKind.Array)
                return "";

            var lines = new List<string>();
            foreach (var item in results.EnumerateArray())
            {
                var title = item.GetPropertyOrDefault("title");
                var url = item.GetPropertyOrDefault("url");
                var desc = item.GetPropertyOrDefault("content");
                if (!string.IsNullOrWhiteSpace(title) || !string.IsNullOrWhiteSpace(desc))
                {
                    lines.Add($"{title} — {desc} ({url})".Trim());
                }
            }

            return string.Join("\n", lines);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Web search failed");
            return "";
        }
    }

    private string? GetApiKey()
    {
        EnsureDotEnv();
        var fromConfig = _config["Ollama:ApiKey"];
        if (!string.IsNullOrWhiteSpace(fromConfig)) return fromConfig;

        var fromEnv = Environment.GetEnvironmentVariable("OLLAMA_API_KEY");
        return string.IsNullOrWhiteSpace(fromEnv) ? null : fromEnv;
    }

    private static bool _dotEnvLoaded = false;
    private void EnsureDotEnv()
    {
        if (_dotEnvLoaded) return;
        _dotEnvLoaded = true;

        try
        {
            var root = Directory.GetCurrentDirectory();
            var path = Path.Combine(root, ".env");
            if (!File.Exists(path)) return;

            foreach (var line in File.ReadAllLines(path))
            {
                var trimmed = line.Trim();
                if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("#")) continue;
                var idx = trimmed.IndexOf('=');
                if (idx <= 0) continue;
                var key = trimmed[..idx].Trim();
                var value = trimmed[(idx + 1)..].Trim();
                if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(key)))
                {
                    Environment.SetEnvironmentVariable(key, value);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load .env");
        }
    }
}

file static class JsonElementExtensions
{
    public static string GetPropertyOrDefault(this JsonElement element, string name, string fallback = "")
    {
        return element.TryGetProperty(name, out var prop) ? prop.GetString() ?? fallback : fallback;
    }
}
