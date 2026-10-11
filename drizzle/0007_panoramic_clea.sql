-- Remembers the upload a CAMPD sync took a record over from, so the record can still say it came from a file.
ALTER TABLE `annual_records` ADD `superseded_upload_id` text REFERENCES datasets(id) ON DELETE set null;
