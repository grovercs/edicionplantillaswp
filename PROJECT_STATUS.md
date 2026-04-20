# 📝 WP Template Editor - Estado del Proyecto

> [!IMPORTANT]
> **CÓMO RETOMAR EL TRABAJO:**
> 1. Abrir la carpeta `/projects` para recuperar las credenciales del sitio actual (`aranguau.json`).
> 2. Consultar este archivo (`PROJECT_STATUS.md`) para ver la lista de tareas pendientes.
> 3. Revisar `LEEME.txt` para evitar errores técnicos conocidos.

## 🎯 Objetivo Global
Crear una herramienta local avanzada para editar sitios WordPress de forma inteligente, permitiendo cambios de contenido (textos, imágenes, slugs) sin interactuar con los editores visuales complejos, aprovechando la IA para optimización SEO y asegurando la integridad del sitio mediante copias de seguridad automáticas.

## 🏗️ Arquitectura Actual
- **Frontend**: Vanilla HTML/JS con CSS puro (Aesthetics premium, glassmorphism, responsive).
- **Backend**: API en PHP que interactúa con WordPress vía REST API.
- **Documentación**: 
  - `PROJECT_STATUS.md`: Seguimiento de hitos y tareas.
  - `LEEME.txt`: Notas técnicas y lecciones aprendidas (evitar errores pasados).
  - `/projects`: Carpeta con archivos JSON que contienen credenciales de sitios específicos.
- **Parsers**: Sistema de extracción de bloques para:
  - Elementor
  - WPBakery
  - BoldBuilder (Usado en aranguau.com con tema Pawsitive)
  - Divi
  - Gutenberg / Bloques nativos
- **IA**: Integración con Google Gemini (recomendado), OpenAI y Anthropic para reescritura de contenidos.

## ✅ Hitos Alcanzados (v3)
- [x] **Interfaz Profesional**: Dashboard moderno con navegación entre pantallas (Conexión, Páginas, Editor).
- [x] **Modales Custom**: Reemplazo de `confirm()` nativo para evitar bloqueos del navegador.
- [x] **Preview Interactivo**: Al hacer clic en el iframe de vista previa, el editor hace scroll automático al bloque de texto o imagen correspondiente.
- [x] **Sistema de Backup**: Banner de advertencia dinámico y sistema para duplicar páginas antes de editarlas (ambas quedan en borrador por seguridad).
- [x] **Media Resolution**: Carga de miniaturas reales para bloques de imágenes mediante IDs de medios de WP.
- [x] **Multi-Proveedor IA**: Configuración persistente en `localStorage` para Gemini, OpenAI y Claude.
- [x] **Resaltado Persistente**: Bloques seleccionados cambian de color para identificación clara.
- [x] **Descarga de Imágenes**: Botón para descargar imágenes originales y editarlas localmente manteniendo dimensiones.
- [x] **Bloqueo de Edición sin Backup**: Los campos se deshabilitan hasta crear un backup, protegiendo la plantilla original.
- [x] **Persistencia de Backup**: Los backupIds se guardan en sessionStorage para mantener acceso al volver a una página.

## 📋 Tareas Pendientes / Próximos Pasos
- [ ] **Detección de Encabezados SEO**: Implementar advertencias si faltan H1 o si el orden de los encabezados no es óptimo.
- [ ] **Soporte Multi-idioma**: Facilitar la traducción de bloques si se detectan plugins de idiomas (WPML/Polylang).
- [ ] **Gestión de Menús**: Extender el editor para permitir cambios rápidos en menús de navegación.
- [ ] **Historial de Cambios Local**: Guardar versiones temporales en el navegador para evitar pérdidas de trabajo accidentales.
- [ ] **Mejora de Selección de Bloques**: Refinar la precisión del scroll cuando hay muchos bloques similares.

## 🕒 Registro de Sesiones (Log)

### 2026-04-20 (Sesión Actual)
**Correcciones Críticas:**
- ✅ Corregido error de sintaxis en `api/proxy-preview.php` (JavaScript mal cerrado).
- ✅ Eliminada función duplicada `handleBlockSearch` en `app.js`.
- ✅ Corregida compatibilidad PHP eliminando type hints (PHP 7.4+ → compatible).
- ✅ Implementada edición de slugs usando `update-content.php` correctamente.

**Mejoras de Funcionalidad:**
- ✅ **Preview Interactivo**: Clic en preview → scroll + resaltado persistente en bloques del editor.
- ✅ **Descarga de Imágenes**: Botón "⬇️ Descargar" para editar imágenes manteniendo dimensiones exactas.
- ✅ **Bloqueo de Edición por Seguridad**: Sin backup → campos deshabilitados, banner rojo pulsante.
- ✅ **Persistencia de Backup**: Los backups se guardan en `sessionStorage` y persisten al navegar.

**Configuración:**
- ✅ Añadidos permisos automáticos en `.claude/settings.json` para reducir prompts.

### 2026-04-19 (Sesión Anterior)
- Se implementó el sistema de **Memoria y Progreso** (`PROJECT_STATUS.md`) con instrucciones de rescate.
- Se creó `LEEME.txt` con lecciones técnicas y registro de errores/soluciones.
- Se sistematizó la gestión de proyectos en `/projects`, recuperando datos de Aranguau.com.
- Se añadió guía de referencia para IA (`ai-config.json.example`).
- Se documentó la deuda técnica de seguridad (CORS `*`).
- Análisis completo del estado v3 para asegurar una continuidad sin fisuras.

---
> **Nota para el Asistente**: Por favor, actualiza la sección de "Registro de Sesiones" y marca las tareas completadas antes de cerrar la conversación.
