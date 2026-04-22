<?php
/**
 * API Endpoint: Reescribir textos con IA
 * Soporta: Google Gemini, OpenAI/GPT, Anthropic/Claude
 * Incluye prompt SEO on-page optimizado con toque humano
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['text']) || empty($input['provider']) || empty($input['api_key'])) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos requeridos (text, provider, api_key)']);
    exit;
}

$text      = $input['text'];
$provider  = $input['provider'];
$apiKey    = $input['api_key'];
$blockType = $input['block_type'] ?? 'text';
$mode      = $input['mode'] ?? 'seo';
$customPrm = $input['custom_prompt'] ?? '';
$siteName  = $input['site_name'] ?? 'Mi sitio web';
$pageTitle = $input['page_title'] ?? '';
$language  = $input['language'] ?? 'es';
$extraCtx  = $input['extra_context'] ?? '';

// Contar palabras del texto original (sin HTML)
$plainText = strip_tags($text);
$wordCount = str_word_count($plainText, 0, 'áéíóúñÁÉÍÓÚÑüÜ');

// ====================================================================
// MODO CUSTOM: El usuario escribe su propio prompt
// ====================================================================
if ($mode === 'custom' && !empty($customPrm)) {
    $prompt = <<<PROMPT
{$customPrm}

TEXTO ORIGINAL:
{$text}

Responde ÚNICAMENTE con el resultado. Sin explicaciones, sin comillas envolventes, sin preámbulos.
PROMPT;

} else {
    // ====================================================================
    // MODO SEO: Prompts automáticos según tipo de bloque
    // ====================================================================
    switch ($blockType) {
        case 'heading':
            $prompt = <<<PROMPT
Reescribe este TÍTULO WEB en {$language}. El original tiene {$wordCount} palabras.

REGLAS OBLIGATORIAS:
- Tu respuesta debe tener MÁXIMO {$wordCount} palabras (igual o menos que el original)
- Es un título H2/H3, NO un párrafo. Mantén la brevedad
- Hazlo directo, con gancho y optimizado para SEO
- Sin punto final, sin comillas, sin explicaciones
- Tono natural y profesional

Sitio: {$siteName} | Página: {$pageTitle}
{$extraCtx}

Título original:
{$text}

Responde SOLO con el nuevo título. Nada más.
PROMPT;
            break;

        case 'button':
            $prompt = <<<PROMPT
Reescribe este TEXTO DE BOTÓN web en {$language}. El original tiene {$wordCount} palabras.

REGLAS OBLIGATORIAS:
- Tu respuesta debe tener entre 2 y 4 palabras MÁXIMO
- Es un botón CTA. Debe ser corto, claro y orientado a la acción
- Sin punto final, sin comillas, sin explicaciones

Sitio: {$siteName} | Página: {$pageTitle}

Texto del botón original:
{$text}

Responde SOLO con el nuevo texto del botón. Nada más.
PROMPT;
            break;

        default: // 'text'
            $prompt = <<<PROMPT
Eres un copywriter SEO profesional. Reescribe este PÁRRAFO de página web en {$language}.

INSTRUCCIONES:
1. MANTÉN el mismo significado e intención del texto original
2. Mantén una longitud similar al original ({$wordCount} palabras aprox., ±25%)
3. Tono NATURAL y humano, no robótico
4. Integra palabras clave relevantes de forma orgánica (sinónimos, LSI)
5. Si hay HTML (<p>, <strong>, <em>, <br>, listas), CONSERVA la estructura HTML
6. NUNCA uses frases genéricas ("en el mundo de", "sin duda alguna", "somos líderes")
7. Haz el texto persuasivo: genera confianza y motivación a la acción

Sitio: {$siteName} | Página: {$pageTitle}
{$extraCtx}

Texto original:
{$text}

Responde ÚNICAMENTE con el texto reescrito. Sin explicaciones, sin comillas, sin preámbulos.
PROMPT;
            break;
    }
}

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

    // ================================================================
    // POST-PROCESADO: limpiar y forzar límites según tipo de bloque
    // ================================================================
    
    // Limpiar comillas envolventes que a veces añade el modelo
    $result = preg_replace('/^["\'""«»]+|["\'""«»]+$/u', '', trim($result));
    
    // Eliminar preámbulos tipo "Aquí tienes:" o "Nuevo título:"
    $result = preg_replace('/^(Aquí tienes[^:]*:|Nuevo (título|texto|botón)[^:]*:|Reescritura[^:]*:)\s*/iu', '', $result);
    
    if ($blockType === 'heading') {
        // Quitar punto final en títulos
        $result = rtrim($result, '.');
        
        // Si la IA devolvió más palabras que el original + 2, recortar
        $resultWords = preg_split('/\s+/', trim($result));
        $maxWords = $wordCount + 2;
        if (count($resultWords) > $maxWords) {
            $result = implode(' ', array_slice($resultWords, 0, $maxWords));
        }
    }
    
    if ($blockType === 'button') {
        // Botones: máximo 5 palabras
        $resultWords = preg_split('/\s+/', trim($result));
        if (count($resultWords) > 5) {
            $result = implode(' ', array_slice($resultWords, 0, 4));
        }
        $result = rtrim($result, '.');
    }

    echo json_encode(['success' => true, 'data' => ['rewritten' => $result]]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

// ====================================================================
// PROVEEDORES DE IA
// ====================================================================

function callGemini(string $apiKey, string $prompt): string {
    // Modelo: gemini-2.5-flash (modelo gratuito estable GA - abril 2026)
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}";

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
