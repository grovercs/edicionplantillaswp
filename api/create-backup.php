<?php
/**
 * API Endpoint: Crear backup (duplicar) una página
 * 1. Crea una copia como borrador
 * 2. Cambia la página original también a borrador
 * Así ambas quedan editables sin afectar la web en producción.
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
$page_id = (int)$input['page_id'];

// 1. Crear copia de seguridad (ahora como publicada)
$backupResult = $client->createBackup($page_id, $type);

if (!$backupResult['success']) {
    echo json_encode($backupResult);
    exit;
}

$response = [
    'success' => true,
    'data' => [
        'backup_id'    => $backupResult['data']['backup_id'],
        'backup_title' => $backupResult['data']['backup_title'],
        'message' => sprintf(
            'Backup creado (ID: %d). La página original sigue publicada para facilitar la edición.',
            $backupResult['data']['backup_id']
        )
    ]
];

echo json_encode($response);
