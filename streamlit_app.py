import streamlit as st
import streamlit.components.v1 as components

# Bump this whenever inspector_portal.html / chat_panel.html change on S3.
# It changes the iframe URL's cache key so browsers can't serve a stale copy
# (CloudFront has no Cache-Control header → Chrome caches the HTML heuristically,
# which a CloudFront invalidation does NOT clear).
CACHE_BUST = "20260608a"

# v2 (IWSDK build) is now the default embedded portal — it lives under /v2/ as a
# multi-file bundle and replaces the old A-Frame v1 (inspector_portal.html).
# The legacy v1 portal is still reachable as a fallback via ?portal=v1.
_USE_V1 = st.query_params.get("portal", "v2") == "v1"

if _USE_V1:
    PORTAL_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/inspector_portal.html?v={CACHE_BUST}"
else:
    PORTAL_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html?v={CACHE_BUST}"
CHAT_URL   = f"https://d1ni7nkjr0eveg.cloudfront.net/chat_panel.html?v={CACHE_BUST}"
SPLAT_URL  = "https://alistairwstbrk.github.io/splat-site/?url=https://huggingface.co/datasets/AlistairWstbrk/splats/resolve/main/3DGS%20.ply%20New%20Vehicle%20Scans/Equinox%20Hood%20Open%20(New)(Cropped).ply"

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
        <h1>RAG Responder Hub</h1>
        <p>First Responder portal — explore the scene, query the AI assistant, and review EV rescue procedures.</p>
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
        "Explore the 360° accident scene and ask the First Responder AI anything about "
        "the vehicle — HV shutdown, fire response, no-cut zones, and more. Drag to rotate."
    )
    st.caption(
        f"🥽 On Meta Quest: [open the portal in the Quest browser]({PORTAL_URL}) "
        "for full VR — the embedded iframe can't grant WebXR permission, so the "
        "in-video **Enter VR** button only works on the direct URL."
    )
    components.iframe(PORTAL_URL, height=800, scrolling=True)

with tab2:
    st.subheader("🚗 3D Views of EVs")
    st.markdown(
        "Inspect high-fidelity Gaussian-splatting 3D scans of the vehicle, with the AI "
        "assistant alongside for procedure questions."
    )
    viewer_col, chat_col = st.columns([2, 1])
    with viewer_col:
        components.iframe(SPLAT_URL, height=750, scrolling=True)
    with chat_col:
        components.iframe(CHAT_URL, height=750, scrolling=False)
