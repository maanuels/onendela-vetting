import asyncio
from flask import Flask, request, jsonify, render_template
from playwright.async_api import async_playwright
import google.generativeai as genai
import os
import logging
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Get Gemini API key from environment variable
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    logging.warning("GEMINI_API_KEY is not set. Chatbot and summarization functionality will be limited or fail. Please set it in a .env file.")
else:
    genai.configure(api_key=GEMINI_API_KEY)
    logging.info("Gemini API configured.")

# --- Playwright Web Content Extraction ---
async def extract_content(url, selector=None):
    """
    Extracts text content from a given URL using Playwright.
    If a selector is provided, it extracts content only from elements matching the selector.
    Otherwise, it extracts the entire body text.
    """
    logging.info(f"Attempting to extract content from: {url} with selector: {selector}")
    browser = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            await page.goto(url, wait_until='domcontentloaded', timeout=60000) # 60 seconds timeout
            await page.wait_for_load_state('networkidle') # Wait for network to be idle

            if selector:
                # Wait for the selector to be present in the DOM
                await page.wait_for_selector(selector, timeout=30000) # 30 seconds timeout
                elements = await page.query_selector_all(selector)
                content_parts = []
                for element in elements:
                    text = await element.text_content()
                    if text:
                        content_parts.append(text.strip())
                extracted_text = "\n\n".join(content_parts)
                if not extracted_text:
                    logging.warning(f"No content found for selector: {selector} on {url}")
                    return "No content found for the given selector."
            else:
                extracted_text = await page.locator('body').text_content()

            logging.info(f"Successfully extracted content from {url}. Length: {len(extracted_text)} characters.")
            return extracted_text.strip()

    except Exception as e:
        logging.error(f"Error during content extraction from {url}: {e}")
        # Return a user-friendly error message
        return f"Failed to extract content: {e}. Please ensure the URL is correct and the selector (if any) exists."
    finally:
        if browser:
            await browser.close()
            logging.info("Browser closed.")

# --- Flask Routes ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
async def analyze_content_endpoint():
    """
    API endpoint to receive URL and selector, then extract content.
    """
    data = request.get_json()
    url = data.get('url')
    selector = data.get('selector')

    if not url:
        return jsonify({"error": "URL is required."}), 400

    if not url.startswith(('http://', 'https://')):
        return jsonify({"error": "Invalid URL. Must start with http:// or https://."}), 400

    logging.info(f"Received analysis request for URL: {url}, Selector: {selector}")

    # Run the async Playwright function
    content = await extract_content(url, selector)

    if "Failed to extract content" in content:
        return jsonify({"error": content}), 500 # Return error message if extraction failed

    return jsonify({"content": content})

@app.route('/chat', methods=['POST'])
def chat_with_content_endpoint():
    """
    API endpoint to handle chatbot conversation based on extracted content.
    """
    data = request.get_json()
    history = data.get('history', [])
    document_content = data.get('documentContent', '')
    transcript_content = data.get('transcriptContent', '')
    job_content = data.get('jobContent', '')
    
    if not (document_content or transcript_content or job_content):
        return jsonify({"error": "At least one of Talent Resume, Call Transcript, or Job Description is required to start a chat based on the documents."}), 400

    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key is not configured. Cannot chat."}), 503

    try:
        # Correctly format the initial instruction to embed the variable content
        initial_instruction = (
            f"You are a helpful AI assistant who understands technology, so assume that you are a Sr Architect who is interviewing candidates and assessing the talen's proficiency in order to get them hired." + 
                "You will answer questions based *only* on the following documents:\n\n"
            f"Talent Resume:\n{document_content}\n\n"
            f"Vetting Transcript:\n{transcript_content}\n\n"
            f"Job Description:\n{job_content}\n\n"
            "If the answer is not found in any of the documents, politely state that you cannot answer based on the provided information. Avoid making up information."
        )

        full_history = [
            {"role": "user", "parts": [{"text": initial_instruction}]},
            {"role": "user", "parts": [{"text": "If asked about the Take rate use the talent rate from the transcript and the job description defines the job rate. "+
                "Therefore, share the Take Rate Percentage using this format: **Talent Rate: {talent rate}** \n **Job Rate:** {job rate} \n **Take Rate**: {(Job Rate - Talent Rate) / Job Rate = Take Rate Percentage}"}]},
            {"role": "model", "parts": [{"text": "Okay, I understand. I will do my best to answer your questions based solely on the provided documents."}]}
        ]
        
        # Append the actual user-model chat history
        for msg in history:
            full_history.append(msg)

        model = genai.GenerativeModel('gemini-2.0-flash')
        convo = model.start_chat(history=full_history)

        latest_user_message = history[-1]['parts'][0]['text']
        logging.info(f"Sending to Gemini for chat: {latest_user_message}")
        
        response = convo.send_message(latest_user_message)
        
        ai_response = response.text
        logging.info(f"Received from Gemini for chat: {ai_response}")
        return jsonify({"response": ai_response})

    except Exception as e:
        logging.error(f"Error during Gemini chat API call: {e}")
        return jsonify({"error": f"Chatbot error: {e}. Please try again later."}), 500

