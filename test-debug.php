<?php
$url = "https://aranguau.com/?page_id=2594&preview=true";
$user = "admin_test";
$pass = "xQuG 3xk6 VaAw 436j HJaX Cr1E";

echo "Probando conexión con: $url\n";
echo "Usuario: $user\n";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPAUTH       => CURLAUTH_BASIC,
    CURLOPT_USERPWD        => "$user:$pass",
    CURLOPT_VERBOSE        => true,
    CURLOPT_HEADER         => true,
]);

$response = curl_exec($ch);
$info = curl_getinfo($ch);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    echo "ERROR CURL: $error\n";
} else {
    echo "HTTP CODE: " . $info['http_code'] . "\n";
    echo "URL FINAL: " . $info['url'] . "\n";
    echo "--- RESPUESTA (primeros 500 bytes) ---\n";
    echo substr($response, 0, 500);
}
?>
