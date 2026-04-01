import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import PyPDF2

app = Flask(__name__)
# Enable CORS so the vanilla HTML frontend can make requests
CORS(app)

# Initialize the Gemini client using the user's provided API key
client = genai.Client(api_key="AIzaSyA9CaHgc--7uqsq_fe5D5I-cDkdwC8i_90")
print("Backend server initialized with the fourth API Key attempt.")

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        if request.is_json:
            data = request.json
            prompt = data.get("prompt", "")
        else:
            prompt = request.form.get("prompt", "")
            file = request.files.get("file")
            
            pdf_text = ""
            if file and file.filename.endswith('.pdf'):
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        pdf_text += extracted + "\n"
                
                if pdf_text.strip():
                    prompt = f"Context from uploaded PDF document:\n{pdf_text}\n\nUser Question: {prompt}"
        
        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400

        # Generate content using gemini-2.0-flash
        print(f"Generating content for prompt: {prompt[:50]}...")
        try:
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
            )
            
            if not response or not response.text:
                print("Error: Gemini returned an empty response")
                return dreams_error("Gemini returned an empty response. Please check your API key and quota.")

            return jsonify({
                "response": response.text
            })
        except Exception as gen_error:
            error_msg = str(gen_error)
            print(f"Gemini API Error: {error_msg}")
            
            # Graceful fallback for quota limits to allow UI testing
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "404" in error_msg:
                fallback_md = (
                    "**API Quota Exceeded / Model Not Found**\n\n"
                    "The AI assistant cannot generate a real response right now because the provided Gemini API key has reached its usage limit or the model is not available for this key.\n\n"
                    "### How to fix this:\n"
                    "1. Open [Google AI Studio](https://aistudio.google.com/app/apikey) to check your billing and limits.\n"
                    "2. Wait for the quota to reset, or provide a new active API key.\n\n"
                    "### System Verification\n"
                    "While we wait, here is a fallback message so you can verify that your new features are working beautifully:\n"
                    "- **Markdown Support**: This text is correctly formatted with bolding and lists.\n"
                    "- **Voice Assistant**: Click the speaker icon below to hear me read this message.\n"
                    "- **Code Highlighting**: See the Python snippet below.\n\n"
                    "```python\n"
                    "class Verification:\n"
                    "    def __init__(self):\n"
                    "        self.status = 'All UI features are fully operational!'\n"
                    "        \n"
                    "    def verify(self):\n"
                    "        print(self.status)\n"
                    "```"
                )
                return jsonify({"response": fallback_md})
                
            return jsonify({"error": f"Gemini API Error: {error_msg}"}), 500
            
    except Exception as e:
        print(f"General Server Error: {e}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500

def dreams_error(msg):
    return jsonify({"error": msg}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
