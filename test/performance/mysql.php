<?php

// mysql.php takes 1 sec for 10,000 records and 10 secs for 100,000 records. That's pretty fast!

define('HOST', 'localhost');
define('USER', 'user');
define('PASSWORD', 'secret');
define('N', 10000); // num records

$mysqli = new mysqli(HOST, USER, PASSWORD);

$mysqli->multi_query("DROP DATABASE IF EXISTS deltadb");

$mysqli->multi_query("CREATE DATABASE deltadb");

$mysqli->multi_query("USE deltadb");

$mysqli->multi_query("
	CREATE TABLE `queue_attrs` (
	  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
	  `col_name` varchar(100) NOT NULL,
	  `doc_uuid` varbinary(38) NOT NULL,
	  `attr_name` varchar(100) NOT NULL,
	  `attr_val` text NOT NULL,
	  `user_uuid` varbinary(36) NOT NULL,
	  `super_uuid` varbinary(36) NOT NULL,
	  `created_at` datetime NOT NULL,
	  `recorded_at` datetime NOT NULL,
	  `updated_at` datetime NOT NULL,
	  `seq` smallint(6) NOT NULL,
	  `quorum` tinyint(1) NOT NULL,
	  PRIMARY KEY (`id`)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8;
");

$start = microtime(true);

for ($i = 0; $i < N; $i++) {
	$mysqli->multi_query("
		INSERT INTO `deltadb`.`queue_attrs` (`id`, `col_name`, `doc_uuid`, `attr_name`, `attr_val`,
			`user_uuid`, `super_uuid`, `created_at`, `recorded_at`, `updated_at`, `seq`, `quorum`)
		VALUES (NULL, 'some-col', 'doc-uuid', 'priority', 'high', 'user-uuid', 'super-uuid', NOW(),
			NOW(), NOW(), '0', '1')
	");
}

echo "compeleted after " . (microtime(true) - $start) . " seconds";
