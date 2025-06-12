# Onedela Matching Vetting AI

This project aims to help Matching team to create vetting notes, talent summary and client pitches based on the talent's profile, call transcript and the job description itself

## Features

- Profile Summary
- Talent Customer Pitch
- Rate Summary
- Vetting Notes
- Chatbot

## Tech

- Gemini AI
- Python
- Javascript

## Gemini API
This project requires you to create a `.env` file at the root of the folder with the following content:

`GEMINI_API_KEY="YOUR_API_KEY_HERE"`

You can use the following link to get an API KEY https://ai.google.dev/gemini-api/docs/api-key and click on the "Get a Gemini API key in Google AI Studio" button

This will redirect you to api studio and then follow the instructions to `+ Create API Key`. Once created update the .env file accordingly with the new API Key

## Installation

Requires Python Python 3.13.3

Navigate to the root folder of the proejct
```sh
cd onedela-vetting
```
Install the dependencies and devDependencies and start the server.
```sh
cd onedela-vetting
pip install Flask[async] playwright google-generativeai flask-cors python-dotenv
python -m playwright installpython
```

Run he application
```sh
python app.py
```

Navigate to 
```sh
http://localhost:5000/
```

## How to use

- Input the Talent profile URL (https://client.andela.com//talent/profile/c658e7d4-24d6-438c-8c6c-d787cd643cf4)
- Input the call transcript, just a raw copy and paste
- Input the job description

Analyze Content
- Generates a summary of the talent's profile based only on its profile

Generate Summary
- Generates the talent summary combining all 3 input fields

Generate Client Template
- Generates the client pitch template so that you are able to share all required details to the client for sharing

Chatbot
- The Chatbot itself uses the input data so that you can interact and ask questions ONLY based on the information that is available.
- A handy question could be `Summarize Rates`

