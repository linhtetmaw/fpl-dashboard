import streamlit as st

from fpl_client import (
    FPLAPIError,
    TeamPointsSummary,
    calculate_team_points,
    clear_caches,
    get_current_event,
    get_events,
)

st.set_page_config(page_title="FPL Live Dashboard", layout="wide")


def sidebar_controls():
    st.sidebar.title("Settings")

    events = get_events()
    if not events:
        st.sidebar.error("Could not load gameweek data from FPL API.")
        return None, None, False, []

    current_event = get_current_event()
    default_gw = current_event["id"] if current_event else events[0]["id"]

    team_id = st.sidebar.number_input(
        "Team ID (entry ID)",
        min_value=1,
        step=1,
        value=1,
        help="Find this in the URL of your FPL team page: /entry/<team-id>/.",
    )

    gw_options = {e["name"]: e["id"] for e in events}
    gw_name = st.sidebar.selectbox(
        "Gameweek", list(gw_options.keys()), index=list(gw_options.values()).index(default_gw)
    )
    gameweek = gw_options[gw_name]

    st.sidebar.markdown("---")
    multi_ids_raw = st.sidebar.text_area(
        "Compare multiple team IDs (comma-separated)",
        value="",
        help="Optional: enter additional team IDs separated by commas to compare.",
    )
    multi_ids = []
    if multi_ids_raw.strip():
        for part in multi_ids_raw.split(","):
            part = part.strip()
            if part.isdigit():
                multi_ids.append(int(part))

    st.sidebar.markdown("---")
    refresh = st.sidebar.button("Refresh data (clear cache)")
    if refresh:
        clear_caches()

    return int(team_id), int(gameweek), refresh, multi_ids


def render_team_summary(summary: TeamPointsSummary):
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Team ID", summary.team_id)
    col2.metric("Total points", summary.total_points)
    col3.metric("Starting XI points", summary.starting_points)
    col4.metric("Bench points", summary.bench_points)

    if summary.chip:
        st.info(f"Active chip: **{summary.chip}**")


def render_players_table(summary: TeamPointsSummary):
    rows = []
    for p in summary.players:
        rows.append(
            {
                "Player": p.web_name,
                "Team": p.team_name,
                "Pos": p.position,
                "C": "C" if p.is_captain else "",
                "VC": "VC" if p.is_vice_captain else "",
                "Bench": "Yes" if p.is_on_bench else "",
                "Minutes": p.minutes,
                "Goals": p.goals_scored,
                "Assists": p.assists,
                "CS": p.clean_sheets,
                "Bonus": p.bonus,
                "Raw Pts": p.total_points_raw,
                "x Mult": p.multiplier,
                "Eff Pts": p.total_points_effective,
            }
        )

    st.subheader("Player breakdown")
    st.dataframe(rows, use_container_width=True)


def main():
    st.title("Fantasy Premier League – Live Points Dashboard")
    st.write(
        "Enter your FPL team ID and select a gameweek to see live points. "
        "Data comes from the public Fantasy Premier League API."
    )

    team_id, gameweek, _refresh, multi_ids = sidebar_controls()
    if not team_id or not gameweek:
        return

    # Single team view
    st.header("Single team view")
    try:
        summary = calculate_team_points(team_id, gameweek)
    except FPLAPIError as e:
        st.error(f"Could not load team data: {e}")
        return
    except Exception as e:
        st.error(f"Unexpected error while loading data: {e}")
        return

    if summary.team_name:
        st.subheader(f"{summary.team_name} (ID {summary.team_id}) – GW{summary.gameweek}")
    else:
        st.subheader(f"Team ID {summary.team_id} – GW{summary.gameweek}")

    render_team_summary(summary)
    render_players_table(summary)

    # Multi-team comparison
    if multi_ids:
        st.header("Multi-team comparison")
        all_ids = [team_id] + [i for i in multi_ids if i != team_id]
        comparison_rows = []
        for tid in all_ids:
            try:
                ts = calculate_team_points(tid, gameweek)
            except Exception:
                continue
            comparison_rows.append(
                {
                    "Team ID": ts.team_id,
                    "Team name": ts.team_name or "",
                    "GW": ts.gameweek,
                    "Total points": ts.total_points,
                    "Starting XI": ts.starting_points,
                    "Bench": ts.bench_points,
                    "Chip": ts.chip or "",
                }
            )
        if comparison_rows:
            st.dataframe(comparison_rows, use_container_width=True)


if __name__ == "__main__":
    main()


