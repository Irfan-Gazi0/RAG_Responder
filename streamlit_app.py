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

# 4. Floating Chat Bubble
# We hide the default sidebar toggle and create a custom floating bubble to toggle it
st.markdown("""
<style>
    /* Hide the default sidebar toggle button */
    [data-testid="collapsedControl"] {
        display: none;
    }
    
    /* Style for our floating bubble */
    .floating-chat-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #ef4444;
        color: white;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 30px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        cursor: pointer;
        z-index: 999999;
        transition: transform 0.2s, background-color 0.2s;
        border: none;
        outline: none;
    }
    .floating-chat-btn:hover {
        transform: scale(1.1);
        background-color: #dc2626;
    }
</style>

<div style="position: fixed; bottom: 20px; right: 20px; z-index: 999999;">
    <button class="floating-chat-btn" onclick="window.parent.document.querySelector('[data-testid=\\'collapsedControl\\']').click()">
        💬
    </button>
</div>
""", unsafe_allow_html=True)

# 5. Native Streamlit Chat in Sidebar
with st.sidebar:
    st.title("💬 First Responder GPT")
    st.markdown("Ask me anything about HV shutdown, fire response, no-cut zones, etc.")
    
    # Initialize chat history
    if "messages" not in st.session_state:
        st.session_state.messages = [
            {"role": "assistant", "content": "Hello! I am the First Responder GPT. How can I assist you with the incident today?"}
        ]

    # Display chat messages from history
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # Accept user input
    if prompt := st.chat_input("Type your question here..."):
        # Display user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Call the n8n webhook
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                webhook_url = "https://irfangazi.app.n8n.cloud/webhook/a7782f7b-3403-48c3-9e6d-c14772a002a1"
                
                # Setup session ID if not exists
                if "session_id" not in st.session_state:
                    st.session_state.session_id = str(uuid.uuid4())
                    
                payload = {
                    "question": prompt,
                    "session_id": st.session_state.session_id
                }
                
                try:
                    response = requests.post(webhook_url, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    
                    # Parse n8n response format
                    answer = data
                    if isinstance(data, list) and len(data) > 0:
                        answer = data[0]
                    if isinstance(answer, dict):
                        answer = answer.get("output", answer.get("text", answer.get("response", str(answer))))
                        
                    st.markdown(answer)
                    st.session_state.messages.append({"role": "assistant", "content": answer})
                    
                except Exception as e:
                    error_msg = f"⚠ Error communicating with the AI agent: {str(e)}"
                    st.error(error_msg)
                    st.session_state.messages.append({"role": "assistant", "content": error_msg})
