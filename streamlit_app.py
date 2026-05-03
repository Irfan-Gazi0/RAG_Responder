import streamlit as st
import streamlit.components.v1 as components

# 1. Page Configuration
st.set_page_config(
    page_title="RAG Responder Hub",
    page_icon="🚒",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# 2. Main Header
st.title("🚒 RAG Responder Hub")
st.markdown("Welcome to the First Responder Portal. Select a module below to explore the accident scene or view 3D models.")

# 3. Create Toggle Tabs
tab1, tab2, tab3 = st.tabs(["VR Videos", "Gaussian Model Viewing", "Unity VR Module"])

with tab1:
    st.header("360° VR Video Viewer")
    st.markdown("Explore the accident scene using the 360° video viewer. Drag to rotate, scroll to zoom.")
    # Embed the existing inspector_portal.html
    try:
        with open("inspector_portal.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        # We wrap the HTML to ensure it displays correctly within Streamlit's iframe
        components.html(html_content, height=800, scrolling=True)
    except FileNotFoundError:
        st.error("inspector_portal.html not found. Please ensure it is in the same directory.")

with tab2:
    st.header("3D Gaussian Splatting Model")
    st.markdown("View high-fidelity 3D scans of the vehicle using Gaussian Splatting.")
    splat_url = "https://alistairwstbrk.github.io/splat-site/?url=https://huggingface.co/datasets/AlistairWstbrk/splats/resolve/main/3DGS%20.ply%20New%20Vehicle%20Scans/Equinox%20Hood%20Open%20(New)(Cropped).ply"
    components.iframe(splat_url, height=800, scrolling=True)

with tab3:
    st.header("Unity VR Module")
    st.info("🚧 The Unity VR module is currently in development. Once completed, it will be integrated here.")
