import streamlit as st
import streamlit.components.v1 as components

# Bump this whenever the embedded HTML changes on S3 — v2/index.html (the
# default), inspector_portal.html, or chat_panel.html.
# It changes the iframe URL's cache key so browsers can't serve a stale copy
# (CloudFront has no Cache-Control header → Chrome caches the HTML heuristically,
# which a CloudFront invalidation does NOT clear).
CACHE_BUST = "20260803a"

# v2 (IWSDK build) is now the default embedded portal — it lives under /v2/ as a
# multi-file bundle and replaces the old A-Frame v1 (inspector_portal.html).
# The legacy v1 portal is still reachable as a fallback via ?portal=v1.
_USE_V1 = st.query_params.get("portal", "v2") == "v1"

if _USE_V1:
    PORTAL_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/inspector_portal.html?v={CACHE_BUST}"
else:
    PORTAL_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html?v={CACHE_BUST}"
CHAT_URL   = f"https://d1ni7nkjr0eveg.cloudfront.net/chat_panel.html?v={CACHE_BUST}"

# 3D Gaussian-splat viewer. Third-party: github.com/AlistairWstbrk/DOE-Training on
# GitHub Pages, rendering .ply scans hosted on Hugging Face. Replaced the old
# `splat-site` host on 2026-08-18 after it started returning 404 (the tab rendered
# an empty iframe with no error — verify pixels, not just HTTP, after changing this).
# ?url= preloads one scan; the viewer's own category/model dropdowns switch scans.
SPLAT_VIEWER = "https://alistairwstbrk.github.io/DOE-Training/"
SPLAT_PLY = (
    "https://huggingface.co/datasets/AlistairWstbrk/splats/resolve/main/"
    "3DGS%20.ply%20New%20Vehicle%20Scans/Equinox%20Hood%20Open%20(New)(Cropped).ply"
)
SPLAT_URL = f"{SPLAT_VIEWER}?url={SPLAT_PLY}"

# Standalone WebXR splat viewer (Spark). VR cannot work inside components.iframe()
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
    """
    <div class="hero">
      <div class="badge">🚒</div>
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
    st.subheader("🎓 Training Workshop + AI Assistant")
    st.markdown(
        "Watch the immersive training videos and Query the AI assistant"
    )
    st.caption(
        f"🥽 Using a VR headset? [Open the portal directly]({PORTAL_URL}), "
        "then tap **Enter VR**."
    )
    components.iframe(PORTAL_URL, height=800, scrolling=True)

with tab2:
    st.subheader("🚗 3D Views of EVs")
    st.markdown(
        "Inspect high-fidelity Gaussian-splatting 3D scans of the vehicle, with the AI "
        "assistant alongside for procedure questions."
    )
    st.caption(
        f"🥽 Using a VR headset? [Open the car scene in VR]({SPLAT_VR_URL}), "
        "then tap **Enter VR** to walk around the vehicle."
    )
    viewer_col, chat_col = st.columns([2, 1])
    with viewer_col:
        components.iframe(SPLAT_URL, height=750, scrolling=True)
    with chat_col:
        components.iframe(CHAT_URL, height=750, scrolling=False)
