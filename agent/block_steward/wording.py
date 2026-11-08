"""Plain-words wording for 311 request types (shared by suggestions and briefings)."""

_PLAIN = {
    "Abandoned Non-Recyclables-Small Case": "small abandoned items",
    "Abandoned Recyclables Case": "abandoned recyclables",
    "Street Cleaning and Debris Pick Up Case": "street debris",
    "Loose Litter Clean Up Case": "loose litter",
    "Graffiti Removal - City Property Case": "graffiti on City property",
    "Graffiti Removal - Park Property Case": "graffiti in parks",
}


def plain_words(request_type: str) -> str:
    """Return a short plain-language phrase for a 311 request type."""
    if request_type in _PLAIN:
        return _PLAIN[request_type]
    text = (request_type or "").strip()
    if text.endswith(" Case"):
        text = text[: -len(" Case")]
    return text.lower()
