-- Up Migration
-- The session log: the operations Editing accepted for each page, in order, from seq 1. The primary key refuses a seq already taken, which is how an instance of Editing that fell behind learns that another one extended the log of the page. The operation is its JSON as encodeOperation writes it, with the version of the protocol, so an older one can still be replayed.
CREATE TABLE session_log (
  page_id uuid NOT NULL,
  seq bigint NOT NULL CHECK (seq > 0),
  operation jsonb NOT NULL,
  PRIMARY KEY (page_id, seq)
);
