<?php
/**
 * API Endpoint: Conectar con WordPress y verificar credenciales
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/wp-api.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['url']) || empty($input['user']) || empty($input['password'])) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos de conexión (url, user, password)']);
    exit;
}

$client = new WP_API_Client($input['url'], $input['user'], $input['password']);
$result = $client->testConnection();

echo json_encode($result);
