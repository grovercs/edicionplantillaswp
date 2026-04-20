<?php
/**
 * API Endpoint: Actualizar contenido de una página (SIEMPRE como borrador)
 * - Primero crea un backup automático como borrador
 * - Luego actualiza la página con el nuevo contenido
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/wp-api.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['url']) || empty($input['user']) || empty($input['password']) ||
    empty($input['page_id']) || !isset($input['content'])) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos (url, user, password, page_id, content)']);
    exit;
}

$client = new WP_API_Client($input['url'], $input['user'], $input['password']);

$type = $input['type'] ?? 'pages';
$page_id = (int)$input['page_id'];

// Paso 1: Crear backup automático (solo si no se solicita saltarlo)
$skip_backup = isset($input['skip_backup']) && $input['skip_backup'] === true;
$backup_result = ['success' => true, 'data' => ['backup_id' => 'skipped']];

if (!$skip_backup) {
    $backup_result = $client->createBackup($page_id, $type);
    if (!$backup_result['success']) {
        echo json_encode([
            'success' => false,
            'error' => 'No se pudo crear el backup: ' . ($backup_result['error'] ?? 'Error desconocido')
        ]);
        exit;
    }
}

// Paso 2: Actualizar la página (ahora se mantiene publicada)
$new_title = $input['title'] ?? null;
$new_slug = $input['slug'] ?? null;
$update_result = $client->updatePage($page_id, $input['content'], $type, $new_title, 'publish', $new_slug);

if ($update_result['success']) {
    echo json_encode([
        'success' => true,
        'data' => [
            'backup' => $backup_result['data'],
            'updated_id' => $page_id,
            'message' => 'Cambios guardados con éxito. Backup de seguridad creado (ID: ' . $backup_result['data']['backup_id'] . ')'
        ]
    ]);
} else {
    echo json_encode([
        'success' => false,
        'error' => 'Backup creado, pero falló la actualización: ' . ($update_result['error'] ?? ''),
        'backup' => $backup_result['data']
    ]);
}
