<?php
/**
 * API Endpoint: Resolver Media IDs a URLs
 * Dado un array de media IDs, devuelve sus URLs de imagen.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/cors.php';

require_once __DIR__ . '/../includes/wp-api.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['url']) || empty($input['user']) || empty($input['password']) || empty($input['media_ids'])) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos (url, user, password, media_ids)']);
    exit;
}

$client = new WP_API_Client($input['url'], $input['user'], $input['password']);
$mediaIds = $input['media_ids'];
$resolved = [];

foreach ($mediaIds as $id) {
    $id = (int)$id;
    if ($id <= 0) continue;
    
    $result = $client->getMedia($id);
    if ($result['success'] && isset($result['data'])) {
        $url = $result['data']['source_url'] 
            ?? $result['data']['media_details']['sizes']['medium']['source_url'] 
            ?? $result['data']['guid']['rendered'] 
            ?? '';
        $thumb = $result['data']['media_details']['sizes']['thumbnail']['source_url'] 
            ?? $result['data']['media_details']['sizes']['medium']['source_url'] 
            ?? $url;
        // Obtener dimensiones originales de la imagen
        $width = $result['data']['media_details']['width'] ?? null;
        $height = $result['data']['media_details']['height'] ?? null;

        $resolved[$id] = [
            'url'    => $url,
            'thumb'  => $thumb,
            'title'  => $result['data']['title']['rendered'] ?? '',
            'alt'    => $result['data']['alt_text'] ?? '',
            'width'  => $width,
            'height' => $height,
        ];
    }
}

echo json_encode(['success' => true, 'data' => $resolved]);
