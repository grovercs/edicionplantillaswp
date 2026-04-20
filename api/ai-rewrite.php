<?php
/**
 * API Endpoint: Reescribir textos con IA
 * Soporta: Google Gemini, OpenAI/GPT, Anthropic/Claude
 * Incluye prompt SEO on-page optimizado con toque humano
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['text']) || empty($input['provider']) || empty($input['api_key'])) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos requeridos (text, provider, api_key)']);
    exit;
}

$text      = $input['text'];
$provider  = $input['provider'];
$apiKey    = $input['api_key'];
$siteName  = $input['site_name'] ?? 'Mi sitio web';
$pageTitle = $input['page_title'] ?? '';
$language  = $input['language'] ?? 'es';
$extraCtx  = $input['extra_context'] ?? '';

// ====================================================================
// PROMPT SEO ON-PAGE CON TOQUE HUMANO
// ====================================================================
$prompt = <<<PROMPT
Eres un copywriter profesional especializado en SEO on-page y escritura persuasiva web. Tu trabajo es reescribir textos de páginas web para que sean más efectivos, naturales y optimizados.

INSTRUCCIONES ESTRICTAS:
1. MANTÉN el mismo significado, propósito e intención del texto original
2. Usa un tono NATURAL, cercano y humano — como si hablara una persona real, no una máquina
3. Aplica buenas prácticas de SEO on-page:
   - Integra palabras clave relevantes de forma orgánica
   - Usa variaciones semánticas (sinónimos, LSI keywords)
   - Estructura con claridad para la lectura web (frases cortas, ritmo variado)
4. Haz el texto PERSUASIVO: genera confianza, empatía y motivación a la acción
5. Mantén aproximadamente la misma longitud (±25%)
6. Si el texto contiene HTML (<p>, <strong>, <em>, <br>, listas, etc.), CONSERVA la estructura HTML
7. Escribe en {$language}
8. NUNCA uses frases genéricas como "en el mundo de", "sin duda alguna", "bienvenidos a nuestra web", "en la actualidad", "somos líderes"
9. Varía la estructura de las frases: alterna cortas y largas para un ritmo natural
10. Incluye al menos un elemento de conexión emocional con el lector

CONTEXTO DEL SITIO:
- Nombre del sitio: {$siteName}
- Página: {$pageTitle}
{$extraCtx}

TEXTO ORIGINAL A REESCRIBIR:
{$text}

IMPORTANTE: Responde ÚNICAMENTE con el texto reescrito. Sin explicaciones, sin comillas envolventes, sin preámbulos, sin "Aquí tienes el texto:". Solo el texto final.
PROMPT;

try {
    switch ($provider) {
        case 'gemini':
            $result = callGemini($apiKey, $prompt);
            break;
        case 'openai':
            $result = callOpenAI($apiKey, $prompt, $input['model'] ?? 'gpt-4o-mini');
            break;
        case 'anthropic':
            $result = callAnthropic($apiKey, $prompt, $input['model'] ?? 'claude-sonnet-4-20250514');
            break;
        default:
            echo json_encode(['success' => false, 'error' => "Proveedor '{$provider}' no soportado. Usa: gemini, openai, anthropic"]);
            exit;
    }

    echo json_encode(['success' => true, 'data' => ['rewritten' => $result]]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

// ====================================================================
// PROVEEDORES DE IA
// ====================================================================

function callGemini(string $apiKey, string $prompt): string {
    // Modelo actualizado: gemini-1.5-flash-latest (modelo gratuito actual)
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={$apiKey}";

    $data = [
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ],
        'generationConfig' => [
            'temperature'    => 0.75,
            'maxOutputTokens' => 4096,
        ]
    ];

    $response = curlPost($url, $data);

    if (isset($response['candidates'][0]['content']['parts'][0]['text'])) {
        return trim($response['candidates'][0]['content']['parts'][0]['text']);
    }

    throw new Exception('Respuesta inesperada de Gemini: ' . json_encode($response));
}

function callOpenAI(string $apiKey, string $prompt, string $model = 'gpt-4o-mini'): string {
    $url = "https://api.openai.com/v1/chat/completions";

    $data = [
        'model'       => $model,
        'messages'    => [['role' => 'user', 'content' => $prompt]],
        'temperature' => 0.75,
        'max_tokens'  => 4096,
    ];

    $response = curlPost($url, $data, [
        'Authorization: Bearer ' . $apiKey,
    ]);

    if (isset($response['choices'][0]['message']['content'])) {
        return trim($response['choices'][0]['message']['content']);
    }

    throw new Exception('Respuesta inesperada de OpenAI: ' . json_encode($response));
}

function callAnthropic(string $apiKey, string $prompt, string $model = 'claude-sonnet-4-20250514'): string {
    $url = "https://api.anthropic.com/v1/messages";

    $data = [
        'model'      => $model,
        'max_tokens' => 4096,
        'messages'   => [['role' => 'user', 'content' => $prompt]],
    ];

    $response = curlPost($url, $data, [
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01',
    ]);

    if (isset($response['content'][0]['text'])) {
        return trim($response['content'][0]['text']);
    }

    throw new Exception('Respuesta inesperada de Anthropic: ' . json_encode($response));
}

// ====================================================================
// UTILIDAD
// ====================================================================

function curlPost(string $url, array $data, array $extraHeaders = []): array {
    $ch = curl_init($url);

    $headers = array_merge([
        'Content-Type: application/json',
    ], $extraHeaders);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($data),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new Exception('Error de conexión: ' . $err);
    }
    curl_close($ch);

    $decoded = json_decode($response, true);
    if ($decoded === null) {
        throw new Exception("Respuesta inválida del servidor IA (HTTP {$httpCode})");
    }

    if ($httpCode >= 400) {
        $errMsg = $decoded['error']['message'] 
            ?? $decoded['error']['type'] 
            ?? json_encode($decoded);
        throw new Exception("Error del proveedor IA (HTTP {$httpCode}): {$errMsg}");
    }

    return $decoded;
}
