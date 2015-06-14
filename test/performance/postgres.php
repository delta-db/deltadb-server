<?php

// Takes 5.5 seconds per 10,000 records. This is much slower than mysql.php!!

$password = 'secrect';

define('N', 10000); // num records

$conn = pg_connect("host=localhost port=5432 dbname=postgres user=postgres password=$password");

pg_query($conn, "DROP DATABASE deltadb");

pg_query($conn, "CREATE DATABASE deltadb");

pg_close($conn);

$conn = pg_connect("host=localhost port=5432 dbname=postgres user=postgres password=$password");

pg_query($conn, "
  CREATE TABLE IF NOT EXISTS queue_attrs(
    id SERIAL PRIMARY KEY,
    col_name VARCHAR(100) NOT NULL,
    doc_uuid VARCHAR(38), attr_name VARCHAR(100),
    attr_val TEXT,
    user_uuid VARCHAR(36),
    super_uuid VARCHAR(36),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    seq SMALLINT,
    quorum BOOLEAN
  )
");

$start = microtime(true);

for ($i = 0; $i < N; $i++) {
	pg_query($conn, "
		INSERT INTO queue_attrs (col_name, doc_uuid, attr_name, attr_val,
			user_uuid, super_uuid, created_at, recorded_at, updated_at, seq, quorum)
		VALUES ('some-col', 'doc-uuid', 'priority', 'high', 'user-uuid', 'super-uuid', NOW(),
			NOW(), NOW(), '0', '1')
	");
}

echo "compeleted after " . (microtime(true) - $start) . " seconds";
