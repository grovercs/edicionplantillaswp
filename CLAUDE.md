# WP Template Editor - Contexto para Claude

## Estado Actual
- **Versión:** v3.3 (20 Abril 2026)
- **Estado:** Funcional y estable
- **Sitio de prueba:** aranguau.com (Bold Builder)

## Arquitectura Rápida
```
Frontend (HTML/JS/CSS vanilla)
    ↓
API PHP (api/*.php)
    ↓
WP REST API (sitio remoto)
```

## Flujo de Trabajo Esperado
1. Usuario conecta con credenciales → sessionStorage
2. Selecciona página → se carga contenido
3. **SI NO HAY BACKUP:** Bloquea edición (banner rojo)
4. Crea backup → sessionStorage guarda backupId
5. Edita contenido → guarda cambios
6. Backup persiste al navegar entre páginas

## Convenciones Importantes
- **NUNCA** editar sin backup (protección implementada)
- Usar `content_raw` siempre, nunca rendered
- Los parsers están en `assets/js/parsers/`
- CORS abierto (`*`) solo para desarrollo local

## Comandos Útiles
```bash
# Iniciar servidor de prueba
php -S localhost:8888 -t C:\xampp\htdocs\edicionplantillaswp

# Ver logs de errores PHP (si los hay)
tail -f C:\xampp\php\logs\php_error_log
```

## Dependencias Externas
- PHP 7.0+ con cURL habilitado
- Navegador moderno (Chrome/Firefox/Edge)
- Conexión a internet (para WP REST API)

## Problemas Conocidos
- Si cierras navegador, los backups en sessionStorage se pierden
- Las imágenes con Media ID tardan en resolver (esperar carga)
- Compatibilidad PHP: sin type hints (cambiado para XAMPP antiguo)

## Tareas Pendientes (Backlog)
1. Detección de encabezados SEO (H1, jerarquía)
2. Soporte multi-idioma (WPML/Polylang)
3. Gestión de menús de navegación
4. Historial de cambios local
5. Mejora de precisión en selección de bloques similares

## Credenciales de Prueba (Aranguau)
```json
{
  "url": "https://aranguau.com",
  "user": "admin_test",
  "password": "xQuG 3xk6 VaAw 436j HJaX Cr1E"
}
```
