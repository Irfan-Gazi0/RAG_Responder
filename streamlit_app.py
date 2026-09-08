import streamlit as st
import streamlit.components.v1 as components
from urllib.parse import quote

# Lucide icons (github.com/lucide-icons/lucide, ISC license) — inline SVG paths,
# stroke="currentColor" so each one inherits whatever color wraps it.
_ICON_PATHS = {
    "flame": '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
    "glasses": (
        '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/>'
        '<path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/>'
        '<path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>'
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
# (now the v2 bundle), chat.html, or v1/inspector_portal.html.
# It changes the iframe URL's cache key so browsers can't serve a stale copy
# (CloudFront has no Cache-Control header → Chrome caches the HTML heuristically,
# which a CloudFront invalidation does NOT clear).
CACHE_BUST = "20260908d"

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
# The chat panel the EV Explorer tab embeds. Since 2026-09-07 this is a SECOND
# ENTRY OF THE V2 BUNDLE (apps/portal/chat.html), not the old standalone
# apps/v1/chat_panel.html — same markup, same CSS, same chat client as the panel
# inside the portal above. That is what makes it one assistant instead of two:
# the transcript lives in localStorage (apps/portal/src/transcript.ts) and both
# iframes are same-origin here, so a question asked in Training shows up in EV
# Explorer live, and Clear in either one resets both.
# Deployed by deploy_portal_v2.py --root; /chat_panel.html is the retired file.
CHAT_URL   = f"https://d1ni7nkjr0eveg.cloudfront.net/chat.html?v={CACHE_BUST}"

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

# ⚠ DO NOT put the viewer in a bare st.iframe(). `st.tabs` mounts BOTH panels at
# first render and the inactive one gets no layout, so an iframe sitting in it
# loads at 0x0 — and the viewer sizes itself exactly ONCE, in a resize() that
# runs at load (main.js:424-431). At 0x0 that builds its projection as
# `2 * fx / 0` = Infinity and sets its canvas to 0x0. Opening the tab fires no
# resize event in the child (its box goes from "not laid out" to laid out, which
# is not a resize), and any resize that does arrive later writes u_viewport /
# u_projection while the BACKGROUND program is the bound one — main.js binds
# bgProg last in every frame — so the splat shader keeps the dead uniforms for
# good. The scan still downloads and the DOM annotation pins still land in the
# right place; the car simply never draws. That was this tab for the whole life
# of the embed, and it is why the same URL is fine in its own browser tab.
#
# So mount it from JS instead, once this host iframe actually has a size. The
# viewer then gets its single resize() at the real size with the splat program
# bound, which is all it ever needed. The 15%-wide red load bar it leaves behind
# is cosmetic: main.js divides by a .splat row length the .ply doesn't have, so
# 15.09% IS the fully-loaded state.
SPLAT_EMBED = """
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #0f172a; }
  #host { width: 100%; height: 100%; }
  iframe { width: 100%; height: 100%; border: 0; display: block; }
</style>
<div id="host"></div>
<script>
  var mounted = false;
  function mount() {
    if (mounted || !window.innerWidth || !window.innerHeight) return;
    mounted = true;
    clearInterval(timer);
    if (observer) observer.disconnect();
    var f = document.createElement("iframe");
    f.setAttribute("allow", "accelerometer; autoplay; fullscreen; xr-spatial-tracking");
    f.src = "__SRC__";
    document.getElementById("host").appendChild(f);
  }
  // ResizeObserver is the one that actually fires the moment the tab opens: a
  // timer is throttled to once a minute while the browser tab sits in the
  // background, so the poll below is only a fallback for browsers without it.
  var observer = window.ResizeObserver ? new ResizeObserver(mount) : null;
  if (observer) observer.observe(document.documentElement);
  var timer = setInterval(mount, 200);
  mount();
</script>
""".replace("__SRC__", SPLAT_URL)

# Standalone WebXR splat viewer (Spark). VR cannot work inside st.iframe()
# because Streamlit withholds `xr-spatial-tracking`, so this is linked, not embedded.
SPLAT_VR_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/splat-vr/index.html?v={CACHE_BUST}"

st.set_page_config(
    page_title="First Responder Training",
    page_icon="🚒",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Layout and typography only. THE PALETTE LIVES IN .streamlit/config.toml —
# the variables below mirror it so the hand-written rules here (hero, intro copy,
# iframes) stay in step with what Streamlit itself paints. Change a color in one
# place and change it in the other, or the shell splits from its own widgets.
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
      .block-container { padding-top: 1.5rem; padding-bottom: 2rem;
        max-width: 100%; width: 100%; padding-left: 3%; padding-right: 3%; }

      .stApp, p, li, span, label { color: var(--text); }
      h1, h2, h3 { color: #f1f5f9 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

      /* Deliberately small. This is a masthead, not a landing-page hero: it
         names the product once and gets out of the way, because the two things
         people came for (the 360 video, the assistant) are below it and every
         pixel here is one they scroll past. Sized to roughly the portal's own
         36px-logo header so the shell and the iframe read as one continuous
         page instead of two stacked title bars. */
      .hero {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid var(--border); border-radius: 12px;
        padding: 13px 18px; margin-bottom: 14px;
        display: flex; align-items: center; gap: 13px;
      }
      .hero .badge {
        width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
        background: linear-gradient(135deg, #ef4444, #b91c1c);
        display: flex; align-items: center; justify-content: center; font-size: 19px;
      }
      /* `padding: 0` is load-bearing: Streamlit gives every h1 a ~1.25rem/1rem
         vertical padding of its own, which silently added ~36px to this box and
         is most of why the masthead looked oversized. */
      .hero h1 { font-size: 18px; font-weight: 700; margin: 0; padding: 0;
        color: #f1f5f9; line-height: 1.25; }
      .hero p  { font-size: 13px; color: var(--muted); margin: 2px 0 0; }

      /* Tab COLOR is themed in .streamlit/config.toml, not here. The rules that
         used to sit at this spot targeted `data-baseweb="tab*"`, which Streamlit
         stopped emitting when it moved off BaseWeb to react-aria — on the version
         requirements.txt pins (>=1.62) they matched zero elements, so the "red
         slab" active tab never rendered and the accent silently fell back to
         Streamlit's stock #FF4B4B. `primaryColor` drives it correctly and won't
         break on the next DOM change. The current hook, if an override is ever
         genuinely needed, is [data-testid="stTab"]. */
      [role="tablist"] { gap: 22px; }
      [data-testid="stTab"] { font-weight: 600; font-size: 14px; }

      /* Orientation copy: what this tab is, what you can do, where to start.
         It lives HERE, in the Streamlit shell, rather than inside the portal —
         apps/portal/index.html is also the page a Quest loads at the S3 root,
         where a paragraph of onboarding would steal video height and follow the
         user into the headset. Two sentences, no second title bar: the hero and
         the tab label already name the section. */
      .tab-intro {
        font-size: 14px; color: #cbd5e1; line-height: 1.65;
        max-width: 980px; margin-bottom: 8px;
      }
      .tab-intro strong { color: #f1f5f9; font-weight: 600; }
      .tab-intro .next {
        display: block; margin-top: 4px;
        font-size: 13px; color: var(--muted);
      }

      /* One quiet line of context above each iframe. Both notes are functional,
         not decorative — see the comments at their call sites. */
      .tab-note {
        font-size: 13px; color: var(--muted); line-height: 1.6;
        margin-bottom: 10px;
      }
      .tab-note svg { margin-right: 5px; }
      /* The two headset links are the only actionable thing in this line, and
         at `color: inherit` they were --muted grey on grey — an underline was
         the only thing marking them as links. They now carry the site accent
         (a lighter tint of the --accent red used by the hero badge and the
         active tab, chosen over #ef4444 itself for contrast against #0f172a). */
      .tab-note a { color: #f87171; text-decoration: underline;
        text-underline-offset: 2px; font-weight: 600; }
      .tab-note a:hover { color: #fca5a5; }
      .tab-note strong { color: #cbd5e1; font-weight: 600; }
      .tab-note .sep { color: #475569; margin: 0 2px; }

      /* The border is why an embed reads as a panel rather than as content that
         ran off the page — without it the chat column just floats, and the
         third-party splat viewer bleeds into our chrome with no seam. It needs
         the wrapper selector AND !important: Streamlit ships its own
         `border: none` on the iframe, which a bare `iframe {}` rule loses to.
         (That is why this looked borderless despite the old rule saying otherwise.)
         `background` is a separate fix — Streamlit paints this box before the
         remote document loads, and the portal is a heavy IWSDK bundle, so at #000
         it was a black slab flashing inside a #0f172a page on every load. */
      iframe,
      [data-testid="stIFrame"] iframe {
        border-radius: 12px; background: var(--bg);
        border: 1px solid var(--border) !important;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    f"""
    <div class="hero">
      <div class="badge">{icon("flame", 19)}</div>
      <div>
        <h1>First Responder Training</h1>
        <p>EV emergency response — watch, explore, ask.</p>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

tab1, tab2 = st.tabs(["Training Workshop", "3D EV Explorer"])

with tab1:
    st.markdown(
        '<div class="tab-intro">'
        "<strong>Watch the 360&deg; training and ask questions to the AI assistant.</strong>"
        "</div>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f'<div class="tab-note">{icon("glasses", 14)} On a VR headset? '
        f'<a href="{PORTAL_URL}">Open the portal</a> in your '
        f"headset's browser, then tap <strong>Enter VR</strong>.</div>",
        unsafe_allow_html=True,
    )
    st.iframe(PORTAL_URL, height=800)

with tab2:
    st.markdown(
        '<div class="tab-intro">'
        "<strong>Explore a 3D scan of a electric vehicle.</strong> "
        "Get familiar with the vehicle here."
        "</div>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f'<div class="tab-note">{icon("glasses", 14)} On a VR headset? '
        f'<a href="{SPLAT_VR_URL}">Open the car scene there</a>, then tap '
        f"<strong>Enter VR</strong>.</div>",
        unsafe_allow_html=True,
    )
    viewer_col, chat_col = st.columns([2, 1])
    with viewer_col:
        components.html(SPLAT_EMBED, height=750)
    with chat_col:
        st.iframe(CHAT_URL, height=750)
