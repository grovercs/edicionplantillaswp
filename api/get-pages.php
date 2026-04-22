<?php
/**
 * API Endpoint: Obtener listado de páginas o posts con detección de builder
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/cors.php';

require_once __DIR__ . '/../includes/wp-api.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['url']) || empty($input['user']) || empty($input['password'])) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos de conexión']);
    exit;
}

$client = new WP_API_Client($input['url'], $input['user'], $input['password']);

$type = $input['type'] ?? 'pages'; // 'pages' o 'posts'
$per_page = $input['per_page'] ?? 100;

if ($type === 'posts') {
    $result = $client->getPosts($per_page);
} else {
    $result = $client->getPages($per_page);
}

echo json_encode($result);
