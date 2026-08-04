# Change Log: backend/apps/assessments/serializers.py

## 2026-08-04
- Added defensive error handling in `get_sequence_name` and `get_term_name` within `MarkEntryWindowSerializer`.
- Reason: Prevent potential `AttributeError` or missing relationship errors from breaking the API response with a 500 status when serializing mark entry windows.
