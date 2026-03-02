from __future__ import annotations

import functools
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests

BASE_URL = "https://fantasy.premierleague.com/api"

USER_AGENT = (
    "Mozilla/5.0 (compatible; FPLDashboard/1.0; +https://fantasy.premierleague.com)"
)


class FPLAPIError(Exception):
    """Raised when the FPL API returns an unexpected response."""


def _get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{BASE_URL}/{path.lstrip('/')}"
    resp = requests.get(
        url,
        params=params,
        headers={"User-Agent": USER_AGENT},
        timeout=10,
    )
    if not resp.ok:
        raise FPLAPIError(f"FPL API error {resp.status_code} for {url}")
    return resp.json()


@functools.lru_cache(maxsize=16)
def get_bootstrap_static() -> Dict[str, Any]:
    """Metadata: players, teams, events, etc."""
    return _get("bootstrap-static/")


@functools.lru_cache(maxsize=64)
def get_event_live(gameweek: int) -> Dict[str, Any]:
    """Live data for a specific gameweek."""
    return _get(f"event/{gameweek}/live/")


@functools.lru_cache(maxsize=128)
def get_team_picks(team_id: int, gameweek: int) -> Dict[str, Any]:
    """Team picks for a given gameweek."""
    return _get(f"entry/{team_id}/event/{gameweek}/picks/")


def clear_caches() -> None:
    """Clear all API caches (e.g. when forcing a manual refresh)."""

    get_bootstrap_static.cache_clear()
    get_event_live.cache_clear()
    get_team_picks.cache_clear()


def get_events() -> List[Dict[str, Any]]:
    """Return list of gameweek (event) metadata."""
    data = get_bootstrap_static()
    return data.get("events", [])


def get_current_event() -> Optional[Dict[str, Any]]:
    """Return the current gameweek event, if available."""
    for event in get_events():
        if event.get("is_current"):
            return event
    # fallback: next event if no current (e.g. pre-season)
    for event in get_events():
        if event.get("is_next"):
            return event
    return None


def get_team_name(team_id: int) -> Optional[str]:
    """
    Fetch the FPL team (entry) name for a given team ID.
    This uses a light endpoint separate from picks.
    """
    data = _get(f"entry/{team_id}/")
    return data.get("name") or data.get("player_first_name")


@dataclass
class PlayerPoints:
    element_id: int
    web_name: str
    team_name: str
    position: int
    is_captain: bool
    is_vice_captain: bool
    is_on_bench: bool
    minutes: int
    goals_scored: int
    assists: int
    clean_sheets: int
    bonus: int
    total_points_raw: int
    multiplier: int
    total_points_effective: int


@dataclass
class TeamPointsSummary:
    team_id: int
    team_name: Optional[str]
    gameweek: int
    chip: Optional[str]
    total_points: int
    starting_points: int
    bench_points: int
    players: List[PlayerPoints]


def calculate_team_points(team_id: int, gameweek: int) -> TeamPointsSummary:
    """
    Join team picks, player metadata, and live stats to produce
    a per-player and total points breakdown.
    """
    bootstrap = get_bootstrap_static()
    event_live = get_event_live(gameweek)
    picks_data = get_team_picks(team_id, gameweek)

    elements = {e["id"]: e for e in bootstrap.get("elements", [])}
    teams = {t["id"]: t for t in bootstrap.get("teams", [])}

    live_by_element: Dict[int, Dict[str, Any]] = {}
    for el in event_live.get("elements", []):
        el_id = el.get("id")
        if el_id is None:
            continue
        live_by_element[el_id] = el.get("stats", {})

    chip: Optional[str] = None
    chips = picks_data.get("chips") or []
    if chips:
        chip = chips[0].get("name")

    picks = picks_data.get("picks", [])
    player_points: List[PlayerPoints] = []

    total_points = 0
    starting_points = 0
    bench_points = 0

    for pick in picks:
        element_id = pick["element"]
        position = pick["position"]
        multiplier = pick.get("multiplier", 1)
        is_captain = bool(pick.get("is_captain"))
        is_vice_captain = bool(pick.get("is_vice_captain"))
        is_on_bench = position > 11

        meta = elements.get(element_id, {})
        live = live_by_element.get(element_id, {})

        web_name = meta.get("web_name", f"#{element_id}")
        team_id_real = meta.get("team")
        team_name = teams.get(team_id_real, {}).get("name", "Unknown")

        minutes = live.get("minutes", 0)
        goals_scored = live.get("goals_scored", 0)
        assists = live.get("assists", 0)
        clean_sheets = live.get("clean_sheets", 0)
        bonus = live.get("bonus", 0)
        total_points_raw = live.get("total_points", 0)

        total_effective = total_points_raw * multiplier
        total_points += total_effective

        if is_on_bench:
            bench_points += total_effective
        else:
            starting_points += total_effective

        player_points.append(
            PlayerPoints(
                element_id=element_id,
                web_name=web_name,
                team_name=team_name,
                position=position,
                is_captain=is_captain,
                is_vice_captain=is_vice_captain,
                is_on_bench=is_on_bench,
                minutes=minutes,
                goals_scored=goals_scored,
                assists=assists,
                clean_sheets=clean_sheets,
                bonus=bonus,
                total_points_raw=total_points_raw,
                multiplier=multiplier,
                total_points_effective=total_effective,
            )
        )

    try:
        team_name = get_team_name(team_id)
    except FPLAPIError:
        team_name = None

    return TeamPointsSummary(
        team_id=team_id,
        team_name=team_name,
        gameweek=gameweek,
        chip=chip,
        total_points=total_points,
        starting_points=starting_points,
        bench_points=bench_points,
        players=player_points,
    )


