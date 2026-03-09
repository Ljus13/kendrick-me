-- ============================================================
-- 009 — Enable Supabase Realtime on wedding tables
-- Run after 007 and 008 migrations
-- ============================================================

-- Enable Realtime for wedding_chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE wedding_chat_messages;

-- Enable Realtime for wedding_avatars
ALTER PUBLICATION supabase_realtime ADD TABLE wedding_avatars;

-- Set REPLICA IDENTITY FULL on wedding_chat_messages so that
-- DELETE events expose all columns (required for filtered deletes)
ALTER TABLE wedding_chat_messages REPLICA IDENTITY FULL;
