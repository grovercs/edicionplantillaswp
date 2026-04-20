<?php
/**
 * WP Template Editor — WordPress REST API Client
 * 
 * Clase PHP que actúa como proxy entre el dashboard local y la REST API
 * de cualquier instalación WordPress remota o local.
 */

class WP_API_Client {

    private $site_url;
    private $username;
    private $app_password;
    private $api_base;

    public function __construct($site_url, $username, $app_password) {
        $this->site_url = rtrim($site_url, '/');
        $this->username = $username;
        $this->app_password = str_replace(' ', '', $app_password); // Limpiar espacios de Application Passwords
        $this->api_base = $this->site_url . '/wp-json/wp/v2';
    }
    
    /**
     * Realizar petición HTTP a la REST API de WordPress
     */
    private function request($method, $endpoint, $data = [], $headers = []) {
        $url = $this->api_base . $endpoint;
        
        $ch = curl_init();
        
        $default_headers = [
            'Authorization: Basic ' . base64_encode($this->username . ':' . $this->app_password),
            'Content-Type: application/json',
            'Accept: application/json',
        ];
        
        $all_headers = array_merge($default_headers, $headers);
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $all_headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Para localhost
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        
        if ($method === 'POST' || $method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
            if (!empty($data)) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        }
        
        if ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            return ['success' => false, 'error' => 'cURL Error: ' . $error, 'http_code' => 0];
        }
        
        $decoded = json_decode($response, true);
        
        if ($http_code >= 200 && $http_code < 300) {
            return ['success' => true, 'data' => $decoded, 'http_code' => $http_code];
        }
        
        $error_msg = 'HTTP ' . $http_code;
        if (isset($decoded['message'])) {
            $error_msg .= ': ' . $decoded['message'];
        }
        
