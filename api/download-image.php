<?php
/**
 * Proxy para descargar imágenes desde WordPress
 * Esto evita problemas de CORS y asegura que la imagen se descargue correctamente
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// Soporta tanto POST json (antiguo) como GET (nuevo proxy directo)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $imageUrl = $input['url'] ?? '';
} else {
    $imageUrl = $_GET['url'] ?? '';
}

if (empty($imageUrl)) {
    http_response_code(400);
    die('Falta la URL de la imagen');
}

// Validar que sea una URL de imagen válida
if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    die('URL inválida');
}

// Obtener la imagen
try {
    $ch = curl_init($imageUrl);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HEADER => false, // NO incluir headers en la respuesta
        CURLOPT_ENCODING => '',  // MUY IMPORTANTE: Soporta gzip/brotli para que la imagen no venga corrupta
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    // Forzar Referer para simular navegación directa a la raíz del dominio
    $urlParts = parse_url($imageUrl);
    $referer = isset($urlParts['scheme']) ? $urlParts['scheme'] . '://' . $urlParts['host'] . '/' : $imageUrl;
    $options[CURLOPT_REFERER] = $referer;

    curl_setopt_array($ch, $options);

    $body = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($httpCode !== 200 || !$body) {
        http_response_code($httpCode >= 400 ? $httpCode : 404);
        die("HTTP {$httpCode} o body vacío");
    }

    // Extraer nombre del archivo de la URL
    $path = parse_url($imageUrl, PHP_URL_PATH);
    $fileName = $path ? basename($path) : 'imagen';
    
    // Asegurar que tenga extensión (muy importante para Windows)
    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    if (empty($ext)) {
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'image/svg+xml' => 'svg'
        ];
        $mappedExt = $extensions[$contentType] ?? 'jpg';
        $fileName .= '.' . $mappedExt;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Modo proxy directo (Stream binario natural)
        // Eliminamos el Content-Type original (application/json) y forzamos descarga
        header_remove('Content-Type'); 
        header('Content-Type: ' . ($contentType ?: 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen($body));
        
        // Bloquear caché agresivo
        header('Cache-Control: no-cache, must-revalidate');
        echo $body;
        exit;
    }

    // Modo compatibilidad POST JSON (base64)
    $base64 = base64_encode($body);
    echo json_encode([
        'success' => true,
        'data' => [
            'base64' => $base64,
            'content_type' => $contentType ?: 'image/jpeg',
            'file_name' => $fileName
        ]
    ]);

} catch (Exception $e) {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        http_response_code(500);
        die($e->getMessage());
    } else {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
