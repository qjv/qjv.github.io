from flask import Flask, request, render_template, send_from_directory
from PIL import Image, ImageOps
import os
from io import BytesIO
import uuid
import requests
import schedule
import time
import threading

app = Flask(__name__)
UPLOAD_FOLDER = "static/output"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Cleanup function to remove all files in the output folder
def cleanup_output_folder():
    """Clears files in the static/output folder."""
    for filename in os.listdir(UPLOAD_FOLDER):
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)
            print(f"Deleted {file_path}")

# Set the cleanup to run every 1 hour (or adjust the interval)
schedule.every(1).hour.do(cleanup_output_folder)

def run_schedule():
    """Run the scheduled tasks in the background."""
    while True:
        schedule.run_pending()
        time.sleep(1)

# Start the cleanup scheduler in a separate thread
cleanup_thread = threading.Thread(target=run_schedule)
cleanup_thread.daemon = True
cleanup_thread.start()

def fetch_image_from_url(url):
    """Fetch an image from a URL and return it as a PIL Image."""
    response = requests.get(url)
    img = Image.open(BytesIO(response.content))
    return img

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        file = request.files.get("image")
        image_url = request.form.get("image_url")

        if file:
            img = Image.open(file.stream)
        elif image_url:
            img = fetch_image_from_url(image_url)
        else:
            return render_template("index.html", error="Please upload an image or provide an image URL.")

        # Process image (crop and save)
        original = img.copy()  # Save original image
        
        xs, ys = img.size
        cropx, cropy = 26, 26
        cropped = img.crop((cropx, cropy, xs - cropx, ys - cropy))

        # Save images with unique filenames
        original_filename = f"{uuid.uuid4().hex}_original.png"
        cropped_filename = f"{uuid.uuid4().hex}_cropped.png"
        
        original.save(os.path.join(UPLOAD_FOLDER, original_filename))
        cropped.save(os.path.join(UPLOAD_FOLDER, cropped_filename))

        return render_template("index.html", 
                               original_filename=original_filename, 
                               cropped_filename=cropped_filename)
    return render_template("index.html", 
                           original_filename=None, 
                           cropped_filename=None)

@app.route("/download/<filename>")
def download(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
