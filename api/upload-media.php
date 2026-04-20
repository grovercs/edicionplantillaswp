<?php
/**
 * API Endpoint: Subir imagen al media library de WordPress
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/wp-api.php';

// Los datos de conexión vienen como campos del form (no JSON)
$url = $_POST['url'] ?? '';
$user = $_POST['user'] ?? '';
$password = $_POST['password'] ?? '';

if (empty($url) || empty($user) || empty($password)) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos de conexión']);
    exit;
}

if (!isset($_FILES['image'])) {
    echo json_encode(['success' => false, 'error' => 'No se ha enviado ninguna imagen']);
    exit;
}

$file = $_FILES['image'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'Error al subir el archivo: código ' . $file['error']]);
    exit;
}

$client = new WP_API_Client($url, $user, $password);

$mime_type = $file['type'] ?: mime_content_type($file['tmp_name']);
$result = $client->uploadMedia($file['tmp_name'], $file['name'], $mime_type);

if ($result['success']) {
    echo json_encode([
        'success' => true,
        'data' => [
            'id' => $result['data']['id'],
            'url' => $result['data']['source_url'] ?? $result['data']['guid']['rendered'] ?? '',
            'title' => $result['data']['title']['rendered'] ?? $file['name'],
        ]
    ]);
} else {
    echo json_encode($result);
}
