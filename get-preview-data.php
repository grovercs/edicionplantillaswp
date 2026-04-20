<?php
$id = 2594;
$url = "https://aranguau.com/wp-json/wp/v2/pages/$id?context=edit";
$user = "admin_test";
$pass = "xQuG 3xk6 VaAw 436j HJaX Cr1E";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPAUTH       => CURLAUTH_BASIC,
    CURLOPT_USERPWD        => "$user:$pass",
    CURLOPT_SSL_VERIFYPEER => false,
]);

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
echo "STATUS API: " . ($data['status'] ?? 'N/A') . "\n";
echo "PREVIEW LINK: " . ($data['preview_link'] ?? 'N/A') . "\n";
echo "LINK: " . ($data['link'] ?? 'N/A') . "\n";
?>
