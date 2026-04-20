/**
 * Parser: Gutenberg (WordPress Block Editor)
 * Extrae textos e imágenes de bloques <!-- wp:* -->
 */
window.GutenbergParser = {
    name: 'gutenberg',

    parse(content) {
        const blocks = [];
        if (!content) return blocks;
        let idx = 0;
        let match;

        // Párrafos: <!-- wp:paragraph -->...<p>...</p>...<!-- /wp:paragraph -->
        const paraRegex = /<!-- wp:paragraph(\s*\{[^}]*\})?\s*-->\s*<p[^>]*>([\s\S]*?)<\/p>\s*<!-- \/wp:paragraph -->/gi;
        while ((match = paraRegex.exec(content)) !== null) {
            const text = match[2].trim();
            if (text && text.length > 3) {
                blocks.push({
                    id: `gb_p_${idx}`,
                    type: 'text',
                    label: 'Párrafo',
                    original: text,
                    current: text,
                    fullMatch: match[0],
                    blockType: 'paragraph'
                });
                idx++;
            }
        }

        // Headings: <!-- wp:heading -->...<h2>...</h2>...<!-- /wp:heading -->
        const headingRegex = /<!-- wp:heading(\s*\{[^}]*\})?\s*-->\s*<(h[1-6])[^>]*>([\s\S]*?)<\/\2>\s*<!-- \/wp:heading -->/gi;
        while ((match = headingRegex.exec(content)) !== null) {
            const text = match[3].trim();
            if (text) {
                blocks.push({
                    id: `gb_h_${idx}`,
                    type: 'heading',
                    label: `Encabezado (${match[2].toUpperCase()})`,
                    original: text,
                    current: text,
                    fullMatch: match[0],
                    tagName: match[2],
                    blockType: 'heading'
                });
                idx++;
            }
        }

        // Imágenes: <!-- wp:image -->...<img src="..." />...<!-- /wp:image -->
        const imgRegex = /<!-- wp:image(\s*\{[^}]*\})?\s*-->([\s\S]*?)<!-- \/wp:image -->/gi;
        while ((match = imgRegex.exec(content)) !== null) {
            const imgContent = match[2];
            const srcMatch = imgContent.match(/src="([^"]*)"/);
            const altMatch = imgContent.match(/alt="([^"]*)"/);
            if (srcMatch && srcMatch[1]) {
                blocks.push({
                    id: `gb_img_${idx}`,
                    type: 'image',
                    label: 'Imagen',
                    original: srcMatch[1],
                    current: srcMatch[1],
                    alt: altMatch ? altMatch[1] : '',
                    fullMatch: match[0],
                    blockType: 'image',
                    isUrl: true
                });
                idx++;
            }
        }

        // Botones: <!-- wp:button -->...<a>...</a>...<!-- /wp:button -->
        const btnRegex = /<!-- wp:button(\s*\{[^}]*\})?\s*-->([\s\S]*?)<!-- \/wp:button -->/gi;
        while ((match = btnRegex.exec(content)) !== null) {
            const btnContent = match[2];
            const textMatch = btnContent.match(/<a[^>]*>([\s\S]*?)<\/a>/);
            if (textMatch && textMatch[1].trim()) {
                blocks.push({
                    id: `gb_btn_${idx}`,
                    type: 'button',
                    label: 'Botón',
                    original: textMatch[1].trim(),
                    current: textMatch[1].trim(),
                    fullMatch: match[0],
                    blockType: 'button'
                });
                idx++;
            }
        }

        // Listas: <!-- wp:list -->...<ul>/<ol>...<!-- /wp:list -->
        const listRegex = /<!-- wp:list(\s*\{[^}]*\})?\s*-->([\s\S]*?)<!-- \/wp:list -->/gi;
        while ((match = listRegex.exec(content)) !== null) {
            const listHtml = match[2].trim();
            if (listHtml) {
                blocks.push({
                    id: `gb_list_${idx}`,
                    type: 'text',
                    label: 'Lista',
                    original: listHtml,
                    current: listHtml,
                    fullMatch: match[0],
                    blockType: 'list'
                });
                idx++;
            }
        }

        return blocks;
    },

    reconstruct(originalContent, blocks) {
        let content = originalContent;

        for (const block of blocks) {
            if (block.current === block.original) continue;

            if (block.type === 'image' && block.isUrl) {
                // Reemplazar URL de imagen dentro del bloque
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(block.original, block.current);
                content = content.replace(oldFull, newFull);
            } else {
                // Reemplazar texto dentro del bloque
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(block.original, block.current);
                content = content.replace(oldFull, newFull);
            }
        }

        return content;
    }
};
