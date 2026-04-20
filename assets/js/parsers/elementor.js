/**
 * Parser: Elementor
 * Extrae textos e imágenes del contenido renderizado (HTML)
 * Nota: El JSON de _elementor_data puede no estar disponible vía REST API sin plugin adicional,
 * así que parseamos el HTML renderizado como fallback.
 */
window.ElementorParser = {
    name: 'elementor',

    /**
     * Parsear contenido HTML renderizado de Elementor
     * Extrae: headings, textos, imágenes, botones
     */
    parse(content) {
        const blocks = [];
        if (!content) return blocks;
        let idx = 0;

        // Crear un DOM parser para trabajar con el HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        // Extraer headings (h1-h6)
        const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(h => {
            const text = h.textContent.trim();
            if (text && text.length > 1) {
                blocks.push({
                    id: `el_h_${idx}`,
                    type: 'heading',
                    label: `Encabezado (${h.tagName})`,
                    original: text,
                    current: text,
                    tagName: h.tagName.toLowerCase(),
                    htmlOriginal: h.innerHTML
                });
                idx++;
            }
        });

        // Extraer párrafos significativos
        const paragraphs = doc.querySelectorAll('p');
        paragraphs.forEach(p => {
            const text = p.textContent.trim();
            // Solo incluir párrafos con contenido real (más de 10 caracteres)
            if (text && text.length > 10) {
                blocks.push({
                    id: `el_p_${idx}`,
                    type: 'text',
                    label: 'Párrafo',
                    original: p.innerHTML.trim(),
                    current: p.innerHTML.trim(),
                    plainText: text
                });
                idx++;
            }
        });

        // Extraer listas
        const lists = doc.querySelectorAll('ul, ol');
        lists.forEach(list => {
            const items = Array.from(list.querySelectorAll('li'));
            const text = items.map(li => li.textContent.trim()).join('\n');
            if (text && text.length > 5) {
                blocks.push({
                    id: `el_list_${idx}`,
                    type: 'text',
                    label: `Lista (${items.length} items)`,
                    original: list.innerHTML.trim(),
                    current: list.innerHTML.trim(),
                    plainText: text
                });
                idx++;
            }
        });

        // Extraer imágenes
        const images = doc.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.includes('data:') && !src.includes('placeholder')) {
                blocks.push({
                    id: `el_img_${idx}`,
                    type: 'image',
                    label: 'Imagen',
                    original: src,
                    current: src,
                    alt: img.getAttribute('alt') || '',
                    isUrl: true
                });
                idx++;
            }
        });

        // Extraer botones/enlaces con texto
        const buttons = doc.querySelectorAll('a.elementor-button, .elementor-button-wrapper a, a[role="button"]');
        buttons.forEach(btn => {
            const text = btn.textContent.trim();
            if (text && text.length > 1) {
                blocks.push({
                    id: `el_btn_${idx}`,
                    type: 'button',
                    label: 'Botón',
                    original: text,
                    current: text,
                    href: btn.getAttribute('href') || '#'
                });
                idx++;
            }
        });

        return blocks;
    },

    /**
     * Reconstruir contenido HTML con los cambios
     * Para Elementor basado en HTML renderizado, hacemos búsqueda-reemplazo
     */
    reconstruct(originalContent, blocks) {
        let content = originalContent;

        for (const block of blocks) {
            if (block.current === block.original) continue;

            if (block.type === 'image' && block.isUrl) {
                // Reemplazar URL de imagen
                content = content.split(block.original).join(block.current);
            } else if (block.htmlOriginal) {
                // Para headings, reemplazar el innerHTML
                content = content.replace(block.htmlOriginal, block.current);
            } else {
                // Para texto, reemplazar directamente
                content = content.replace(block.original, block.current);
            }
        }

        return content;
    }
};
