/**
 * WP Template Editor — Main Application Logic v3
 * 
 * CAMBIOS CLAVE v3:
 * - confirm() nativo → modal personalizado (soluciona botones que no respondían)
 * - Preview interactivo: clic en preview → scroll al bloque correspondiente
 * - Banner de advertencia de backup con acción directa
 * - Ambas copias (original + backup) quedan en borrador
 */
(function () {
    'use strict';
    console.log("🚀 WP Template Editor v3.2 Loaded");

    // =========================================================================
    // STATE
    // =========================================================================
    const state = {
        currentScreen: 'connect',
        currentFilter: 'pages',
        allPages: [],
        currentPage: null,
        currentBlocks: [],
        originalContent: '',
        parser: null,
        hasChanges: false,
        backupId: null,
        // AI
        aiProvider: 'gemini',
        aiApiKey: '',
        aiExtraContext: '',
        aiConfigured: false,
        // Media resolution cache
        mediaCache: {},
        // Strategy for preview: 'proxy' or 'direct'
        previewStrategy: 'proxy',
    };

    // =========================================================================
    // DOM REFERENCES
    // =========================================================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // =========================================================================
    // CUSTOM MODAL (reemplaza confirm() nativo)
    // =========================================================================

    /**
     * Modal de confirmación personalizado que devuelve una Promise<boolean>.
     * Reemplaza confirm() nativo que bloqueaba la interacción del navegador.
     */
    function customConfirm(message, title = 'Confirmar acción', icon = '⚠️') {
        return new Promise(resolve => {
            const overlay = $('#modal-overlay');
            $('#modal-icon').textContent = icon;
            $('#modal-title').textContent = title;
            $('#modal-message').textContent = message;
            overlay.style.display = 'flex';

            const confirmBtn = $('#modal-confirm');
            const cancelBtn = $('#modal-cancel');

            function cleanup() {
                overlay.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlayClick);
            }

            function onConfirm() { cleanup(); resolve(true); }
            function onCancel() { cleanup(); resolve(false); }
            function onOverlayClick(e) {
                if (e.target === overlay) { cleanup(); resolve(false); }
            }

            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlayClick);

            // Focus en el botón de confirmar para accesibilidad
            setTimeout(() => confirmBtn.focus(), 100);
        });
    }

    // =========================================================================
    // UTILS
    // =========================================================================

    function showScreen(name) {
        $$('.screen').forEach(s => s.classList.remove('active'));
        $(`#screen-${name}`).classList.add('active');
        state.currentScreen = name;
    }

    function showLoading(text = 'Cargando...') {
        $('#loading-text').textContent = text;
        $('#loading-overlay').style.display = 'flex';
    }

    function hideLoading() {
        $('#loading-overlay').style.display = 'none';
    }

    function toast(message, type = 'info') {
        const container = $('#toast-container');
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        div.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
        container.appendChild(div);
        setTimeout(() => {
            div.style.opacity = '0';
            div.style.transform = 'translateX(40px)';
            setTimeout(() => div.remove(), 300);
        }, 5000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function getParser(builderName) {
        switch (builderName) {
            case 'wpbakery': return window.WPBakeryParser;
            case 'boldbuilder': return window.BoldBuilderParser;
            case 'divi': return window.DiviParser;
            case 'gutenberg': return window.GutenbergParser;
            case 'elementor': return window.ElementorParser;
            default: return window.ElementorParser;
        }
    }

    function updateConnectionStatus(connected, siteName) {
        const dot = $('#status-dot');
        const text = $('#status-text');
        if (connected) {
            dot.classList.add('connected');
            text.textContent = siteName || 'Conectado';
        } else {
            dot.classList.remove('connected');
            text.textContent = 'Sin conexión';
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch { return dateStr; }
    }

    // =========================================================================
    // PREVIEW ↔ EDITOR NAVIGATION
    // =========================================================================

    /**
     * Cuando el usuario hace clic en un elemento del preview (iframe),
     * recibimos la información vía postMessage y seleccionamos el bloque.
     */
    function setupPreviewNavigation() {
        window.addEventListener('message', handleIframeMessage);
    }

    function handleIframeMessage(e) {
        const data = e.data;
        if (!data || !data.type) return;

        if (data.type === 'preview-click') {
            const text = data.text;
            // Buscar bloque por texto (normalizado)
            const idx = state.currentBlocks.findIndex(b => {
                if (b.type === 'image') return false;
                const normOriginal = stripHtml(b.original).trim().toLowerCase();
                const normCurrent = stripHtml(b.current).trim().toLowerCase();
                const normClicked = text.toLowerCase();
                // Coincidencia flexible (subcadena)
                return normOriginal.includes(normClicked) || normCurrent.includes(normClicked) || 
                       normClicked.includes(normOriginal.substring(0, 50));
            });

            if (idx !== -1) {
                selectBlock(idx, false); // false = no volver a enviar scroll al iframe
            } else {
                toast('No se encontró un bloque de texto correspondiente', 'info');
            }
        }

        if (data.type === 'preview-click-image') {
            const src = data.src;
            const filename = src.split('/').pop().split('?')[0];

            const idx = state.currentBlocks.findIndex(b => {
                if (b.type !== 'image') return false;
                
                // 1. Coincidencia por ID de media (si lo tenemos en cache)
                if (b.isMediaId) {
                    const media = state.mediaCache[parseInt(b.original)];
                    if (media && (media.url || '').includes(filename)) return true;
                }
                
                // 2. Coincidencia por nombre de archivo
                const bOriginal = b.original.split('/').pop();
                const bCurrent = b.current.split('/').pop();
                return bOriginal.includes(filename) || bCurrent.includes(filename);
            });

            if (idx !== -1) {
                selectBlock(idx, false);
            } else {
                toast('No se encontró el bloque de imagen correspondiente', 'info');
            }
        }
    }

    /**
     * Selecciona un bloque visualmente y sincroniza el scroll.
     * @param {number} idx Índice del bloque
     * @param {boolean} syncToIframeScroll Si debemos pedirle al iframe que haga scroll también
     */
    function selectBlock(idx, syncToIframeScroll = true) {
        // Quitar resaltado anterior de todos los bloques
        $$('.block-item--selected').forEach(el => {
            el.classList.remove('block-item--selected');
            el.style.borderColor = '';
            el.style.backgroundColor = '';
        });

        const el = document.querySelector(`.block-item[data-idx="${idx}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Aplicar resaltado visual prominente y persistente
            el.classList.add('block-item--selected');
            el.style.borderColor = 'var(--accent)';
            el.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';

            // También añadir la animación de pulse temporal
            el.classList.add('block-item--highlighted');
            setTimeout(() => el.classList.remove('block-item--highlighted'), 1500);

            // Focus en el textarea o input si existe
            const input = el.querySelector('textarea, input[type="text"]');
            if (input) {
                setTimeout(() => input.focus(), 300);
            }

            if (syncToIframeScroll) {
                const block = state.currentBlocks[idx];
                if (block.type === 'image') {
                    scrollToIframe(null, block.current || block.original);
                } else {
                    scrollToIframe(block.original);
                }
            }
        }
    }

    function highlightBlock(index) {
        const blockEl = document.querySelector(`.block-item[data-idx="${index}"]`);
        if (!blockEl) return;

        // Scroll suave al bloque
        blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Quitar highlights anteriores
        $$('.block-item--highlighted').forEach(el => el.classList.remove('block-item--highlighted'));

        // Añadir highlight con animación
        blockEl.classList.add('block-item--highlighted');
        setTimeout(() => blockEl.classList.remove('block-item--highlighted'), 3000);

        // Focus en el textarea si es texto
        const ta = blockEl.querySelector('textarea');
        if (ta) setTimeout(() => ta.focus(), 400);
    }

    // =========================================================================
    // AI SETTINGS
    // =========================================================================

    function loadAISettings() {
        const saved = localStorage.getItem('wp_editor_ai');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                state.aiProvider = data.provider || 'gemini';
                state.aiApiKey = data.apiKey || '';
                state.aiExtraContext = data.extraContext || '';
                state.aiConfigured = !!state.aiApiKey;
            } catch { /* ignore */ }
        }
        updateAIUI();
    }

    function saveAISettings() {
        const provider = state.aiProvider;
        const apiKey = $('#ai-api-key').value.trim();
        const extraContext = $('#ai-extra-context').value.trim();

        state.aiProvider = provider;
        state.aiApiKey = apiKey;
        state.aiExtraContext = extraContext;
        state.aiConfigured = !!apiKey;

        localStorage.setItem('wp_editor_ai', JSON.stringify({
            provider, apiKey, extraContext
        }));

        updateAIUI();
        toast(apiKey ? `IA configurada: ${provider.toUpperCase()}` : 'Configuración de IA guardada', 'success');
    }

    function updateAIUI() {
        $$('.ai-provider-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.provider === state.aiProvider);
        });

        const keyField = $('#ai-api-key');
        if (keyField && state.aiApiKey && !keyField.value) {
            keyField.value = state.aiApiKey;
        }

        const ctxField = $('#ai-extra-context');
        if (ctxField && state.aiExtraContext && !ctxField.value) {
            ctxField.value = state.aiExtraContext;
        }

        const statusDot = $('.ai-status-dot');
        const statusText = $('#ai-status-text');
        if (statusDot) {
            if (state.aiConfigured) {
                statusDot.classList.add('active');
                statusText.textContent = `IA activa — ${state.aiProvider.toUpperCase()}`;
                statusText.style.color = 'var(--success)';
            } else {
                statusDot.classList.remove('active');
                statusText.textContent = 'IA no configurada — añade tu API Key';
                statusText.style.color = 'var(--text-muted)';
            }
        }

        const hints = {
            gemini: '💎 Gemini: consigue tu key gratis en <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--text-accent);">aistudio.google.com</a>',
            openai: '🧠 OpenAI: obtén tu key en <a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--text-accent);">platform.openai.com</a>',
            anthropic: '🔮 Anthropic: obtén tu key en <a href="https://console.anthropic.com/" target="_blank" style="color:var(--text-accent);">console.anthropic.com</a>'
        };
        const hintEl = $('#ai-key-hint');
        if (hintEl) hintEl.innerHTML = hints[state.aiProvider] || '';

        $$('.btn--ai').forEach(btn => {
            btn.disabled = !state.aiConfigured;
        });
    }

    // =========================================================================
    // BACKUP BANNER
    // =========================================================================

    function updateBackupBanner() {
        const banner = $('#backup-banner');
        if (!banner) return;

        const actionBtn = $('#btn-banner-backup');
        const text = $('#backup-banner-text');
        
        const isExistingBackup = state.currentPage && state.currentPage.title && state.currentPage.title.includes('[BACKUP]');

        if (state.backupId || isExistingBackup) {
            banner.className = 'backup-banner backup-banner--success';
            if (text) {
                const mainMsg = state.backupId 
                    ? `🛡️ <strong>Modo Seguro Activo:</strong> Estás editando la página original. El backup (ID: ${state.backupId}) está guardado.`
                    : `ℹ️ <strong>Estás editando un Backup:</strong> Esta es una copia de seguridad cargada directamente.`;
                
                text.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div>${mainMsg}</div>
                        <div style="font-size: 11px; font-weight: normal; opacity: 0.9;">
                            💡 <strong>Recordatorio:</strong> Si esta es la versión final, recuerda renombrarla y cambiar el slug por el de la original para que tome su lugar.
                        </div>
                    </div>
                `;
            }
            if (actionBtn) actionBtn.style.display = 'none';
        } else {
            banner.className = 'backup-banner backup-banner--danger';
            if (text) {
                text.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div>🔒 <strong>EDICIÓN BLOQUEADA:</strong> No se ha creado backup de esta página.</div>
                        <div style="font-size: 12px; font-weight: normal;">
                            La edición está deshabilitada hasta que crees un backup. Esto protege la página original.
                        </div>
                    </div>
                `;
            }
            if (actionBtn) {
                actionBtn.style.display = '';
                actionBtn.textContent = '🔓 Crear Backup para Editar';
                actionBtn.className = 'btn btn--danger btn--sm';
            }
        }
    }

    // =========================================================================

    // SCREEN 1: CONEXIÓN
    // =========================================================================

    async function handleConnect(e) {
        e.preventDefault();

        const url = $('#wp-url').value.trim();
        const user = $('#wp-user').value.trim();
        const password = $('#wp-app-password').value.trim();
        const errBox = $('#connect-error');
        const btn = $('#btn-connect');

        errBox.style.display = 'none';
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span><span>Conectando...</span>';

        try {
            const result = await wpClient.connect(url, user, password);

            if (result.success) {
                toast(`Conectado a "${result.data.site_name}"`, 'success');
                updateConnectionStatus(true, result.data.site_name);
                $('#site-name-title').textContent = result.data.site_name;
                showScreen('pages');
                loadPages();
            } else {
                errBox.textContent = result.error || 'Error de conexión desconocido';
                errBox.style.display = 'block';
            }
        } catch (err) {
            errBox.textContent = 'Error: ' + err.message;
            errBox.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Conectar</span>';
        }
    }

    // =========================================================================
    // SCREEN 2: LISTA DE PÁGINAS
    // =========================================================================

    async function loadPages() {
        showLoading('Cargando páginas...');

        try {
            const result = await wpClient.getPages(state.currentFilter);

            if (result.success) {
                state.allPages = result.data;

                // Verificar que los backups guardados en sessionStorage aún existan
                const savedBackups = JSON.parse(sessionStorage.getItem('wp_backup_ids') || '{}');
                const existingPageIds = result.data.map(p => p.id);
                let hasChanges = false;

                for (const [pageId, backupId] of Object.entries(savedBackups)) {
                    // Si el backupId no está en la lista de páginas existentes, eliminarlo
                    if (!existingPageIds.includes(parseInt(backupId))) {
                        delete savedBackups[pageId];
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    sessionStorage.setItem('wp_backup_ids', JSON.stringify(savedBackups));
                }

                renderPagesGrid(result.data);
                $('#pages-count').textContent = `${result.data.length} ${state.currentFilter === 'pages' ? 'páginas' : 'posts'} encontrados`;
            } else {
                toast('Error al cargar: ' + (result.error || ''), 'error');
            }
        } catch (err) {
            toast('Error de red: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }

    function renderPagesGrid(pages) {
        const grid = $('#pages-grid');

        if (pages.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <p style="font-size: 40px; margin-bottom: 16px;">📭</p>
                    <p style="font-size: 15px; font-weight: 600;">No se encontraron ${state.currentFilter === 'pages' ? 'páginas' : 'posts'}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = pages.map(page => `
            <div class="page-card" data-id="${page.id}" onclick="window.appOpenEditor(${page.id})">
                <div class="page-card__header">
                    <div class="page-card__title">${escapeHtml(page.title)}</div>
                    <span class="page-card__builder ${page.builder.name}">
                        ${page.builder.icon} ${page.builder.label}
                    </span>
                </div>
                <div class="page-card__meta">
                    <span class="page-card__status">
                        <span class="dot ${page.status}"></span>
                        ${page.status === 'publish' ? 'Publicada' : page.status === 'draft' ? 'Borrador' : page.status}
                    </span>
                    <span>${formatDate(page.modified)}</span>
                    <span class="page-card__slug">/${page.slug}</span>
                </div>
            </div>
        `).join('');
    }

    function handleSearch(e) {
        const query = e.target.value.toLowerCase();
        if (!query) {
            renderPagesGrid(state.allPages);
            return;
        }
        const filtered = state.allPages.filter(p =>
            p.title.toLowerCase().includes(query) ||
            p.slug.toLowerCase().includes(query)
        );
        renderPagesGrid(filtered);
    }

    function handleBlockSearch(e) {
        const query = e.target.value.toLowerCase();
        const blockItems = $$('.block-item');
        
        blockItems.forEach(item => {
            const index = item.dataset.idx;
            const block = state.currentBlocks[index];
            if (!block) return;
            
            if (!query) {
                item.style.display = '';
                return;
            }
            
            const textToSearch = (block.original + ' ' + block.current + ' ' + block.label).toLowerCase();
            if (textToSearch.includes(query)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // =========================================================================
    // SCREEN 3: EDITOR
    // =========================================================================

    window.appOpenEditor = async function (pageId) {
        showLoading('Cargando contenido de la página...');

        try {
            const result = await wpClient.getPageContent(pageId, state.currentFilter);

            if (!result.success) {
                toast('Error al cargar la página: ' + (result.error || ''), 'error');
                hideLoading();
                return;
            }

            const page = result.data;
            console.log("DEBUG: Opening page", page);
            state.currentPage = page;
            state.originalContent = page.content_raw;

            // Verificar si ya existe un backup guardado para esta página
            const savedBackups = JSON.parse(sessionStorage.getItem('wp_backup_ids') || '{}');
            const savedBackupId = savedBackups[page.id] || null;

            // Verificar si el backup guardado aún existe (podría haberse borrado manualmente)
            // Solo confiamos en el backup si la página actual tiene [BACKUP] en el título
            // o si el título de la página original indica que se hizo backup
            if (savedBackupId && page.title && !page.title.includes('[BACKUP]')) {
                // Limpiar backupId si la página actual no es un backup
                // (el backup podría haberse borrado desde WordPress)
                delete savedBackups[page.id];
                sessionStorage.setItem('wp_backup_ids', JSON.stringify(savedBackups));
                state.backupId = null;
            } else if (page.title && page.title.includes('[BACKUP]')) {
                // Si la página actual es un backup, considerarla como segura
                state.backupId = 'existing-backup';
            } else {
                state.backupId = savedBackupId;
            }

            // Parser
            const parser = getParser(page.builder.name);
            state.parser = parser;

            let content = page.content_raw;
            if (page.builder.name === 'elementor' || page.builder.name === 'classic') {
                content = page.content_rendered || page.content_raw;
            }

            const blocks = parser.parse(content);
            state.currentBlocks = blocks;
            state.hasChanges = false;

            // UI — Nombre de página prominente
            $('#editor-page-title').textContent = page.title;
            const badge = $('#editor-builder-badge');
            badge.className = `page-card__builder ${page.builder.name}`;
            badge.innerHTML = `${page.builder.icon} ${page.builder.label}`;
            $('#editor-page-url').textContent = page.link ? new URL(page.link).pathname : `/${page.slug}`;

            // Preview vía proxy
            if (page.link) {
                let previewUrl = page.link;
                // Si no es una página publicada, nos aseguramos de que tenga los parámetros de preview
                const isNotPublished = page.status && page.status !== 'publish';
                if (isNotPublished && !previewUrl.includes('preview=true')) {
                    previewUrl += (previewUrl.includes('?') ? '&' : '?') + 'preview=true';
                }

                let finalUrl = previewUrl;

                if (state.previewStrategy === 'proxy') {
                    finalUrl = `api/proxy-preview.php?url=${encodeURIComponent(previewUrl)}`;
                    // Pasar credenciales para poder ver contenido privado/borradores
                    if (window.wpClient && window.wpClient.credentials) {
                        const { user, password } = window.wpClient.credentials;
                        finalUrl += `&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(password)}`;
                    }
                }

                $('#preview-iframe').src = finalUrl;
                $('#btn-open-external').onclick = () => window.open(previewUrl, '_blank');
            }

            // Backup banner (advertencia al entrar)
            updateBackupBanner();

            // Renderizar bloques
            renderBlocks(blocks);
            updateEditorStatus();

            // Resolver imágenes
            resolveMediaThumbnails(blocks);

            showScreen('editor');
        } catch (err) {
            toast('Error: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    };

    // =========================================================================
    // RESOLVE MEDIA THUMBNAILS
    // =========================================================================

    async function resolveMediaThumbnails(blocks) {
        const mediaIds = [];
        blocks.forEach(block => {
            if (block.type === 'image' && block.isMediaId && /^\d+$/.test(block.original)) {
                const id = parseInt(block.original);
                if (!state.mediaCache[id]) {
                    mediaIds.push(id);
                }
            }
        });

        if (mediaIds.length === 0) return;

        try {
            const result = await wpClient.resolveMedia(mediaIds);
            if (result.success && result.data) {
                Object.assign(state.mediaCache, result.data);
                blocks.forEach((block, i) => {
                    if (block.type === 'image' && block.isMediaId) {
                        const id = parseInt(block.original);
                        const media = state.mediaCache[id];
                        if (media) {
                            const thumbEl = document.querySelector(`#block-thumb-${i}`);
                            if (thumbEl) {
                                thumbEl.innerHTML = `<img class="block-item__thumb" src="${escapeHtml(media.thumb || media.url)}" alt="${escapeHtml(media.alt || '')}" onerror="this.parentElement.innerHTML='<div class=\\'block-item__thumb-placeholder\\'>🖼️</div>'">`;
                            }
                            const infoEl = document.querySelector(`#block-info-${i}`);
                            if (infoEl) {
                                const fname = (media.url || '').split('/').pop();
                                infoEl.textContent = fname || `Media ID: ${id}`;
                            }
                        }
                    }
                });
            }
        } catch (err) {
            console.warn('No se pudieron resolver las miniaturas:', err);
        }
    }

    // =========================================================================
    // RENDER BLOCKS
    // =========================================================================

    function renderBlocks(blocks) {
        const gridContainer = $('#blocks-container');
        const countEl = $('#blocks-count');

        if (!gridContainer) {
            console.error('Critical Error: blocks-container not found in DOM');
            return;
        }

        const textCount = blocks.filter(b => b.type === 'text' || b.type === 'heading' || b.type === 'button').length;
        const imgCount = blocks.filter(b => b.type === 'image').length;
        if (countEl) countEl.textContent = `${textCount} textos · ${imgCount} imágenes`;

        if (!blocks.length) {
            gridContainer.innerHTML = '<div class="empty-state">No se encontraron bloques editables en esta página.</div>';
            return;
        }

        gridContainer.innerHTML = blocks.map((block, index) => {
            if (block.type === 'image') return renderImageBlock(block, index);
            return renderTextBlock(block, index);
        }).join('');

        // Re-adjuntar eventos
        $$('.block-item textarea').forEach(txt => {
            txt.addEventListener('input', debounce(handleBlockChange, 300));
        });
        $$('.block-item input[type="file"]').forEach(input => {
            input.addEventListener('change', handleImageUpload);
        });
        
        // Añadir evento de clic para scroll al iframe
        $$('.block-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                    const idx = parseInt(el.dataset.idx);
                    selectBlock(idx);
                }
            });
        });
    }

    function renderTextBlock(block, index) {
        const typeIcons = { heading: '📌', text: '📝', button: '🔘' };
        const typeLabels = { heading: 'ENCABEZADO', text: 'TEXTO', button: 'BOTÓN' };
        const plainOriginal = stripHtml(block.original);
        const displayValue = block.type === 'heading' || block.type === 'button'
            ? stripHtml(block.current)
            : block.current;

        const aiDisabled = !state.aiConfigured ? 'disabled' : '';
        const isModified = block.current !== block.original;

        // Verificar si hay backup para habilitar/deshabilitar edición
        const hasBackup = state.backupId || (state.currentPage && state.currentPage.title && state.currentPage.title.includes('[BACKUP]'));
        const disabledAttr = hasBackup ? '' : 'disabled';
        const disabledClass = hasBackup ? '' : 'block-item--disabled';
        const placeholderText = hasBackup ? 'Escribe el nuevo texto...' : '⚠️ Crea un backup primero para poder editar';

        return `
            <div class="block-item ${isModified ? 'block-item--modified' : ''} ${disabledClass}" data-idx="${index}">
                <div class="block-item__header">
                    <span class="block-item__type">
                        ${typeIcons[block.type] || '📝'} ${(block.label ? block.label.toUpperCase() : typeLabels[block.type])}
                    </span>
                    <div style="display: flex; gap: 8px;">
                        ${isModified ? `
                            <button class="btn btn--ghost btn--sm" onclick="window.appUndoBlock(${index})" title="Deshacer cambios en este bloque">
                                ↺ Deshacer
                            </button>
                        ` : ''}
                        <button class="btn btn--ai" ${aiDisabled} onclick="window.appAIRewrite(${index})" title="${state.aiConfigured ? 'Reescribir con IA optimizada para SEO' : 'Configura la IA primero'}">
                            ✨ Reescribir con IA
                        </button>
                    </div>
                </div>
                <div class="block-item__original" title="Texto original">
                    ${escapeHtml(plainOriginal.substring(0, 300))}${plainOriginal.length > 300 ? '...' : ''}
                    ${!hasBackup ? '<span style="color: var(--danger); margin-left: 8px;">⚠️ Requiere backup</span>' : ''}
                </div>
                <textarea
                    data-block-idx="${index}"
                    rows="${Math.max(2, Math.ceil(displayValue.length / 80))}"
                    placeholder="${placeholderText}"
                    ${disabledAttr}
                    style="${!hasBackup ? 'background: rgba(239,68,68,0.05); border-color: rgba(239,68,68,0.3);' : ''}"
                >${hasBackup ? escapeHtml(displayValue) : ''}</textarea>
            </div>
        `;
    }

    function renderImageBlock(block, index) {
        const cachedMedia = state.mediaCache[parseInt(block.original)] || null;
        const imgSrc = block.isMediaId
            ? (cachedMedia ? (cachedMedia.thumb || cachedMedia.url) : '')
            : (block.original || '');

        const fileName = block.isMediaId
            ? (cachedMedia ? (cachedMedia.url || '').split('/').pop() : `Media ID: ${block.original}`)
            : (block.original || '').split('/').pop();

        const isModified = block.current !== block.original;

        // Construir URL de descarga solo si tenemos una URL válida
        let downloadUrl = '';
        if (cachedMedia && cachedMedia.url) {
            // Tenemos la URL resuelta del media cache
            downloadUrl = cachedMedia.url;
        } else if (block.original && block.original.startsWith('http')) {
            // Es una URL directa
            downloadUrl = block.original;
        }
        // NOTA: Si es un Media ID sin resolver, NO mostramos el botón de descargar
        // hasta que se resuelva mediante resolveMediaThumbnails()

        // Verificar si hay backup para habilitar/deshabilitar edición
        const hasBackup = state.backupId || (state.currentPage && state.currentPage.title && state.currentPage.title.includes('[BACKUP]'));
        const disabledAttr = hasBackup ? '' : 'disabled title="Crea un backup primero para poder editar"';
        const uploadBtnClass = hasBackup ? 'block-item__upload-btn' : 'block-item__upload-btn block-item__upload-btn--disabled';

        return `
            <div class="block-item block-item--image ${isModified ? 'block-item--modified' : ''}" data-idx="${index}">
                <div class="block-item__thumb-wrap" id="block-thumb-${index}">
                    ${imgSrc
                        ? `<img class="block-item__thumb" src="${escapeHtml(imgSrc)}" alt="Imagen" onerror="this.parentElement.innerHTML='<div class=\\'block-item__thumb-placeholder\\'>🖼️</div>'">`
                        : `<div class="block-item__thumb-placeholder">🖼️</div>`
                    }
                </div>
                <div class="block-item__upload">
                    <div class="block-item__header">
                        <span class="block-item__type">🖼️ IMAGEN</span>
                        <div style="display: flex; gap: 8px;">
                            ${isModified ? `
                                <button class="btn btn--ghost btn--sm" onclick="window.appUndoBlock(${index})" title="Deshacer cambios en este bloque">
                                    ↺ Deshacer
                                </button>
                            ` : ''}
                            ${downloadUrl ? `
                                <button class="btn btn--ghost btn--sm" onclick="window.appDownloadImage(${index}, '${escapeHtml(downloadUrl)}')" title="Descargar imagen original">
                                    ⬇️ Descargar
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="block-item__upload-info" id="block-info-${index}">
                        ${escapeHtml(fileName)}
                        ${!hasBackup ? '<span style="color: var(--danger); margin-left: 8px;">⚠️ Requiere backup</span>' : ''}
                    </div>
                    <label class="${uploadBtnClass}" ${!hasBackup ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        📤 Cambiar imagen
                        <input type="file" data-block-idx="${index}" accept="image/*" style="display:none;" ${disabledAttr}>
                    </label>
                    <div id="upload-status-${index}" style="font-size: 11px; color: var(--success); display: none;"></div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // BLOCK CHANGE HANDLERS
    // =========================================================================

    function handleBlockChange(e) {
        const idx = parseInt(e.target.dataset.blockIdx);
        const block = state.currentBlocks[idx];
        if (!block) return;

        block.current = e.target.value;
        state.hasChanges = true;
        updateEditorStatus();

        // 1. Sincronización de texto instantánea
        syncToIframe(block);
        
        // 2. Scroll automático al bloque para feedback visual inmediato
        scrollToIframe(block.original, block.type === 'image' ? block.original : null);
    }

    async function handleImageUpload(e) {
        const idx = parseInt(e.target.dataset.blockIdx);
        const block = state.currentBlocks[idx];
        if (!block || !e.target.files.length) return;

        const file = e.target.files[0];
        const statusEl = $(`#upload-status-${idx}`);

        statusEl.style.display = 'block';
        statusEl.style.color = 'var(--text-accent)';
        statusEl.textContent = '⏳ Subiendo imagen...';

        try {
            const result = await wpClient.uploadImage(file);

            if (result.success) {
                if (block.isMediaId) {
                    block.current = String(result.data.id);
                } else {
                    block.current = result.data.url;
                }

                state.hasChanges = true;
                updateEditorStatus();

                statusEl.style.color = 'var(--success)';
                statusEl.textContent = `✅ Subida: ${result.data.url.split('/').pop()}`;

                const thumbWrap = $(`#block-thumb-${idx}`);
                if (thumbWrap) {
                    thumbWrap.innerHTML = `<img class="block-item__thumb" src="${escapeHtml(result.data.url)}" alt="Imagen nueva">`;
                }

                toast('Imagen subida correctamente', 'success');
            } else {
                statusEl.style.color = 'var(--danger)';
                statusEl.textContent = '❌ Error: ' + (result.error || 'Desconocido');
                toast('Error al subir imagen', 'error');
            }
        } catch (err) {
            statusEl.style.color = 'var(--danger)';
            statusEl.textContent = '❌ ' + err.message;
            toast('Error de red al subir imagen', 'error');
        }
    }

    function updateEditorStatus() {
        const changedCount = state.currentBlocks.filter(b => b.current !== b.original).length;
        const statusText = $('#editor-status-text');
        const saveBtn = $('#btn-save-draft');

        if (changedCount > 0) {
            statusText.textContent = `${changedCount} bloque(s) modificado(s)`;
            statusText.style.color = 'var(--warning)';
            saveBtn.disabled = false;
        } else {
            statusText.textContent = 'Sin cambios';
            statusText.style.color = 'var(--text-muted)';
            saveBtn.disabled = true;
        }
    }

    // =========================================================================
    // AI REWRITE
    // =========================================================================

    window.appAIRewrite = async function (blockIdx) {
        const block = state.currentBlocks[blockIdx];
        if (!block || !state.aiConfigured) {
            toast('Configura la IA primero (botón 🤖 arriba)', 'warning');
            return;
        }

        const textToRewrite = block.current || block.original;
        if (!textToRewrite.trim()) {
            toast('El bloque está vacío', 'warning');
            return;
        }

        const btn = document.querySelector(`.block-item[data-idx="${blockIdx}"] .btn--ai`);
        const textarea = document.querySelector(`textarea[data-block-idx="${blockIdx}"]`);

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-sm"></span> Reescribiendo...';
        }

        try {
            const response = await fetch('api/ai-rewrite.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textToRewrite,
                    provider: state.aiProvider,
                    api_key: state.aiApiKey,
                    site_name: wpClient.siteInfo?.site_name || '',
                    page_title: state.currentPage?.title || '',
                    extra_context: state.aiExtraContext,
                    language: 'es',
                })
            });

            const result = await response.json();

            if (result.success && result.data?.rewritten) {
                const rewritten = result.data.rewritten;
                block.current = rewritten;
                state.hasChanges = true;

                if (textarea) {
                    textarea.value = rewritten;
                    textarea.rows = Math.max(2, Math.ceil(rewritten.length / 80));
                    textarea.style.borderColor = 'var(--ai-color)';
                    textarea.style.boxShadow = '0 0 0 3px rgba(167, 139, 250, 0.2)';
                    setTimeout(() => {
                        textarea.style.borderColor = '';
                        textarea.style.boxShadow = '';
                    }, 2000);
                }

                updateEditorStatus();
                toast('Texto reescrito con IA ✨', 'success');
            } else {
                toast('Error de IA: ' + (result.error || 'Respuesta vacía'), 'error');
            }
        } catch (err) {
            toast('Error al conectar con la IA: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '✨ Reescribir con IA';
            }
        }
    };

    window.appUndoBlock = function(idx) {
        const block = state.currentBlocks[idx];
        if (!block) return;

        block.current = block.original;
        renderBlocks(state.currentBlocks);
        resolveMediaThumbnails(state.currentBlocks);
        updateEditorStatus();

        // Sincronizar vuelta atrás con el iframe
        syncToIframe(block);

        // Hacer scroll para ver que ha vuelto a la normalidad
        scrollToIframe(block.original, block.type === 'image' ? block.original : null);

        toast('Bloque restaurado', 'info');
    };

    /**
     * Descargar imagen original para editarla localmente
     */
    window.appDownloadImage = function(idx, imageUrl) {
        if (!imageUrl) {
            toast('No hay imagen disponible para descargar', 'error');
            return;
        }

        // Extraer nombre de archivo de la URL
        const fileName = imageUrl.split('/').pop().split('?')[0] || 'imagen.jpg';

        // Verificar que la URL es válida (debe empezzar con http)
        if (!imageUrl.startsWith('http')) {
            toast('URL de imagen inválida. Inténtalo de nuevo en unos segundos.', 'error');
            console.error('URL inválida para descargar:', imageUrl);
            return;
        }

        // Crear enlace temporal para descarga
        const link = document.createElement('a');
        link.href = imageUrl;
        link.target = '_blank';
        link.download = fileName;

        // Intentar descarga
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast(`Descargando ${fileName}... Si no funciona, abre la imagen en pestaña nueva y guárdala manualmente.`, 'success');

        // Abrir también en pestaña nueva como fallback (por si el navegador bloquea la descarga)
        setTimeout(() => {
            window.open(imageUrl, '_blank');
        }, 500);
    };

    // =========================================================================
    // IFRAME SYNC & SCROLL
    // =========================================================================

    function syncToIframe(block) {
        const iframe = $('#preview-iframe');
        if (!iframe || !iframe.contentWindow) return;

        iframe.contentWindow.postMessage({
            type: 'wpe-update-text',
            original: block.original,
            current: block.current
        }, '*');
    }

    function scrollToIframe(text, src = null) {
        const iframe = $('#preview-iframe');
        if (!iframe || !iframe.contentWindow) return;

        iframe.contentWindow.postMessage({
            type: 'wpe-scroll-to',
            text: text,
            src: src
        }, '*');
    }

    // =========================================================================
    // BACKUP (DUPLICAR PÁGINA)
    // =========================================================================

    async function handleCreateBackup() {
        if (!state.currentPage) return;

        const confirmed = await customConfirm(
            `Se duplicará la página "${state.currentPage.title}" como copia de seguridad.\n\n` +
            `• Se creará una copia de seguridad como ayuda externa.\n` +
            `• Tú seguirás editando la página actual en modo PUBLICADO.\n` +
            `• Esto garantiza que los cambios se vean al instante.\n\n` +
            `¿Deseas continuar?`,
            'Crear backup de seguridad',
            '🛡️'
        );
        if (!confirmed) return;

        showLoading('Duplicando página y creando backup...');

        try {
            const result = await wpClient.createBackup(
                state.currentPage.id,
                state.currentFilter
            );

            if (result.success) {
                state.backupId = result.data.backup_id;

                // Guardar backupId en sessionStorage para persistir entre navegaciones
                const savedBackups = JSON.parse(sessionStorage.getItem('wp_backup_ids') || '{}');
                savedBackups[state.currentPage.id] = result.data.backup_id;
                sessionStorage.setItem('wp_backup_ids', JSON.stringify(savedBackups));

                updateBackupBanner();
                // IMPORTANTE: Re-renderizar bloques para habilitar edición
                renderBlocks(state.currentBlocks);
                resolveMediaThumbnails(state.currentBlocks);
                toast(`🛡️ Backup creado (ID: ${result.data.backup_id}). Edición habilitada.`, 'success');
            } else {
                toast('Error al crear backup: ' + (result.error || ''), 'error');
            }
        } catch (err) {
            toast('Error: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // =========================================================================
    // GUARDAR COMO BORRADOR
    // =========================================================================

    async function handleSaveDraft() {
        if (!state.currentPage || !state.parser) return;

        const changedBlocks = state.currentBlocks.filter(b => b.current !== b.original);
        if (changedBlocks.length === 0) {
            toast('No hay cambios para guardar', 'warning');
            return;
        }

        // Si no hay backup, advertir
        let message = `Se guardarán ${changedBlocks.length} cambio(s) directamente en la página PUBLICADA.\n\n`;
        if (!state.backupId) {
            message += `⚠️ No se ha creado un backup previo.\nSe creará un backup automático antes de guardar.\n\n`;
        } else {
            message += `✅ Backup existente (ID: ${state.backupId}).\n\n`;
        }
        message += `¿Deseas aplicar estos cambios ahora?`;

        const confirmed = await customConfirm(message, 'Guardar Cambios', '💾');
        if (!confirmed) return;

        showLoading('Guardando cambios como borrador...');

        try {
            let contentToUse = state.originalContent;
            if (state.currentPage.builder.name === 'elementor' || state.currentPage.builder.name === 'classic') {
                contentToUse = state.currentPage.content_rendered || state.originalContent;
            }

            const newContent = state.parser.reconstruct(contentToUse, state.currentBlocks);

            const result = await wpClient.updateContent(
                state.currentPage.id,
                newContent,
                state.currentFilter,
                state.backupId ? true : false // skip_backup si ya tenemos uno
            );

            if (result.success) {
                state.backupId = (result.data.backup && result.data.backup.backup_id !== 'skipped') 
                    ? result.data.backup.backup_id 
                    : state.backupId;
                
                state.hasChanges = false;

                // Actualizar UI
                updateBackupBanner();
                updateEditorStatus();
                
                // REFRESCAR IFRAME (sin salir del editor)
                const iframe = $('#preview-iframe');
                if (iframe) {
                    const currentSrc = iframe.src;
                    iframe.src = 'about:blank'; // Flash effect para confirmar recarga
                    setTimeout(() => {
                        iframe.src = currentSrc;
                    }, 50);
                }

                toast('¡Cambios guardados y vista previa actualizada! ✅', 'success');
            } else {
                toast('Error al guardar: ' + (result.error || 'Desconocido'), 'error');
            }
        } catch (err) {
            toast('Error: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }


    // =========================================================================
    // RESET CHANGES
    // =========================================================================

    async function handleResetChanges() {
        if (!state.currentBlocks.length) return;

        const confirmed = await customConfirm(
            '¿Deshacer todos los cambios?\n\nSe restaurarán los textos originales. Las ediciones no guardadas se perderán.',
            'Deshacer cambios',
            '↩️'
        );
        if (!confirmed) return;

        state.currentBlocks.forEach(b => {
            b.current = b.original;
        });
        renderBlocks(state.currentBlocks);
        resolveMediaThumbnails(state.currentBlocks);
        state.hasChanges = false;
        updateEditorStatus();
        toast('Cambios deshechos', 'info');
    }

    // =========================================================================
    // EVENT BINDINGS
    // =========================================================================

    function init() {
        loadAISettings();
        setupPreviewNavigation();

        // Formulario de conexión
        $('#connect-form').addEventListener('submit', handleConnect);

        // Filtros (Páginas / Posts)
        $$('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                $$('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.currentFilter = tab.dataset.filter;
                loadPages();
            });
        });

        // Búsqueda
        $('#search-pages').addEventListener('input', handleSearch);

        // Refrescar
        $('#btn-refresh').addEventListener('click', loadPages);

        // Desconectar
        $('#btn-disconnect').addEventListener('click', () => {
            wpClient.clearCredentials();
            updateConnectionStatus(false);
            state.allPages = [];
            state.currentPage = null;
            showScreen('connect');
            toast('Desconectado', 'info');
        });

        // Volver de editor a lista
        $('#btn-back-to-pages').addEventListener('click', async () => {
            if (state.hasChanges) {
                const sure = await customConfirm(
                    'Tienes cambios sin guardar. Si sales ahora se perderán.',
                    '¿Salir del editor?',
                    '🚪'
                );
                if (!sure) return;
            }
            state.currentPage = null;
            state.currentBlocks = [];
            state.hasChanges = false;
            state.backupId = null;
            $('#search-blocks').value = '';
            showScreen('pages');
        });

        // Crear backup (botón toolbar)
        $('#btn-create-backup').addEventListener('click', handleCreateBackup);

        // Crear backup (botón del banner de advertencia)
        $('#btn-banner-backup').addEventListener('click', handleCreateBackup);

        // Toggle AI panel
        $('#btn-ai-toggle').addEventListener('click', () => {
            const panel = $('#ai-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        // AI provider tabs
        $$('.ai-provider-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                state.aiProvider = tab.dataset.provider;
                updateAIUI();
            });
        });

        // Save AI settings
        $('#btn-save-ai').addEventListener('click', saveAISettings);

        // Guardar como borrador
        $('#btn-save-draft').addEventListener('click', handleSaveDraft);

        // Reset cambios
        $('#btn-reset-changes').addEventListener('click', handleResetChanges);

        // Búsqueda de bloques
        if ($('#search-blocks')) {
            $('#search-blocks').addEventListener('input', handleBlockSearch);
        }

        // Editar slug
        if ($('#btn-edit-slug')) {
            $('#btn-edit-slug').addEventListener('click', async () => {
                if (!state.currentPage) return;

                const currentSlug = state.currentPage.slug;
                const newSlug = prompt('Introduce el nuevo enlace (slug) para esta página:', currentSlug);

                if (newSlug !== null && newSlug.trim() !== '' && newSlug.trim() !== currentSlug) {
                    showLoading('Actualizando slug...');
                    try {
                        const result = await wpClient.apiCall('update-content.php', {
                            page_id: state.currentPage.id,
                            content: state.currentPage.content_raw,
                            type: state.currentFilter,
                            title: state.currentPage.title,
                            slug: newSlug.trim()
                        });

                        if (result.success) {
                            state.currentPage.slug = newSlug.trim();
                            $('#editor-page-url').textContent = `/${state.currentPage.slug}`;
                            toast('Enlace actualizado correctamente', 'success');
                        } else {
                            toast('Error al actualizar slug: ' + (result.error || ''), 'error');
                        }
                    } catch (err) {
                        toast('Error de conexión: ' + err.message, 'error');
                    } finally {
                        hideLoading();
                    }
                }
            });
        }

        // Auto-reconectar si hay credenciales guardadas
        if (wpClient.loadCredentials()) {
            showLoading('Reconectando...');
            wpClient.apiCall('connect.php').then(result => {
                hideLoading();
                if (result.success) {
                    wpClient.siteInfo = result.data;
                    updateConnectionStatus(true, result.data.site_name);
                    $('#site-name-title').textContent = result.data.site_name;
                    showScreen('pages');
                    loadPages();
                } else {
                    wpClient.clearCredentials();
                    showScreen('connect');
                }
            }).catch(() => {
                hideLoading();
                wpClient.clearCredentials();
                showScreen('connect');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
