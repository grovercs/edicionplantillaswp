/**
 * Parser: WPBakery / Visual Composer
 * Extrae textos e imágenes de shortcodes [vc_*]
 */
window.WPBakeryParser = {
    name: 'wpbakery',

    /**
     * Parsear contenido raw con shortcodes WPBakery
     * @param {string} content - Contenido raw del post
     * @returns {Array} - Array de bloques editables
     */
    parse(content) {
        const blocks = [];
        if (!content) return blocks;

        // Extraer textos de [vc_column_text]...[/vc_column_text]
        const textRegex = /\[vc_column_text([^\]]*)\]([\s\S]*?)\[\/vc_column_text\]/gi;
        let match;
        let idx = 0;

        while ((match = textRegex.exec(content)) !== null) {
            const attrs = match[1];
            const innerContent = match[2].trim();
            if (innerContent) {
                blocks.push({
                    id: `vc_text_${idx}`,
                    type: 'text',
                    label: 'Texto',
                    original: innerContent,
                    current: innerContent,
                    shortcode: 'vc_column_text',
                    fullMatch: match[0],
                    attrs: attrs
                });
                idx++;
            }
        }

        // Extraer títulos/headings de [vc_custom_heading]
        const headingRegex = /\[vc_custom_heading([^\]]*)\]/gi;
        while ((match = headingRegex.exec(content)) !== null) {
            const attrs = match[1];
            const textMatch = attrs.match(/text="([^"]*)"/);
            // Detect heading tag from font_container or use_theme_fonts
            const tagMatch = attrs.match(/font_container="tag:([^|"]*)[|"]/)
                          || attrs.match(/tag="([^"]*)"/);
            const headingTag = tagMatch ? tagMatch[1].toLowerCase() : 'h2';
            if (textMatch && textMatch[1]) {
                blocks.push({
                    id: `vc_heading_${idx}`,
                    type: 'heading',
                    label: `Encabezado (${headingTag.toUpperCase()})`,
                    original: textMatch[1],
                    current: textMatch[1],
                    shortcode: 'vc_custom_heading',
                    fullMatch: match[0],
                    attrs: attrs,
                    tagName: headingTag
                });
                idx++;
            }
        }

        // Extraer imágenes de [vc_single_image]
        const imgRegex = /\[vc_single_image([^\]]*)\]/gi;
        while ((match = imgRegex.exec(content)) !== null) {
            const attrs = match[1];
            const srcMatch = attrs.match(/image="(\d+)"/);
            const imgUrlMatch = attrs.match(/img_link_target="([^"]*)"/);
            if (srcMatch) {
                blocks.push({
                    id: `vc_img_${idx}`,
                    type: 'image',
                    label: 'Imagen',
                    original: srcMatch[1], // Media ID
                    current: srcMatch[1],
                    shortcode: 'vc_single_image',
                    fullMatch: match[0],
                    attrs: attrs,
                    isMediaId: true
                });
                idx++;
            }
        }

        // Extraer botones de [vc_btn]
        const btnRegex = /\[vc_btn([^\]]*)\]/gi;
        while ((match = btnRegex.exec(content)) !== null) {
            const attrs = match[1];
            const titleMatch = attrs.match(/title="([^"]*)"/);
            if (titleMatch && titleMatch[1]) {
                blocks.push({
                    id: `vc_btn_${idx}`,
                    type: 'button',
                    label: 'Botón',
                    original: titleMatch[1],
                    current: titleMatch[1],
                    shortcode: 'vc_btn',
                    fullMatch: match[0],
                    attrs: attrs
                });
                idx++;
            }
        }

        return blocks;
    },

    /**
     * Reconstruir el contenido con los cambios aplicados
     * @param {string} originalContent - Contenido raw original
     * @param {Array} blocks - Bloques con cambios (current != original)
     * @returns {string} - Contenido actualizado
     */
    reconstruct(originalContent, blocks) {
        let content = originalContent;

        for (const block of blocks) {
            if (block.current === block.original) continue; // Sin cambios

            if (block.type === 'text') {
                // Reemplazar contenido entre las tags
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(block.original, block.current);
                content = content.replace(oldFull, newFull);
            } else if (block.type === 'heading') {
                // Reemplazar atributo text=""
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(`text="${block.original}"`, `text="${block.current}"`);
                content = content.replace(oldFull, newFull);
            } else if (block.type === 'button') {
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(`title="${block.original}"`, `title="${block.current}"`);
                content = content.replace(oldFull, newFull);
            } else if (block.type === 'image') {
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(`image="${block.original}"`, `image="${block.current}"`);
                content = content.replace(oldFull, newFull);
            }
        }

        return content;
    }
};
