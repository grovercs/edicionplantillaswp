/**
 * WP Client — Comunicación con la REST API de WordPress a través del proxy PHP
 */
class WPClient {
    constructor() {
        this.credentials = null;
        this.siteInfo = null;
    }

    /** Guardar credenciales en memoria (y sessionStorage) */
    setCredentials(url, user, password) {
        this.credentials = { url, user, password };
        sessionStorage.setItem('wp_credentials', JSON.stringify(this.credentials));
    }

    /** Recuperar credenciales de sessionStorage */
    loadCredentials() {
        const saved = sessionStorage.getItem('wp_credentials');
        if (saved) {
            this.credentials = JSON.parse(saved);
            return true;
        }
        return false;
    }

    /** Limpiar credenciales */
    clearCredentials() {
        this.credentials = null;
        this.siteInfo = null;
        sessionStorage.removeItem('wp_credentials');
    }

    /** Verificar si hay credenciales activas */
    isConnected() {
        return this.credentials !== null;
    }

    /** Petición POST genérica al proxy PHP */
    async apiCall(endpoint, extraData = {}) {
        if (!this.credentials) throw new Error('No hay credenciales configuradas');

        const body = {
            ...this.credentials,
            ...extraData
        };

        const response = await fetch(`api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    // =========================================================================
    // CONEXIÓN
    // =========================================================================

    async connect(url, user, password) {
        this.setCredentials(url, user, password);

        try {
            const result = await this.apiCall('connect.php');
            if (result.success) {
                this.siteInfo = result.data;
            } else {
                this.clearCredentials();
            }
            return result;
        } catch (err) {
            this.clearCredentials();
            throw err;
        }
    }

    // =========================================================================
    // PÁGINAS Y POSTS
    // =========================================================================

    async getPages(type = 'pages') {
        return this.apiCall('get-pages.php', { type });
    }

    async getPageContent(pageId, type = 'pages') {
        return this.apiCall('get-content.php', { page_id: pageId, type });
    }

    // =========================================================================
    // ACTUALIZACIÓN
    // =========================================================================

    async updateContent(pageId, content, type = 'pages', skipBackup = false) {
        return this.apiCall('update-content.php', {
            page_id: pageId,
            content,
            type,
            skip_backup: skipBackup
        });
    }

    // =========================================================================
    // BACKUP
    // =========================================================================

    async createBackup(pageId, type = 'pages') {
        return this.apiCall('create-backup.php', {
            page_id: pageId,
            type,
        });
    }

    // =========================================================================
    // MEDIA
    // =========================================================================

    async uploadImage(file) {
        if (!this.credentials) throw new Error('No hay credenciales configuradas');

        const formData = new FormData();
        formData.append('url', this.credentials.url);
        formData.append('user', this.credentials.user);
        formData.append('password', this.credentials.password);
        formData.append('image', file);

        const response = await fetch('api/upload-media.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }

    async resolveMedia(mediaIds) {
        return this.apiCall('resolve-media.php', {
            media_ids: mediaIds,
        });
    }
}

// Instancia global
window.wpClient = new WPClient();
