"""City programs the agent may mention. Only these; do not add others."""

CLEANUP_PROGRAM = {
    "name": "City Neighbourhood Cleanup Programs (Cleanup Party, Adopt a Block)",
    "url": "https://app.betterimpact.com/PublicOrganization/c6e38574-b5fa-4920-9679-a5ec7c8dd23c/3",
}
CLEANUP_LINE = "The City lends cleanup supplies through its Cleanup Party program."


def is_graffiti(hotspot: dict) -> bool:
    return (hotspot.get("category") == "Graffiti"
            or str(hotspot.get("request_type", "")).startswith("Graffiti"))


def program_for(hotspot: dict):
    """Return a copy of the City program dict for this hotspot, or None (graffiti)."""
    if is_graffiti(hotspot):
        return None
    return dict(CLEANUP_PROGRAM)
