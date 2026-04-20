# Decision Log - WP Template Editor

## 2026-04-20 - Bloqueo de edición sin backup
**Problema:** Usuario podía editar sin backup, arriesgando perder la plantilla original.
**Decisión:** Implementar bloqueo de edición (campos disabled) hasta crear backup.
**Razón:** Seguridad por defecto. Mejor prevenir que lamentar.
**Alternativa considerada:** Solo advertencia visual (rechazada - los usuarios ignoran advertencias).

## 2026-04-20 - Persistencia en sessionStorage
**Problema:** Al navegar entre páginas, el backupId se perdía y pedía backup de nuevo.
**Decisión:** Guardar backupIds en sessionStorage con clave = pageId.
**Razón:** El backup es por página, no por sesión. Debe persistir mientras el navegador esté abierto.
**Alternativa considerada:** localStorage (rechazada - queremos que se limpie al cerrar navegador por seguridad).

## 2026-04-20 - Type hints de PHP removidos
**Problema:** XAMPP con PHP antiguo no soporta `private string $var`.
**Decisión:** Eliminar todos los type hints de propiedades y parámetros.
**Razón:** Compatibilidad con PHP 7.0+ sin sacrificar funcionalidad.
**Alternativa considerada:** Requerir PHP 7.4+ (rechazada - no controlamos el entorno del usuario).

## 2026-04-20 - Descarga de imágenes
**Problema:** Usuario necesita editar imágenes manteniendo dimensiones exactas.
**Decisión:** Botón "Descargar" que abre imagen en nueva pestaña con atributo download.
**Razón:** Los navegadores modernos manejan la descarga. Si falla, el fallback es guardar manualmente.
**Nota técnica:** No funciona para Media IDs sin resolver (esperar carga de miniaturas).

## Patrón emergente: "Fail Safe"
Todas las decisiones priorizan:
1. Proteger datos del usuario (backup obligatorio)
2. Funcionar en entornos limitados (PHP antiguo)
3. Degradación elegante (si descarga falla, abrir en pestaña)
