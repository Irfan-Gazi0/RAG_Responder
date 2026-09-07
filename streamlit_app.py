import streamlit as st
from urllib.parse import quote

# Lucide icons (github.com/lucide-icons/lucide, ISC license) — inline SVG paths,
# stroke="currentColor" so each one inherits whatever color wraps it.
_ICON_PATHS = {
    "flame": '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
    "graduation-cap": (
        '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832'
        'l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>'
    ),
    "car": (
        '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c'
        '-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>'
        '<circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'
    ),
    "glasses": (
        '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/>'
        '<path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/>'
        '<path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>'
    ),
    "hourglass": (
        '<path d="M5 22h14"/><path d="M5 2h14"/>'
        '<path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>'
        '<path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'
    ),
}


def icon(name: str, size: int = 16) -> str:
    """Inline Lucide SVG, sized in px, colored via currentColor."""
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
        f'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        f'stroke-linejoin="round" style="vertical-align:-{round(size * 0.15)}px;'
        f'flex-shrink:0">{_ICON_PATHS[name]}</svg>'
    )

# Bump this whenever the embedded HTML changes on S3 — inspector_portal.html
# (now the v2 bundle), v1/inspector_portal.html, or chat_panel.html.
# It changes the iframe URL's cache key so browsers can't serve a stale copy
# (CloudFront has no Cache-Control header → Chrome caches the HTML heuristically,
# which a CloudFront invalidation does NOT clear).
CACHE_BUST = "20260907c"

# S3-root cutover, 2026-09-07: /inspector_portal.html IS the v2 IWSDK bundle now
# (deploy/deploy_portal_v2.py --root), so the canonical URL and every existing
# bookmark land on v2 with no query param. /v2/index.html stays live and
# identical — it is the direct URL used for on-device Quest testing.
#
# The retired A-Frame v1 portal moved to /v1/inspector_portal.html and is still
# reachable via ?portal=v1. Keep that path pointed at /v1/: if it ever points at
# the root again it silently serves v2, and the fallback stops being a fallback.
# (deploy/deploy_v1.py --restore-root is the matching S3-side rollback.)
_USE_V1 = st.query_params.get("portal", "v2") == "v1"

if _USE_V1:
    PORTAL_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/v1/inspector_portal.html?v={CACHE_BUST}"
else:
    PORTAL_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/inspector_portal.html?v={CACHE_BUST}"
CHAT_URL   = f"https://d1ni7nkjr0eveg.cloudfront.net/chat_panel.html?v={CACHE_BUST}"

# 3D Gaussian-splat viewer. Third-party: github.com/AlistairWstbrk/DOE-Training on
# GitHub Pages, rendering .ply scans hosted on Hugging Face. Replaced the old
# `splat-site` host on 2026-08-18 after it started returning 404 (the tab rendered
# an empty iframe with no error — verify pixels, not just HTTP, after changing this).
#
# ⚠ DO NOT pass ?url= here. The viewer is now Equinox-specific, and both its guided
# tour and its 3D annotation pins are selected by SUBSTRING MATCH against that
# parameter (main.js:293 `decodedUrlLower.includes(key)`, :332 `targetUrlSnippet`).
# The only mapped key is "EQUINOXREFINE_FINAL", so any other scan loads bare — the
# tour panel reads "No Tour Available" and no pins appear, with nothing saying why.
# Its sidebar camera views are worse: they are hardcoded to that scan and populate
# regardless, so they silently aim at the wrong bodywork. Omitting ?url= lets the
# viewer default to EQUINOXREFINE_FINAL.ply (main.js:288) and all three line up.
SPLAT_VIEWER = "https://alistairwstbrk.github.io/DOE-Training/"

# The hash is the opening view matrix (main.js:284 JSON.parse's it) — the viewer's own
# customCameras["EQUINOXREFINE_FINAL"] "Vehicle Overview" pose. Seeding it also stops
# the idle carousel orbit, so the scan lands framed and still.
_OVERVIEW_VIEW = "[0.87,0.11,-0.47,0,0.03,0.96,0.29,0,0.48,-0.27,0.83,0,0.75,0.83,5.19,1]"
SPLAT_URL = f"{SPLAT_VIEWER}#{quote(_OVERVIEW_VIEW)}"

# Standalone WebXR splat viewer (Spark). VR cannot work inside st.iframe()
# because Streamlit withholds `xr-spatial-tracking`, so this is linked, not embedded.
SPLAT_VR_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/splat-vr/index.html?v={CACHE_BUST}"

