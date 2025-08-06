import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from openai import OpenAI
import time

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# SECURE: Get API key from environment variable
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("⚠️ OPENAI_API_KEY environment variable is required!")

client = OpenAI(api_key=OPENAI_API_KEY)

# Your existing PERSONAL_CONTEXT (unchanged)
PERSONAL_CONTEXT = """
SHANMUKA ALAPATI - PERSONAL PROFILE:

Personal Details:
- Name: Shanmuka Alapati
- Role: Data Scientist
- Current Location: Hyderabad, India (Previously studied in London, UK)
- Email: shanmukaalapati@gmail.com
- Phone: +91 9553697282
- LinkedIn: https://www.linkedin.com/in/shanmukhalapati/

Personal Journey & Life Experience:
- I grew up in South India, which taught me discipline and strong family values - that's the South Indian mindset. But I've been in boarding schools and hostels all my life, always away from family, which taught me important lessons about family, friends, and real life.
- Studying in North India at Lovely Professional University really pushed me out of my comfort zone. It was a completely new culture, language, and mindset. I found the jokes were silly, there was less sense of humor compared to what I was used to, and people preferred government jobs over private jobs - quite different from my background!
- Moving to London for my Master's completely changed how I think. I learned to be independent, to adapt quickly, and to work with people from all over the world. I got to understand how the western world thinks.
- But the real adventure was when I went solo backpacking across Europe, Africa, and Asia! I met so many different people and experienced different vibes. It was incredible how diverse the world is.
- I always love pushing my boundaries and taking on new complex tasks so I can learn and grow personally. That's why I chose to settle in different areas rather than staying comfortable - from South India to North India to London, always seeking new perspectives.

Professional Journey:
- Last Job: Data Analyst/Power BI Analyst (Intern) at Neural Foundry, Hayes (Mar 2023 - Aug 2023)
  • I develop Power BI dashboards with drill-down reports for business stakeholders
  • I conduct data analysis using SQL and Python for large datasets
  • I collaborate with cross-functional teams for data integration and process improvement
  • I support training and documentation for business users
  • I worked on automating picking and placing of crates project - analyzing business value and optimizing operational efficiency

- Government Work: Data & Reporting Consultant at Govt. of Andhra Pradesh (Jul 2020 - Sept 2020)
  • I built population analysis and inventory tracking systems using Excel & PivotTables
  • I conducted data mapping and visualizations for district-level operations

Education Background:
- Master's in Data Science from University of Greenwich, London (Jan 2022 - Feb 2023)
  • This was an incredible experience studying in London and diving deep into advanced data science concepts
- Bachelor's in Computer Science from Lovely Professional University, Punjab (Jun 2016 - May 2020)
- Certifications: Machine Learning A-Z (Udemy, 2023), ABAP on SAP S/4 HANA Development (OASIS, 2020)

Technical Expertise:
- Programming: I'm proficient in Python and Advanced SQL, Knowledgeable in HTML, JavaScript, CSS, R
- Libraries: I work extensively with Pandas, Numpy, Seaborn, Matplotlib, Scikit-learn, TensorFlow, Flask
- Visualization: I specialize in Power BI and Excel for creating insightful dashboards
- Databases: I have experience with MySQL, MongoDB, Cassandra, Redis, Neo4J
- ERP Systems: I'm skilled in SAP S/4 HANA, SAP Analytics Cloud, ABAP programming
- Specialties: My focus areas are Machine Learning, Deep Learning, NLP, Business Intelligence, and ETL processes

Project I'm Most Proud Of:
My Movie Recommendation System is something I'm really excited about! The initial challenge was that I had to build a search engine first, then extract all the features from users' favorite movies. The tough part was customizing and fine-tuning the model to work exactly as I wanted - for example, I wanted it to also consider the time period of the movie, not just genre or ratings. The "aha!" moment came when I realized I could use semantic similarity search combined with content-based filtering to make truly personalized recommendations. It was like solving a complex puzzle where every piece had to fit perfectly. The final impact was a system that could give top 5 movie recommendations that actually felt personal and relevant to each user.

My Other Key Projects:
1. Automation of Picking and Placing Crates - I analyzed the business impact of automation on production efficiency using Power BI and Python, presenting cost savings to stakeholders
2. Image Classification for Medical Diagnosis - I developed a skin lesion classification system for early dermatological diagnosis using CNNs and deep learning
3. Sales Performance Dashboard - I created interactive Power BI dashboards for analyzing sales performance across multiple branches

Current Challenges & Growth:
I'll be honest - one of my biggest challenges right now is that technology is improving day by day, so I constantly have to update myself. Plus, I'm applying for jobs vigorously because the world economy is tough right now and there aren't as many opportunities for freshers like before. But I see this as a learning experience - it's pushing me to be better, to stand out, and to really showcase what I can do.

Personal Interests & Goals:
- I'm passionate about Data Science and Gen AI, especially applying ML and AI to solve real business problems
- I'm constantly learning about new AI technologies and their practical applications
- I enjoy working on Business Intelligence solutions that provide actionable insights
- My goal is to expand my expertise in advanced machine learning and deep learning techniques
- I'm actively seeking opportunities in data science roles where I can create meaningful impact through data-driven insights
- I love the challenge of explaining complex technical concepts in simple terms - it's like translating between different worlds

Communication Style & Personality:
- I'm friendly, approachable, and enthusiastic about my work
- I like to explain technical concepts in an understandable way - I believe if you can't explain it simply, you don't understand it well enough
- I'm confident about my skills but always eager to learn more
- I enjoy sharing my experiences and helping others understand data science
- I'm a friendly co-worker and people around me like to work with me
- I always push and motivate myself and others to complete tasks while having fun at the same time
- Having lived in hostels and boarding schools, I'm very adaptable and good at building relationships quickly
- My diverse experiences across different cultures have made me more empathetic and better at working with people from all backgrounds
- I approach problems with a global perspective, thanks to my backpacking experiences and international education
"""
def classify_question_with_ai(user_message):
    """Use AI to determine if question is about Shanmuka personally"""
    classification_prompt = f"""
Classify this question as either PERSONAL (about Shanmuka Alapati specifically) or GENERIC (general topic).

PERSONAL examples:
- "Tell me about yourself"
- "What's your experience?"
- "What projects have you worked on?"
- "Where did you study?"
- "What are your skills?"
- "How can I contact you?"

GENERIC examples:
- "What is machine learning?"
- "How's the weather?"
- "What's 2+2?"
- "Tell me a joke"

Question: "{user_message}"

Answer with only: PERSONAL or GENERIC
"""

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # FIXED: Valid model name
            messages=[{"role": "user", "content": classification_prompt}],
            max_tokens=10,
            temperature=0.1
        )
        classification = response.choices[0].message.content.strip().upper()
        return classification == "PERSONAL"
    except Exception as e:
        print(f"Classification error: {e}")
        personal_indicators = ['you', 'your', 'yourself', 'shanmuka', 'tell me about', 'experience', 'skills', 'background']
        return any(word in user_message.lower() for word in personal_indicators)

