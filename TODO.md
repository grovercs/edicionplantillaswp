# Tareas Pendientes - WP Template Editor

## 🔴 CRÍTICO (Hacer antes de usar en producción)
- [ ] **Testing exhaustivo de backups**: Probar que el backup se guarda correctamente en sessionStorage
- [ ] **Probar flujo completo**: Conectar → Editar → Guardar → Ver cambios en web
- [ ] **Validación de imágenes**: Asegurar que la descarga funciona en Chrome/Firefox/Edge

## 🟡 IMPORTANTE (Mejoras de UX)
- [ ] **Feedback al guardar**: Mostrar confirmación visual más clara
- [ ] **Indicador de carga**: Spinner mientras se resuelven imágenes (Media IDs)
- [ ] **Búsqueda mejorada**: Que funcione con texto parcial, no exacto

## 🟢 DESEABLE (Features nuevas)
- [ ] **Detección SEO**: Verificar H1 único y jerarquía de headings
- [ ] **Multi-idioma**: Detectar WPML/Polylang y permitir traducción
- [ ] **Historial local**: Guardar últimos cambios en localStorage (con timestamp)

## 🔵 OPCIONAL (Nice to have)
- [ ] **Tema oscuro/claro**: Toggle para cambiar tema
- [ ] **Atajos de teclado**: Ctrl+S para guardar, Ctrl+Z para deshacer
- [ ] **Exportar/Importar**: Guardar configuración del proyecto

## 🐛 BUGS CONOCIDOS
- [ ] **Media ID sin resolver**: Si haces clic rápido en imagen antes de cargar miniatura, no encuentra el bloque
- [ ] **Scroll impreciso**: Con bloques similares, a veces scrollea al equivocado

## ✅ COMPLETADO (últimos 7 días)
- [x] Bloqueo de edición sin backup
- [x] Persistencia de backupId en sessionStorage
- [x] Descarga de imágenes
- [x] Resaltado persistente de bloques
- [x] Corrección de errores de sintaxis JS
- [x] Compatibilidad PHP antiguo

## Nota para desarrollo
Marcar tareas como `[x]` cuando se completen. 
Borrar las completadas periódicamente y archivar en `COMPLETED.md`.
