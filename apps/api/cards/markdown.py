"""Card description rules.

Descriptions allow **bold**, *italic*, "- " bullets, and line breaks. Anything
else is treated as plain text by the clients, but headings, links, HTML, and
code are rejected outright so nobody can smuggle in formatting we don't render.

Mirrors packages/shared/src/markdown.ts. Both are tested against
packages/shared/fixtures/markdown-cases.json.
"""

import re

DESCRIPTION_MAX_LENGTH = 600

HEADING = re.compile(r"^\s{0,3}#{1,6}\s", re.MULTILINE)
LINK_OR_IMAGE = re.compile(r"!?\[[^\]]*\]\([^)]*\)")
HTML_TAG = re.compile(r"</?[a-z][\s\S]*?>", re.IGNORECASE)
CODE = re.compile(r"`")


def description_issues(text: str) -> list[str]:
    issues = []
    if len(text) > DESCRIPTION_MAX_LENGTH:
        issues.append("too_long")
    if HEADING.search(text):
        issues.append("heading")
    if LINK_OR_IMAGE.search(text):
        issues.append("link")
    if HTML_TAG.search(text):
        issues.append("html")
    if CODE.search(text):
        issues.append("code")
    return issues


ISSUE_MESSAGES = {
    "too_long": f"Descriptions can be at most {DESCRIPTION_MAX_LENGTH} characters.",
    "heading": "Headings aren't allowed in descriptions.",
    "link": "Links and images aren't allowed in descriptions.",
    "html": "HTML isn't allowed in descriptions.",
    "code": "Code formatting isn't allowed in descriptions.",
}
