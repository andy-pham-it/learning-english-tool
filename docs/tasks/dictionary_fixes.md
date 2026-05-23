# Dictionary Fixes Plan

Fix issues in the Dictionary feature according to user feedback.

## Tasks
- [x] Create task list in `docs/tasks/dictionary_fixes.md` <!-- Done by creating this file -->
- [x] Investigate and fix oversized search text field
- [x] Fix search input leaking/overflowing sidebar viewport
- [x] Investigate and fix the "+" button visibility logic
- [x] Implement sorting options for the word list in the sidebar
- [x] Create tests to verify the fixes
- [x] Fix any lint errors (No lint setup found)
- [x] Create a report of the changes

## Implementation Details

### 1. Oversized Search Field
- Reduce vertical padding of the search input from `py-3` to `py-2`.
- Adjust sidebar header padding if necessary.

### 2. "+" Button Visibility
- Currently, `isInHistory()` checks the global `dictionary` collection (via `history()` signal).
- Words are automatically saved to this collection upon search, causing `isInHistory()` to be true immediately.
- Change `isInHistory` to check a personal list or rethink the logic.
- Update `addToFlashcards` to actually save the word to a personal collection.

### 3. Sorting Options
- Add a `sortBy` signal with values: 'alpha', 'time', 'category'.
- Create a `sortedHistory` computed signal based on `history()` and `sortBy()`.
- Add UI buttons to switch between sorting modes.

## Verification Plan
- Manual check of the search field size.
- Verify "+" button appears for new words and disappears after adding.
- Verify sorting works correctly for all three options.
