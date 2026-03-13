<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$servername = "localhost";
$username = "u116771474_bot";
$password = "357691Jgt.";
$dbname = "u116771474_rltrader";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

echo "Attempting to TRUNCATE TABLE audit_events...<br>";
$sql = "TRUNCATE TABLE audit_events";
if ($conn->query($sql) === TRUE) {
  echo "TRUNCATE successful. Disk space should be reclaimed.<br>";
} else {
  echo "Error truncating: " . $conn->error . "<br>";
}

// Get size again
$sql = "
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size'
FROM information_schema.TABLES
WHERE table_schema = '$dbname'
ORDER BY (data_length + index_length) DESC;
";

$result = $conn->query($sql);
echo "<table border='1'><tr><th>Table Name</th><th>Size (MB)</th></tr>";
while($row = $result->fetch_assoc()) {
    echo "<tr><td>" . $row['Table'] . "</td><td>" . $row['Size'] . "</td></tr>";
}
echo "</table>";

$conn->close();
?>