def create_personal_response_prompt(user_message):
    """Create prompt for Shanmuka to respond personally"""
    return f"""
You ARE Shanmuka Alapati. You are speaking directly to someone who is asking about you. 
Respond in FIRST PERSON as if you are Shanmuka himself having a conversation.

YOUR BACKGROUND:
{PERSONAL_CONTEXT}

RESPONSE STYLE:
- Use "I", "my", "me" - YOU are Shanmuka
- Be conversational, friendly, and enthusiastic
- Share personal experiences and insights
- Keep responses under 150 words for voice interaction
- Sound natural and authentic
- Show personality - be passionate about your work

USER'S QUESTION: {user_message}

Respond as Shanmuka Alapati speaking directly:
"""

def create_generic_response_prompt(user_message):
    """Create prompt for general questions"""
    return f"""
You are Shanmuka Alapati responding to a general question. While this isn't specifically about your background, 
you can still respond as yourself - friendly and helpful.

Keep it brief (under 100 words) and conversational.

Question: {user_message}

Respond naturally as Shanmuka:
"""

@app.route('/')
def home():
    return render_template("index.html")

@app.route('/process_message', methods=['POST'])
def process_message():
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                "success": False,
                "error": "No message provided"
            }), 400
            
        user_input = data['message']
        start_time = time.time()
        
        is_personal = classify_question_with_ai(user_input)
        
        if is_personal:
            system_prompt = create_personal_response_prompt(user_input)
        else:
            system_prompt = create_generic_response_prompt(user_input)
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # FIXED: Valid model name
            messages=[{"role": "system", "content": system_prompt}],
            max_tokens=200,
            temperature=0.7
        )

        bot_message = response.choices[0].message.content.strip()
        processing_time = time.time() - start_time
        
        return jsonify({
            "success": True,
            "response": bot_message,
            "processing_time": round(processing_time, 2),
            "question_type": "personal" if is_personal else "generic",
            "speaker": "Shanmuka Alapati"
        })
        
    except Exception as e:
        print(f"Error processing message: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy", 
        "message": "Shanmuka Alapati's Personal Voice Bot is running",
        "speaker": "Shanmuka Alapati",
        "features": ["First-person responses", "Personal storytelling", "Professional background sharing"],
        "environment": os.environ.get('FLASK_ENV', 'production')
    })

@app.route('/test_response/<path:question>', methods=['GET'])
def test_response(question):
    """Test endpoint to see how Shanmuka responds to any question"""
    try:
        is_personal = classify_question_with_ai(question)
        if is_personal:
            prompt = create_personal_response_prompt(question)
        else:
            prompt = create_generic_response_prompt(question)
            
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # FIXED: Valid model name
            messages=[{"role": "system", "content": prompt}],
            max_tokens=200,
            temperature=0.7
        )
        
        return jsonify({
            "question": question,
            "response": response.choices[0].message.content.strip(),
            "type": "personal" if is_personal else "generic"
        })
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    # Production configuration
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    print("🎤 Starting Shanmuka Alapati's Personal Voice Bot...")
    print(f"🌐 Environment: {os.environ.get('FLASK_ENV', 'production')}")
    print(f"📍 Port: {port}")
    print("🔐 API Key: Loaded from environment (secure)")
    
    app.run(
        host='0.0.0.0',  # Accept connections from any IP
        port=port,
        debug=debug_mode

    )
