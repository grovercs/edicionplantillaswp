<?php
/**
 * Proxy Preview: Carga una página remota y la sirve localmente
 * para evitar restricciones de X-Frame-Options y CORS en iframes.
 * 
 * v2: Inyecta JS interactivo para que al hacer clic en elementos
 * del preview se navegue al bloque correspondiente en el editor.
 */

$url = $_GET['url'] ?? '';

if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body style="font-family:sans-serif;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a2035;"><p>URL inválida o no proporcionada</p></body></html>';
    exit;
}

$ch = curl_init($url);
$curlOptions = [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Soporte para autenticación (ver borradores)
$user = $_GET['user'] ?? '';
$pass = $_GET['pass'] ?? '';
if ($user && $pass) {
    $curlOptions[CURLOPT_HTTPAUTH] = CURLAUTH_BASIC;
    $curlOptions[CURLOPT_USERPWD] = $user . ':' . $pass;
}

curl_setopt_array($ch, $curlOptions);

$html = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
$error = curl_error($ch);
curl_close($ch);

if ($error || $httpCode >= 400 || !$html) {
    http_response_code($httpCode >= 400 ? 502 : 502); // Mantenemos 502 para errores de proxy
    $errorMsg = $error ?: "HTTP $httpCode";
    echo '<!DOCTYPE html><html><body style="font-family:sans-serif;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a2035;flex-direction:column;gap:8px;"><p style="font-size:32px;">⚠️</p><p>No se pudo cargar la vista previa</p><p style="font-size:12px;">' . htmlspecialchars($errorMsg) . ' — ' . htmlspecialchars($url) . '</p></body></html>';
    exit;
}

// Extraer la base URL del sitio
$parsed = parse_url($finalUrl);
$baseUrl = $parsed['scheme'] . '://' . $parsed['host'];

// Inyectar <base> tag para que los recursos relativos carguen correctamente
if (stripos($html, '<base') === false) {
    $html = preg_replace('/<head([^>]*)>/i', '<head$1><base href="' . $baseUrl . '/">', $html, 1);
}

// Reescribir URLs relativas tipo src="/..." y href="/..."
$html = preg_replace('/(href|src|action)="\/((?!\/)[^"]*)"/', '$1="' . $baseUrl . '/$2"', $html);
$html = preg_replace("/(href|src|action)='\/((?!\/)[^']*)'/", "$1='" . $baseUrl . "/$2'", $html);

// Eliminar meta tags de X-Frame-Options
$html = preg_replace('/<meta[^>]*http-equiv=["\']X-Frame-Options["\'][^>]*>/i', '', $html);

// ============================================================================
// INYECTAR: CSS de interactividad + JS para comunicación con el editor
// ============================================================================
$injectCSS = '<style>
/* Ocultar elementos que molesten en el preview */
.cookie-notice, .gdpr-notice, .popup-overlay, #cookie-notice,
[class*="cookie-"], [class*="popup"], [id*="cookie"],
.chat-widget, .whatsapp-widget, [class*="whatsapp"],
.admin-bar { display: none !important; }

/* Highlight interactivo en los elementos de texto */
.wpe-hoverable {
    cursor: pointer !important;
    transition: outline 0.15s ease, background 0.15s ease !important;
    pointer-events: auto !important;
}
.wpe-hoverable:hover {
    outline: 2px solid rgba(99, 102, 241, 0.6) !important;
    outline-offset: 2px !important;
    background: rgba(99, 102, 241, 0.08) !important;
}
.wpe-flash {
    outline: 3px solid rgba(99, 102, 241, 0.9) !important;
    outline-offset: 2px !important;
    background: rgba(99, 102, 241, 0.15) !important;
}

/* Tooltip */
.wpe-tooltip {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(99, 102, 241, 0.95);
    color: white;
    font-family: Inter, sans-serif;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 8px;
    z-index: 999999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.wpe-tooltip.visible { opacity: 1; }
</style>';

$injectJS = '<script>
(function() {
    "use strict";

    // Crear tooltip
    var tooltip = document.createElement("div");
    tooltip.className = "wpe-tooltip";
    tooltip.textContent = "Haz clic para editar";
    document.body.appendChild(tooltip);

    // Seleccionamos elementos comunes de texto editables
    var selectors = "p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, span, strong, b, em, label, dt, dd, .btn, a.button";

    window.addEventListener("message", function(event) {
        var data = event.data;
        if (!data || !data.type) return;

        if (data.type === "wpe-update-text") {
            // Actualizar texto en vivo sin recargar
            var elements = findElementsByText(data.original);
            elements.forEach(function(el) {
                el.innerText = data.current;
                flashElement(el);
            });
        }

        if (data.type === "wpe-scroll-to") {
            // Hacer scroll hasta el elemento
            var elements = findElementsByText(data.text) || findElementsBySrc(data.src);
            if (elements && elements.length > 0) {
                elements[0].scrollIntoView({ behavior: "smooth", block: "center" });
                flashElement(elements[0]);
            }
        }
    });

    function findElementsByText(text) {
        if (!text) return [];
        var normalizedSearch = text.trim().substring(0, 50).toLowerCase();
        return Array.from(document.querySelectorAll(selectors)).filter(function(el) {
            return el.textContent.trim().toLowerCase().includes(normalizedSearch);
        });
    }

    function findElementsBySrc(src) {
        if (!src) return [];
        var filename = src.split("/").pop();
        return Array.from(document.querySelectorAll("img")).filter(function(img) {
            return (img.src && img.src.includes(filename)) || (img.dataset.src && img.dataset.src.includes(filename));
        });
    }

    function flashElement(el) {
        el.classList.add("wpe-flash");
        setTimeout(function() { el.classList.remove("wpe-flash"); }, 800);
    }

    // Seleccionar elementos de texto editables
    var textEls = document.querySelectorAll(selectors);

    textEls.forEach(function(el) {
        var text = el.textContent.trim();
        if (text.length > 2 && !el.closest("script") && !el.closest("style") && !el.closest("nav")) {
            el.classList.add("wpe-hoverable");

            el.addEventListener("mouseenter", function() {
                tooltip.classList.add("visible");
            });

            el.addEventListener("mouseleave", function() {
                tooltip.classList.remove("visible");
            });

            el.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                flashElement(el);

                window.parent.postMessage({
                    type: "preview-click",
                    text: el.textContent.trim()
                }, "*");
            });
        }
    });

    // También hacer imágenes clickeables
    document.querySelectorAll("img").forEach(function(img) {
        if (img.width > 30 || img.height > 30) {
            img.classList.add("wpe-hoverable");
            img.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                flashElement(img);

                window.parent.postMessage({
                    type: "preview-click-image",
                    src: img.src || img.dataset.src || ""
                }, "*");
            });
        }
    });
})();
</script>
';

$html = str_replace('</head>', $injectCSS . '</head>', $html);
$html = str_replace('</body>', $injectJS . '</body>', $html);

// Servir como HTML
header('Content-Type: text/html; charset=UTF-8');
header('X-Frame-Options: ALLOWALL');
echo $html;
