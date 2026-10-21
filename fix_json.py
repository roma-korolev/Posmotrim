import json
import re

with open('events.json', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace unescaped quotes inside string values with escaped quotes
# This regex finds all string values and escapes quotes inside them
def escape_quotes_in_string(match):
    value = match.group(1)
    # Escape quotes that aren't already escaped
    escaped = value.replace('"', '\\"')
    return f':"{escaped}"'

# Apply to all key-value pairs with string values
content = re.sub(r':\"([^\"]*)\"', escape_quotes_in_string, content)

with open('events.json', 'w', encoding='utf-8') as f:
    f.write(content)

print("JSON fixed!")
