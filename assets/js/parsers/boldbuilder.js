/**
 * Parser: Bold Builder
 * Extrae textos e imágenes de shortcodes [bt_bb_*]
 */
window.BoldBuilderParser = {
    name: 'boldbuilder',

    parse(content) {
        const blocks = [];
        if (!content) return blocks;
        let idx = 0;

        // Textos: [bt_bb_headline]...[/bt_bb_headline], [bt_bb_text]...[/bt_bb_text]
        const textTags = ['bt_bb_text', 'bt_bb_custom_text'];
        for (const tag of textTags) {
            const textRegex = new RegExp(`\\[${tag}([^\\]]*)\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'gi');
            let match;
            while ((match = textRegex.exec(content)) !== null) {
                const innerContent = match[2].trim();
                if (innerContent) {
                    blocks.push({
                        id: `bb_text_${idx}`,
                        type: 'text',
                        label: 'Texto',
                        original: innerContent,
                        current: innerContent,
                        shortcode: tag,
                        fullMatch: match[0],
                        attrs: match[1]
                    });
                    idx++;
                }
            }
        }

        // Headlines: [bt_bb_headline] — el texto puede estar en atributo o contenido
        // Soportamos tanto [tag]...[/tag] como [tag /]
        const headlineRegex = /\[bt_bb_headline([^\]]*)\](?:([\s\S]*?)\[\/bt_bb_headline\])?/gi;
        let match;
        while ((match = headlineRegex.exec(content)) !== null) {
            const attrs = match[1];
            const innerContent = (match[2] || "").trim();
            // Usamos \b para evitar que 'superheadline' coincida con 'headline'
            const headlineMatch = attrs.match(/\bheadline="([^"]*)"/);
            const superMatch = attrs.match(/\bsuperheadline="([^"]*)"/);
            const subMatch = attrs.match(/\bsubheadline="([^"]*)"/);
            // Detect heading tag (h1-h6)
            const tagMatch = attrs.match(/\bhtml_tag="([^"]*)"/);
            const headingTag = tagMatch ? tagMatch[1].toLowerCase() : 'h2';

            if (headlineMatch && headlineMatch[1]) {
                blocks.push({
                    id: `bb_headline_${idx}`,
                    type: 'heading',
                    label: `Encabezado (${headingTag.toUpperCase()})`,
                    original: headlineMatch[1],
                    current: headlineMatch[1],
                    shortcode: 'bt_bb_headline',
                    fullMatch: match[0],
                    attrs: attrs,
                    attrName: 'headline',
                    tagName: headingTag
                });
                idx++;
            }
            if (superMatch && superMatch[1]) {
                blocks.push({
                    id: `bb_super_${idx}`,
                    type: 'heading',
                    label: 'Super-encabezado',
                    original: superMatch[1],
                    current: superMatch[1],
                    shortcode: 'bt_bb_headline',
                    fullMatch: match[0],
                    attrs: attrs,
                    attrName: 'superheadline',
                    tagName: 'span'
                });
                idx++;
            }
            if (subMatch && subMatch[1]) {
                blocks.push({
                    id: `bb_sub_${idx}`,
                    type: 'heading',
                    label: 'Sub-encabezado',
                    original: subMatch[1],
                    current: subMatch[1],
                    shortcode: 'bt_bb_headline',
                    fullMatch: match[0],
                    attrs: attrs,
                    attrName: 'subheadline',
                    tagName: 'span'
                });
                idx++;
            }
            // Si hay contenido dentro del shortcode
            if (innerContent && !headlineMatch) {
                blocks.push({
                    id: `bb_hlcontent_${idx}`,
                    type: 'text',
                    label: 'Contenido de encabezado',
                    original: innerContent,
                    current: innerContent,
                    shortcode: 'bt_bb_headline',
                    fullMatch: match[0],
                    attrs: attrs
                });
                idx++;
            }
        }

        // Imágenes: [bt_bb_image]
        const imgRegex = /\[bt_bb_image([^\]]*)\]/gi;
        while ((match = imgRegex.exec(content)) !== null) {
            const attrs = match[1];
            const srcMatch = attrs.match(/image="(\d+)"/) || attrs.match(/image="([^"]*)"/);
            if (srcMatch) {
                blocks.push({
                    id: `bb_img_${idx}`,
                    type: 'image',
                    label: 'Imagen',
                    original: srcMatch[1],
                    current: srcMatch[1],
                    shortcode: 'bt_bb_image',
                    fullMatch: match[0],
                    attrs: attrs,
                    isMediaId: /^\d+$/.test(srcMatch[1])
                });
                idx++;
            }
        }

        // Botones: [bt_bb_button]
        const btnRegex = /\[bt_bb_button([^\]]*)\]/gi;
        while ((match = btnRegex.exec(content)) !== null) {
            const attrs = match[1];
            const textMatch = attrs.match(/text="([^"]*)"/);
            if (textMatch && textMatch[1]) {
                blocks.push({
                    id: `bb_btn_${idx}`,
                    type: 'button',
                    label: 'Botón',
                    original: textMatch[1],
                    current: textMatch[1],
                    shortcode: 'bt_bb_button',
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

            if (block.type === 'text') {
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(block.original, block.current);
                content = content.replace(oldFull, newFull);
            } else if (block.type === 'heading' && block.attrName) {
                const oldFull = block.fullMatch;
                // Usamos un regex para reemplazar SOLAMENTE el atributo exacto (con límite de palabra \b)
                // Esto evita que 'headline=' se confunda con 'superheadline='
                const attrRegex = new RegExp(`\\b${block.attrName}="` + block.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `"`, "i");
                const newAttrText = `${block.attrName}="${block.current}"`;
                
                const newFull = oldFull.replace(attrRegex, newAttrText);
                content = content.replace(oldFull, newFull);
            } else if (block.type === 'button') {
                const oldFull = block.fullMatch;
                const newFull = oldFull.replace(`text="${block.original}"`, `text="${block.current}"`);
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