st.set_page_config(
    page_title="RAG Responder Hub",
    page_icon="🚒",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Cohesive dark theme matching the embedded portal (#0f172a slate, #ef4444 red accent)
st.markdown(
    """
    <style>
      :root {
        --bg:#0f172a; --panel:#1e293b; --border:#334155;
        --text:#e2e8f0; --muted:#94a3b8; --accent:#ef4444;
      }
      .stApp { background: var(--bg); }
      #MainMenu, footer,
      [data-testid="stToolbar"], [data-testid="stDecoration"],
      [data-testid="stStatusWidget"] { display: none !important; }
      [data-testid="stHeader"] { background: transparent; height: 0; }
      .block-container { padding-top: 1.5rem; padding-bottom: 2rem; max-width: 1500px; }

      .stApp, p, li, span, label { color: var(--text); }
      h1, h2, h3 { color: #f1f5f9 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

      .hero {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid var(--border); border-radius: 14px;
        padding: 22px 28px; margin-bottom: 22px;
        display: flex; align-items: center; gap: 18px;
      }
      .hero .badge {
        width: 52px; height: 52px; border-radius: 12px; flex-shrink: 0;
        background: linear-gradient(135deg, #ef4444, #b91c1c);
        display: flex; align-items: center; justify-content: center; font-size: 26px;
      }
      .hero h1 { font-size: 24px; font-weight: 700; margin: 0; color: #f1f5f9; }
      .hero p  { font-size: 14px; color: var(--muted); margin: 4px 0 0; }

      [data-baseweb="tab-list"] { gap: 6px; border-bottom: 1px solid var(--border); }
      [data-baseweb="tab"] {
        background: var(--panel); color: var(--muted) !important;
        border-radius: 9px 9px 0 0; padding: 11px 20px;
        font-weight: 600; font-size: 14px;
      }
      [data-baseweb="tab"]:hover { color: var(--text) !important; }
      [data-baseweb="tab"][aria-selected="true"] {
        background: var(--accent); color: #fff !important;
      }
      [data-baseweb="tab-highlight"], [data-baseweb="tab-border"] { background: transparent; }
      [data-baseweb="tab-panel"] { padding-top: 20px; }

      [data-testid="stAlert"] {
        background: var(--panel); border: 1px solid var(--border);
        border-radius: 10px; color: var(--text);
      }
      iframe { border-radius: 12px; border: 1px solid var(--border); background: #000; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    f"""
    <div class="hero">
      <div class="badge">{icon("flame", 26)}</div>
      <div>
        <h1>First Responder Portal</h1>
        <p>Train. Explore. Ask. Respond.</p>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

tab1, tab2 = st.tabs(
    ["Training Workshop + AI Assistant", "3D Views of EVs"]
)

with tab1:
    st.markdown(
        f'<h3 style="display:flex;align-items:center;gap:8px;margin:0 0 0.5rem">'
        f'{icon("graduation-cap", 20)} Training Workshop + AI Assistant</h3>',
        unsafe_allow_html=True,
    )
    st.markdown(
        "Watch the immersive training videos and Query the AI assistant"
    )
    st.markdown(
        f'<div style="font-size:14px;color:var(--muted);display:flex;'
        f'align-items:center;gap:6px;margin-bottom:0.25rem">{icon("glasses", 14)} '
        f'On a VR headset? <a href="{PORTAL_URL}" style="color:inherit;'
        f'text-decoration:underline">Open the portal directly</a> in your '
        f'headset\'s browser, then tap the <strong>Enter VR</strong> button in the '
        f"bottom-right corner to step inside.</div>",
        unsafe_allow_html=True,
    )
    st.iframe(PORTAL_URL, height=800)

with tab2:
    st.markdown(
        f'<h3 style="display:flex;align-items:center;gap:8px;margin:0 0 0.5rem">'
        f'{icon("car", 20)} 3D Views of EVs</h3>',
        unsafe_allow_html=True,
    )
    st.markdown(
        "Inspect high-fidelity 3D scans of the vehicle."
    )
    st.markdown(
        f'<div style="font-size:14px;color:var(--muted);display:flex;'
        f'align-items:center;gap:6px;margin-bottom:0.25rem">{icon("glasses", 14)} '
        f'Using a VR headset? <a href="{SPLAT_VR_URL}" style="color:inherit;'
        f'text-decoration:underline">Open the car scene in VR</a>, then tap '
        f"<strong>Enter VR</strong>.</div>",
        unsafe_allow_html=True,
    )
    # The desktop viewer pulls a 43.6 MB .ply from Hugging Face and shows a red
    # placeholder cube meanwhile, with no progress of its own — it reads as broken
    # for ~15 s. Nothing to fix in this repo (that viewer is a third-party URL),
    # so say so rather than let people conclude the tab is dead.
    st.markdown(
        f'<div style="font-size:14px;color:var(--muted);display:flex;'
        f'align-items:center;gap:6px;margin-bottom:0.25rem">{icon("hourglass", 14)} '
        f"The 3D scan is a large file so it takes a moment to load.</div>",
        unsafe_allow_html=True,
    )
    viewer_col, chat_col = st.columns([2, 1])
    with viewer_col:
        st.iframe(SPLAT_URL, height=750)
    with chat_col:
        st.iframe(CHAT_URL, height=750)
