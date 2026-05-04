import streamlit as st
import streamlit.components.v1 as components
import requests
import uuid

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
    components.iframe(
        "https://d1ni7nkjr0eveg.cloudfront.net/inspector_portal.html",
        height=800,
        scrolling=True
    )

WEBHOOK_URL = "https://irfangazi.app.n8n.cloud/webhook/a7782f7b-3403-48c3-9e6d-c14772a002a1"

if "gauss_session_id" not in st.session_state:
    st.session_state.gauss_session_id = str(uuid.uuid4())
if "gauss_messages" not in st.session_state:
    st.session_state.gauss_messages = []

with tab2:
    st.header("3D Gaussian Splatting Model")
    st.markdown("View high-fidelity 3D scans of the vehicle using Gaussian Splatting.")

    viewer_col, chat_col = st.columns([2, 1])

    splat_url = "https://alistairwstbrk.github.io/splat-site/?url=https://huggingface.co/datasets/AlistairWstbrk/splats/resolve/main/3DGS%20.ply%20New%20Vehicle%20Scans/Equinox%20Hood%20Open%20(New)(Cropped).ply"
    with viewer_col:
        components.iframe(splat_url, height=750, scrolling=True)

    with chat_col:
        st.subheader("Ask the RAG Assistant")

        chat_container = st.container(height=620)
        with chat_container:
            for msg in st.session_state.gauss_messages:
                with st.chat_message(msg["role"]):
                    st.markdown(msg["content"])

        if prompt := st.chat_input("Ask about the Mach-E…", key="gauss_chat_input"):
            st.session_state.gauss_messages.append({"role": "user", "content": prompt})
            with chat_container:
                with st.chat_message("user"):
                    st.markdown(prompt)

            with chat_container:
                with st.chat_message("assistant"):
                    with st.spinner("Thinking…"):
                        try:
                            resp = requests.post(
                                WEBHOOK_URL,
                                json={"question": prompt, "session_id": st.session_state.gauss_session_id},
                                timeout=30,
                            )
                            resp.raise_for_status()
                            answer = resp.json().get("output", "No response from agent.")
                        except Exception as e:
                            answer = f"Error contacting the agent: {e}"
                    st.markdown(answer)
            st.session_state.gauss_messages.append({"role": "assistant", "content": answer})

with tab3:
    st.header("Unity VR Module")
    st.info("🚧 The Unity VR module is currently in development. Once completed, it will be integrated here.")
