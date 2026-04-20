<?php
/**
 * API Endpoint: Obtener contenido de una página específica (raw para parseo)
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/wp-api.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['url']) || empty($input['user']) || empty($input['password']) || empty($input['page_id'])) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos (url, user, password, page_id)']);
    exit;
}

$client = new WP_API_Client($input['url'], $input['user'], $input['password']);

$type = $input['type'] ?? 'pages';
$result = $client->getPage((int)$input['page_id'], $type);

echo json_encode($result);
