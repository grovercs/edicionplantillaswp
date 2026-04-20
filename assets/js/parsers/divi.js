/**
 * Parser: Divi Builder
 * Extrae textos e imágenes de shortcodes [et_pb_*]
 */
window.DiviParser = {
    name: 'divi',

    parse(content) {
        const blocks = [];
        if (!content) return blocks;
        let idx = 0;
        let match;

        // Textos: [et_pb_text]...[/et_pb_text]
        const textRegex = /\[et_pb_text([^\]]*)\]([\s\S]*?)\[\/et_pb_text\]/gi;
        while ((match = textRegex.exec(content)) !== null) {
            const innerContent = match[2].trim();
            if (innerContent) {
                blocks.push({
                    id: `divi_text_${idx}`,
                    type: 'text',
                    label: 'Texto',
                    original: innerContent,
                    current: innerContent,
                    shortcode: 'et_pb_text',
                    fullMatch: match[0],
                    attrs: match[1]
                });
                idx++;
            }
        }

        // Títulos: En Divi los headings suelen ir dentro de et_pb_text como <h1>-<h6>
        // También pueden ser et_pb_post_title o usar admin_label

        // Imágenes: [et_pb_image]
        const imgRegex = /\[et_pb_image([^\]]*)\]/gi;
        while ((match = imgRegex.exec(content)) !== null) {
            const attrs = match[1];
            const srcMatch = attrs.match(/src="([^"]*)"/);
            if (srcMatch && srcMatch[1]) {
                blocks.push({
                    id: `divi_img_${idx}`,
                    type: 'image',
                    label: 'Imagen',
                    original: srcMatch[1],
                    current: srcMatch[1],
                    shortcode: 'et_pb_image',
                    fullMatch: match[0],
                    attrs: attrs,
                    isUrl: true
                });
                idx++;
            }
        }

        // Botones: [et_pb_button]
        const btnRegex = /\[et_pb_button([^\]]*)\]/gi;
        while ((match = btnRegex.exec(content)) !== null) {
            const attrs = match[1];
            const textMatch = attrs.match(/button_text="([^"]*)"/);
            if (textMatch && textMatch[1]) {
                blocks.push({
                    id: `divi_btn_${idx}`,
                    type: 'button',
                    label: 'Botón',
                    original: textMatch[1],
                    current: textMatch[1],
                    shortcode: 'et_pb_button',
                    fullMatch: match[0],
                    attrs: attrs
                });
                idx++;
            }
        }

        // Blurbs (icon+text blocks): [et_pb_blurb]...[/et_pb_blurb]
        const blurbRegex = /\[et_pb_blurb([^\]]*)\]([\s\S]*?)\[\/et_pb_blurb\]/gi;
        while ((match = blurbRegex.exec(content)) !== null) {
            const attrs = match[1];
            const innerContent = match[2].trim();
            const titleMatch = attrs.match(/title="([^"]*)"/);
            
            if (titleMatch && titleMatch[1]) {
                blocks.push({
                    id: `divi_blurb_title_${idx}`,
                    type: 'heading',
                    label: 'Título de blurb',
                    original: titleMatch[1],
                    current: titleMatch[1],
                    shortcode: 'et_pb_blurb',
                    fullMatch: match[0],
                    attrs: attrs,
                    attrName: 'title'
                });
                idx++;
            }
            if (innerContent) {
                blocks.push({
                    id: `divi_blurb_text_${idx}`,
                    type: 'text',
                    label: 'Texto de blurb',
                    original: innerContent,
                    current: innerContent,
                    shortcode: 'et_pb_blurb',
                    fullMatch: match[0],
                    attrs: attrs
                });
                idx++;
            }
        }

        // Sliders: [et_pb_slide]
        const slideRegex = /\[et_pb_slide([^\]]*)\]([\s\S]*?)\[\/et_pb_slide\]/gi;
        while ((match = slideRegex.exec(content)) !== null) {
            const attrs = match[1];
            const innerContent = match[2].trim();
            const headingMatch = attrs.match(/heading="([^"]*)"/);
            
            if (headingMatch && headingMatch[1]) {
                blocks.push({
                    id: `divi_slide_h_${idx}`,
                    type: 'heading',
                    label: 'Título de slide',
                    original: headingMatch[1],
                    current: headingMatch[1],
                    shortcode: 'et_pb_slide',
                    fullMatch: match[0],
                    attrs: attrs,
                    attrName: 'heading'
                });
                idx++;
            }
            if (innerContent) {
                blocks.push({
                    id: `divi_slide_t_${idx}`,
                    type: 'text',
                    label: 'Contenido de slide',
                    original: innerContent,
                    current: innerContent,
                    shortcode: 'et_pb_slide',
                    fullMatch: match[0],
                    attrs: attrs
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

            if (block.attrName) {
                // Cambio en atributo
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(`${block.attrName}="${block.original}"`, `${block.attrName}="${block.current}"`);
                content = content.replace(oldFull, newFull);
            } else if (block.type === 'button') {
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(`button_text="${block.original}"`, `button_text="${block.current}"`);
                content = content.replace(oldFull, newFull);
            } else if (block.type === 'image' && block.isUrl) {
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(`src="${block.original}"`, `src="${block.current}"`);
                content = content.replace(oldFull, newFull);
            } else {
                // Cambio en contenido entre tags
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(block.original, block.current);
                content = content.replace(oldFull, newFull);
            }
        }

        return content;
    }
};