@app.route('/generate_talent_summary', methods=['POST'])
def generate_talent_summary_endpoint():
    """
    API endpoint to receive extracted content, transcript, and job description,
    then generate a comprehensive talent summary using the Gemini API.
    """
    data = request.get_json()
    extracted_content = data.get('extracted_content', '')
    transcript = data.get('transcript', '')
    job_description = data.get('job_description', '')

    # Enforce transcript and job_description for this endpoint
    if not transcript or not job_description:
        return jsonify({"error": "Both Call Transcript and Job Description are required for talent summarization."}), 400

    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key is not configured. Cannot generate talent summary."}), 503

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Construct the prompt for talent summarization
        prompt_parts = []
        prompt_parts.append("Generate a comprehensive talent summary based on the following information. Focus on skills, experience, qualifications, and how they relate to potential job roles. Highlight key strengths and areas of expertise. Format the summary concisely using Markdown (e.g., bullet points for key items, bolding for important terms).\n\n")

        if extracted_content:
            prompt_parts.append(f"--- Extracted Web Content (e.g., Resume/Profile):\n{extracted_content}\n")
        if transcript:
            prompt_parts.append(f"--- Call Transcript/Interview Notes:\n{transcript}\n")
        if job_description:
            prompt_parts.append(f"--- Job Description (for context/matching):\n{job_description}\n")

        full_prompt = "".join(prompt_parts)
        
        logging.info("Sending data to Gemini for talent summary generation.")
        response = model.generate_content(full_prompt)
        
        talent_summary = response.text
        logging.info(f"Received talent summary from Gemini. Length: {len(talent_summary)} characters.")
        return jsonify({"talent_summary": talent_summary})

    except Exception as e:
        logging.error(f"Error during Gemini talent summary API call: {e}")
        return jsonify({"error": f"Talent summary generation error: {e}. Please try again later."}), 500

@app.route('/generate_talent_submission_template', methods=['POST'])
def generate_talent_submission_template_endpoint():
    """
    API endpoint to receive extracted content, transcript, and job description,
    then generate a talent submission template using the Gemini API.
    """
    data = request.get_json()
    extracted_content = data.get('extracted_content', '')
    transcript = data.get('transcript', '')
    job_description = data.get('job_description', '')
    profile_url = data.get('profile_url', '')

    # Enforce transcript and job_description for this endpoint as well
    if not transcript or not job_description:
        return jsonify({"error": "Both Call Transcript and Job Description are required to generate a submission template."}), 400

    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key is not configured. Cannot generate submission template."}), 503

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Construct the prompt for talent submission template with explicit format
        prompt_parts = []
        prompt_parts.append("Based on the following candidate information (resume/profile, interview transcript) and the target job description, generate a talent submission template. Follow the exact Markdown output format provided below, extracting the information from the inputs. Do not add any prefixes like 'Talent Name: ' to the values. The 'Profile' value is {profile_url}.\n\n")
        
        prompt_parts.append("Output Format:\n\n")
        prompt_parts.append("**{talent name}**\n")
        prompt_parts.append("**{talent role}**\n")
        prompt_parts.append("**{years of experience (only the number)} years of experience**\n")
        prompt_parts.append("**Location:** {location}, {timezone}\n")
        prompt_parts.append("**Availability:** {availability}\n")
        prompt_parts.append("**Interview Availability:** {datetime hour range availability in based on JD timezone}\n")
        prompt_parts.append("**Overlap:** {overlap (only a single number or a range between 5-8)} hours\n")
        prompt_parts.append(f"**Profile:** {profile_url if profile_url else 'N/A'}\n\n") # Use the captured profile_url
        prompt_parts.append("{summary at least 2 paragraphs written in third person and max 250 words total. Don't add any rate info here}\n")
        prompt_parts.append("{list 5 achievements without mentioning company names matching job description needs. Don't add any rate info here}\n\n")

        prompt_parts.append("--- Candidate Information ---\n")
        if extracted_content:
            prompt_parts.append(f"Resume/Profile (Extracted Web Content):\n{extracted_content}\n\n")
        if transcript:
            prompt_parts.append(f"Interview Transcript/Call Notes:\n{transcript}\n\n")
        if job_description:
            prompt_parts.append(f"Target Job Description:\n{job_description}\n\n")

        full_prompt = "".join(prompt_parts)
        
        logging.info("Sending data to Gemini for talent submission template generation.")
        response = model.generate_content(full_prompt)
        
        talent_submission_template = response.text
        logging.info(f"Received talent submission template from Gemini. Length: {len(talent_submission_template)} characters.")
        return jsonify({"talent_submission_template": talent_submission_template})

    except Exception as e:
        logging.error(f"Error during Gemini talent submission template API call: {e}")
        return jsonify({"error": f"Talent submission template generation error: {e}. Please try again later."}), 500


if __name__ == '__main__':
    # Flask runs on http://127.0.0.1:5000 by default
    # Use 0.0.0.0 to make it accessible externally if needed (e.g., in Docker)
    app.run(debug=True, host='0.0.0.0', port=5000)