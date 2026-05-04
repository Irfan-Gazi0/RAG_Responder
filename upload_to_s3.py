import boto3
import os
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Load configuration from .env
load_dotenv()

# --- Configuration ---
VIDEOS_DIR = Path(__file__).parent / "360"
BUCKET_NAME = os.getenv("AWS_S3_BUCKET")
REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

def process_and_upload_videos():
    # Initialize S3 client using credentials from .env
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=REGION
    )

    if not BUCKET_NAME:
        print("Error: AWS_S3_BUCKET not found.")
        return

    video_files = list(VIDEOS_DIR.glob("*.mp4"))
    
    if not video_files:
        print(f"No .mp4 files found in {VIDEOS_DIR}.")
        return

    for video_path in video_files:
        # 1. Create a dedicated folder for this video's slices
        video_name = video_path.stem # e.g., 'your_video' without '.mp4'
        hls_dir = VIDEOS_DIR / video_name
        hls_dir.mkdir(exist_ok=True)
        
        m3u8_file = hls_dir / "index.m3u8"

        # 2. Slice the video using FFmpeg
        print(f"\n🎬 Slicing {video_path.name} into HLS chunks...")
        try:
            # Slicing into HLS with 5-second segments
            subprocess.run([
                "ffmpeg", "-i", str(video_path), 
                "-profile:v", "baseline", "-level", "3.0", 
                "-s", "3840x2160", "-start_number", "0", 
                "-hls_time", "5", "-hls_list_size", "0", 
                "-f", "hls", str(m3u8_file)
            ], check=True)
            print(f"✅ Slicing complete for {video_name}")
        except subprocess.CalledProcessError:
            print(f"❌ FFmpeg failed on {video_name}. Make sure ffmpeg is installed.")
            continue

        # 3. Upload the generated slices to AWS S3
        print(f"☁️ Uploading HLS files for {video_name} to AWS...")
        hls_files = list(hls_dir.glob("*")) # Gets the .m3u8 and all the .ts files
        
        for hls_file in hls_files:
            # This puts it in a folder in S3 like: videos/your_video/index.m3u8
            object_name = f"videos/{video_name}/{hls_file.name}"
            
            # Set the correct content type so the browser reads it right
            if hls_file.suffix == '.m3u8':
                content_type = 'application/x-mpegURL'
            elif hls_file.suffix == '.ts':
                content_type = 'video/MP2T'
            else:
                content_type = 'application/octet-stream'
            
            try:
                s3_client.upload_file(
                    str(hls_file), 
                    BUCKET_NAME, 
                    object_name,
                    ExtraArgs={'ContentType': content_type}
                )
            except Exception as e:
                print(f"❌ Failed to upload {hls_file.name}: {e}")
        
        print(f"🚀 Fully completed processing and uploading for {video_name}!")

if __name__ == "__main__":
    process_and_upload_videos()