        return ['success' => false, 'error' => $error_msg, 'http_code' => $http_code, 'data' => $decoded];
    }
    
    /**
     * Petición raw para subida de archivos binarios
     */
    private function requestRaw($url, $file_path, $filename, $mime_type) {
        $ch = curl_init();
        
        $headers = [
            'Authorization: Basic ' . base64_encode($this->username . ':' . $this->app_password),
            'Content-Type: ' . $mime_type,
            'Content-Disposition: attachment; filename="' . $filename . '"',
        ];
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents($file_path));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            return ['success' => false, 'error' => 'cURL Error: ' . $error];
        }
        
        $decoded = json_decode($response, true);
        
        if ($http_code >= 200 && $http_code < 300) {
            return ['success' => true, 'data' => $decoded];
        }
        
        return ['success' => false, 'error' => 'HTTP ' . $http_code, 'data' => $decoded];
    }
    
    // =========================================================================
    // CONEXIÓN
    // =========================================================================
    
    /**
     * Verificar que la conexión funciona y obtener info del sitio
     */
    public function testConnection(): array {
        // Primero probar la API base
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->site_url . '/wp-json');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error || $http_code !== 200) {
            return [
                'success' => false, 
                'error' => 'No se puede conectar a la REST API. ¿Está habilitada? URL: ' . $this->site_url . '/wp-json'
            ];
        }
        
        $site_info = json_decode($response, true);
        
        // Ahora verificar autenticación
        $auth_test = $this->request('GET', '/users/me?context=edit');
        
        if (!$auth_test['success']) {
            return [
                'success' => false,
                'error' => 'Credenciales incorrectas o permisos insuficientes. ' . ($auth_test['error'] ?? '')
            ];
        }
        
        return [
            'success' => true,
            'data' => [
                'site_name' => $site_info['name'] ?? 'WordPress',
                'site_url' => $this->site_url,
                'site_description' => $site_info['description'] ?? '',
                'user' => $auth_test['data']['name'] ?? $this->username,
                'user_roles' => $auth_test['data']['roles'] ?? [],
            ]
        ];
    }
    
    // =========================================================================
    // PÁGINAS Y POSTS
    // =========================================================================
    
    /**
     * Obtener listado de páginas con detección de builder
     */
    public function getPages($per_page = 100, $page = 1, $status = 'any') {
        $endpoint = "/pages?per_page={$per_page}&page={$page}&status={$status}&lang=all&context=edit&orderby=title&order=asc";
        $result = $this->request('GET', $endpoint);
        
        if (!$result['success']) {
            return $result;
        }
        
        $pages = [];
        foreach ($result['data'] as $page_data) {
            $pages[] = $this->enrichPageData($page_data);
        }
        
        return ['success' => true, 'data' => $pages];
    }
    
    /**
     * Obtener listado de posts
     */
    public function getPosts($per_page = 100, $page = 1, $status = 'any') {
        $endpoint = "/posts?per_page={$per_page}&page={$page}&status={$status}&lang=all&context=edit&orderby=title&order=asc";
        $result = $this->request('GET', $endpoint);
        
        if (!$result['success']) {
            return $result;
        }
        
        $posts = [];
        foreach ($result['data'] as $post_data) {
            $posts[] = $this->enrichPageData($post_data);
        }
        
        return ['success' => true, 'data' => $posts];
    }
    
    /**
     * Obtener una página/post específico con contenido raw
     */
    public function getPage($id, $type = 'pages') {
        $result = $this->request('GET', "/{$type}/{$id}?context=edit");
        
        if (!$result['success']) {
            return $result;
        }
        
        return ['success' => true, 'data' => $this->enrichPageData($result['data'])];
    }
    
    /**
     * Enriquecer datos de página con info de builder detectado
     */
    private function enrichPageData($page_data) {
        $raw_content = $page_data['content']['raw'] ?? '';
        $builder = $this->detectBuilder($raw_content, $page_data);
        
        return [
            'id' => $page_data['id'],
            'title' => $page_data['title']['raw'] ?? $page_data['title']['rendered'] ?? '(sin título)',
            'slug' => $page_data['slug'] ?? '',
            'status' => $page_data['status'] ?? 'publish',
            'link' => $page_data['link'] ?? '',
            'modified' => $page_data['modified'] ?? '',
            'template' => $page_data['template'] ?? '',
            'builder' => $builder,
            'content_raw' => $raw_content,
            'content_rendered' => $page_data['content']['rendered'] ?? '',
            'featured_media' => $page_data['featured_media'] ?? 0,
            'meta' => $page_data['meta'] ?? [],
        ];
    }
    
    // =========================================================================
    // DETECCIÓN DE BUILDER
    // =========================================================================
    
    /**
     * Detectar qué page builder se usó para crear el contenido
     */
    public function detectBuilder($content, $page_data = []) {
        // Elementor: buscar en meta o en contenido
        if (!empty($page_data['meta']['_elementor_data']) || 
            !empty($page_data['meta']['_elementor_edit_mode']) ||
            strpos($content, 'elementor') !== false ||
            strpos($content, 'data-elementor') !== false) {
            return [
                'name' => 'elementor',
                'label' => 'Elementor',
                'icon' => '🟣',
                'storage' => 'meta', // Almacena en _elementor_data
            ];
        }
        
        // WPBakery / Visual Composer
        if (preg_match('/\[vc_row/', $content) || preg_match('/\[vc_column/', $content)) {
            return [
                'name' => 'wpbakery',
                'label' => 'WPBakery',
                'icon' => '🔵',
                'storage' => 'content', // Almacena en post_content como shortcodes
            ];
        }
        
        // Bold Builder
        if (preg_match('/\[bt_bb_/', $content)) {
            return [
                'name' => 'boldbuilder',
                'label' => 'Bold Builder',
                'icon' => '🟡',
                'storage' => 'content',
            ];
        }
        
        // Divi
        if (preg_match('/\[et_pb_/', $content)) {
            return [
                'name' => 'divi',
                'label' => 'Divi Builder',
                'icon' => '🟢',
                'storage' => 'content',
            ];
        }
        
        // Gutenberg (bloques)
        if (preg_match('/<!-- wp:/', $content)) {
            return [
                'name' => 'gutenberg',
                'label' => 'Gutenberg',
                'icon' => '⬛',
                'storage' => 'content',
            ];
        }
        
        // Classic editor o desconocido
        return [
            'name' => 'classic',
            'label' => 'Editor Clásico',
            'icon' => '⬜',
            'storage' => 'content',
        ];
    }
    
    // =========================================================================
    // ACTUALIZACIÓN (SIEMPRE COMO BORRADOR)
    // =========================================================================
    
    /**
     * Crear una copia de seguridad de la página como borrador
     */
    public function createBackup($page_id, $type = 'pages') {
        // Obtener la página original
        $original = $this->getPage($page_id, $type);
        if (!$original['success']) {
            return $original;
        }
        
        $page = $original['data'];
        $timestamp = date('Y-m-d H:i');
        
        // Crear una copia como publicada (invisible si no está en menús)
        $backup_data = [
            'title' => '[BACKUP ' . $timestamp . '] ' . $page['title'],
            'content' => $page['content_raw'],
            'status' => 'publish',
            'slug' => $page['slug'] . '-backup-' . date('Ymd-His'),
        ];
        
        // Si hay template, copiarla también
        if (!empty($page['template'])) {
            $backup_data['template'] = $page['template'];
        }
        
        $result = $this->request('POST', "/{$type}", $backup_data);
        
        if ($result['success']) {
            return [
                'success' => true, 
                'data' => [
                    'backup_id' => $result['data']['id'],
                    'backup_title' => $backup_data['title'],
                    'message' => 'Backup creado como borrador (ID: ' . $result['data']['id'] . ')'
                ]
            ];
        }
        
        return $result;
    }
    
    /**
     * Actualizar contenido de una página (por defecto publicada)
     */
    public function updatePage($page_id, $new_content, $type = 'pages', $new_title = null, $status = 'publish', $new_slug = null) {
        $data = [
            'content' => $new_content,
            'status' => $status,
        ];

        if ($new_title !== null) {
            $data['title'] = $new_title;
        }

        if ($new_slug !== null) {
            $data['slug'] = $new_slug;
        }

        return $this->request('POST', "/{$type}/{$page_id}", $data);
    }
    
    /**
     * Cambiar el estado de una página (draft, publish, pending, private)
     */
    public function setPageStatus($id, $status, $type = 'pages') {
        if (!in_array($status, ['publish', 'draft', 'private', 'pending'])) {
            return ['success' => false, 'error' => 'Invalid status'];
        }
        
        return $this->request('POST', "/{$type}/{$id}", [
            'status' => $status
        ]);
    }

    /**
     * Actualiza el slug / permalink de una página
     */
    public function updatePageSlug($id, $slug, $type = 'pages') {
        return $this->request('POST', "/{$type}/{$id}", [
            'slug' => $slug
        ]);
    }
    
    // =========================================================================
    // MEDIA / IMÁGENES
    // =========================================================================
    
    /**
     * Subir una imagen al media library de WordPress
     */
    public function uploadMedia($file_path, $filename, $mime_type = 'image/jpeg') {
        $url = $this->api_base . '/media';
        return $this->requestRaw($url, $file_path, $filename, $mime_type);
    }
    
    /**
     * Obtener una imagen del media library
     */
    public function getMedia($media_id) {
        return $this->request('GET', "/media/{$media_id}");
    }
    
    /**
     * Listar imágenes recientes del media library
     */
    public function listMedia($per_page = 20) {
        return $this->request('GET', "/media?per_page={$per_page}&mime_type=image&orderby=date&order=desc");
    }
    
    // =========================================================================
    // ELEMENTOR ESPECÍFICO
    // =========================================================================
    
    /**
     * Obtener los datos de Elementor de una página
     * Nota: Requiere que _elementor_data esté expuesto vía REST API
     * o usamos el campo meta directamente si está disponible
     */
    public function getElementorData($page_id) {
        // Intentar obtener de meta
        $page = $this->getPage($page_id);
        if (!$page['success']) {
            return $page;
        }
        
        $meta = $page['data']['meta'] ?? [];
        
        // Buscar _elementor_data en meta
        if (isset($meta['_elementor_data'])) {
            $elementor_data = $meta['_elementor_data'];
            if (is_string($elementor_data)) {
                $elementor_data = json_decode($elementor_data, true);
            }
            return ['success' => true, 'data' => $elementor_data];
        }
        
        // Si no está en meta, devolver el contenido raw para parseo del lado cliente
        return [
            'success' => true, 
            'data' => null,
            'fallback' => 'content',
            'message' => '_elementor_data no disponible vía API. Usando contenido renderizado.'
        ];
    }
}
