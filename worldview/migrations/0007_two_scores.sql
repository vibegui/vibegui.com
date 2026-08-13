-- The scoreboard collapses to two: alignment and integrity.
--
-- The declared structure now lives in worldview.json (git). D1 keeps only the
-- measurement. The eleven previous scorecard items are NOT dropped — they stay
-- as diagnostic detail beneath the two scores, which is what they always were.
--
-- Integrity is seeded NULL rather than 0 on purpose. It counts unacknowledged
-- commitments and there is no word ledger yet, so claiming zero would be an
-- assertion whose evidence would not survive being looked at.

INSERT OR IGNORE INTO scorecard_items (
  id, position, label, kind, current_value, target_value, unit,
  boolean_value, note
) VALUES
  (
    'alignment', -2, 'Alignment', 'metric',
    NULL, 100, '%', NULL,
    'Share of active work traceable to a declared outcome. Not yet computed.'
  ),
  (
    'integrity', -1, 'Integrity', 'metric',
    NULL, 0, 'unacknowledged items', NULL,
    'Count of word items currently unacknowledged; target zero. Awaiting the word ledger — word, systems, and objects are each in scope.'
  );
