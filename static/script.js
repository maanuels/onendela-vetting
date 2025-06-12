const urlInput = document.getElementById('urlInput');
const selectorInput = document.getElementById('selectorInput');
const analyzeButton = document.getElementById('analyzeButton');
const extractedContentArea = document.getElementById('extractedContent');
const loadingIndicator = document.getElementById('loadingIndicator');
const analyzeError = document.getElementById('analyzeError');

const chatWindow = document.getElementById('chatWindow');
const chatInput = document.getElementById('chatInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const chatError = document.getElementById('chatError');

// Elements for talent summarizer
const transcriptInput = document.getElementById('transcriptInput');
const jobDescriptionInput = document.getElementById('jobDescriptionInput');
const generateTalentSummaryButton = document.getElementById('generateTalentSummaryButton');
const talentSummaryOutput = document.getElementById('talentSummaryOutput');
const talentSummaryLoadingIndicator = document.getElementById('talentSummaryLoadingIndicator');
const talentSummaryError = document.getElementById('talentSummaryError');
const copyTalentSummaryButton = document.getElementById('copyTalentSummaryButton');

// Elements for talent submission template
const generateTalentSubmissionTemplateButton = document.getElementById('generateTalentSubmissionTemplateButton');
const talentSubmissionTemplateOutput = document.getElementById('talentSubmissionTemplateOutput');
const submissionTemplateLoadingIndicator = document.getElementById('submissionTemplateLoadingIndicator');
const submissionTemplateError = document.getElementById('submissionTemplateError');
const copyTalentSubmissionTemplateButton = document.getElementById('copyTalentSubmissionTemplateButton');


let latestTalentSummaryMarkdown = ''; 
let latestTalentSubmissionTemplateMarkdown = ''; // New variable for template Markdown

let chatHistory = [];
let analyzedDocumentContent = ''; // Stores the content from extractedContentArea

// Initialize marked.js to sanitize HTML output
marked.setOptions({
    gfm: true, // Enable GitHub Flavored Markdown
    breaks: true, // Convert line breaks to <br>
    sanitize: true // Sanitize the output HTML to prevent XSS attacks
});

// Function to enable/disable chat input and button based on ANY content being present
function updateChatAvailability() {
    const hasWebContent = extractedContentArea.value.trim().length > 0;
    const hasTranscriptContent = transcriptInput.value.trim().length > 0;
    const hasJobContent = jobDescriptionInput.value.trim().length > 0;

    const chatEnabled = hasWebContent || hasTranscriptContent || hasJobContent;
    setChatEnabled(chatEnabled);

    if (!chatEnabled) {
        // Clear chat if no content is available to chat about
        chatWindow.innerHTML = '<div class="text-gray-500 text-center text-sm py-2">Start by analyzing content, or pasting transcript/job description, then type your questions below!</div>';
    }
}

// Helper function to directly set chat input/button state
function setChatEnabled(enabled) {
    chatInput.disabled = !enabled;
    sendMessageButton.disabled = !enabled;
    // Removed chatInput.focus() from here to prevent automatic focusing
}

// Add a message to the chat window
function addMessage(sender, message, isError = false) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('flex', 'my-2', 'items-start', 'gap-3'); // Flex container for avatar/label and bubble

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('p-3', 'rounded-xl', 'shadow-sm', 'max-w-[75%]', 'break-words', 'relative');
    messageBubble.innerHTML = `<div class="font-semibold text-xs mb-1">${sender === 'user' ? 'You' : 'Gemini'}</div>`;

    const contentDiv = document.createElement('div');
    // Using 'markdown-content' for general markdown styling
    contentDiv.classList.add('markdown-content', 'text-gray-800'); 

    if (isError) {
        messageBubble.classList.add('bg-red-100', 'text-red-800', 'max-w-full', 'mx-auto', 'text-center');
        contentDiv.textContent = message; // No markdown for errors
    } else {
        contentDiv.innerHTML = marked.parse(message); // Render markdown
        if (sender === 'user') {
            messageBubble.classList.add('bg-blue-500', 'text-white', 'ml-auto', 'rounded-br-none');
            contentDiv.classList.add('text-white'); // Ensure text is white for user messages
        } else if (sender === 'ai') {
            messageBubble.classList.add('bg-gray-100', 'text-gray-800', 'mr-auto', 'rounded-bl-none');
        }
    }

    messageBubble.appendChild(contentDiv);
    messageWrapper.appendChild(messageBubble);

    // Add the message wrapper to the chat window
    chatWindow.appendChild(messageWrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to the latest message
}

// Analyze button click handler
analyzeButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const selector = selectorInput.value.trim();

    if (!url) {
        analyzeError.textContent = 'Please enter a URL.';
        analyzeError.classList.remove('hidden');
        return;
    }

    analyzeError.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');
    analyzeButton.disabled = true; // Disable button during analysis
    extractedContentArea.value = ''; // Clear previous content
    analyzedDocumentContent = ''; // Clear stored content

    updateChatAvailability(); // Disable chat during analysis, re-evaluate after

    try {
        const response = await fetch('http://127.0.0.1:5000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, selector }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        analyzedDocumentContent = data.content; // Store the analyzed content
        extractedContentArea.value = analyzedDocumentContent || 'No content extracted for the given selector.';
        
        // Only add message to chat if there's actual content to chat about
        if (analyzedDocumentContent) {
             addMessage('ai', 'Web content analysis complete. You can now chat about the extracted content and any other inputs.');
        }
       
    } catch (error) {
        console.error('Error analyzing content:', error);
        analyzeError.textContent = `Error: ${error.message}`;
        analyzeError.classList.remove('hidden');
        extractedContentArea.value = 'Failed to extract content.';
    } finally {
        loadingIndicator.classList.add('hidden');
        analyzeButton.disabled = false; // Re-enable button
        updateChatAvailability(); // Re-evaluate chat availability after analysis
    }
});

// Send message button click handler
sendMessageButton.addEventListener('click', async () => {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    // Ensure at least one content source is available for chat
    const hasWeb = analyzedDocumentContent.length > 0;
    const hasTranscript = transcriptInput.value.trim().length > 0;
    const hasJob = jobDescriptionInput.value.trim().length > 0;

    if (!hasWeb && !hasTranscript && !hasJob) {
        chatError.textContent = 'Please provide at least one content source (Web Content, Transcript, or Job Description) to start the chat.';
        chatError.classList.remove('hidden');
        return;
    }


    addMessage('user', userMessage);
    chatInput.value = ''; // Clear textarea after sending
    chatError.classList.add('hidden');
    sendMessageButton.disabled = true; // Disable send button while waiting for response

    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    try {
        const response = await fetch('http://127.0.0.1:5000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                history: chatHistory,
                documentContent: analyzedDocumentContent,
                transcriptContent: transcriptInput.value.trim(),
                jobContent: jobDescriptionInput.value.trim()
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const aiMessage = data.response;
        addMessage('ai', aiMessage);
        chatHistory.push({ role: 'model', parts: [{ text: aiMessage }] });

    } catch (error) {
        console.error('Error sending message to chatbot:', error);
        chatError.textContent = `Chat Error: ${error.message}`;
        chatError.classList.remove('hidden');
        addMessage('system', `Chat Error: ${error.message}`, true); // Add error message to chat window
        // Remove the last user message from history if the AI failed to respond
        chatHistory.pop();
    } finally {
        sendMessageButton.disabled = false; // Re-enable send button
    }
});

// Generate Talent Summary button click handler
generateTalentSummaryButton.addEventListener('click', async () => {
    const extractedContent = extractedContentArea.value.trim();
    const transcript = transcriptInput.value.trim();
    const jobDescription = jobDescriptionInput.value.trim();

    // Validation: transcript AND jobDescription must be present
    if (!transcript && !jobDescription) {
        talentSummaryError.textContent = 'Both Call Transcript and Job Description are required to generate a talent summary.';
        talentSummaryError.classList.remove('hidden');
        return;
    } else if (!transcript) {
        talentSummaryError.textContent = 'Call Transcript is required to generate a talent summary.';
        talentSummaryError.classList.remove('hidden');
        return;
    } else if (!jobDescription) {
        talentSummaryError.textContent = 'Job Description is required to generate a talent summary.';
        talentSummaryError.classList.remove('hidden');
        return;
    }

    talentSummaryError.classList.add('hidden');
    talentSummaryLoadingIndicator.classList.remove('hidden');
    generateTalentSummaryButton.disabled = true; // Disable button during generation
    talentSummaryOutput.innerHTML = ''; // Clear previous talent summary content
    copyTalentSummaryButton.style.display = 'none'; // Hide copy button initially

    try {
        const response = await fetch('http://127.0.0.1:5000/generate_talent_summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                extracted_content: extractedContent,
                transcript: transcript,
                job_description: jobDescription
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        latestTalentSummaryMarkdown = data.talent_summary; // Store the raw Markdown
        talentSummaryOutput.innerHTML = marked.parse(latestTalentSummaryMarkdown); // Render for display
        copyTalentSummaryButton.style.display = 'flex'; // Show copy button on success

    } catch (error) {
        console.error('Error generating talent summary:', error);
        talentSummaryError.textContent = `Error: ${error.message}`;
        talentSummaryError.classList.remove('hidden');
        talentSummaryOutput.innerHTML = '<p class="text-red-600">Failed to generate talent summary.</p>'; // HTML error message
        copyTalentSummaryButton.style.display = 'none'; // Keep copy button hidden on failure
    } finally {
        talentSummaryLoadingIndicator.classList.add('hidden');
        generateTalentSummaryButton.disabled = false; // Re-enable button
    }
});

// Copy Talent Summary to Clipboard
copyTalentSummaryButton.addEventListener('click', () => {
    const summaryTextToCopy = latestTalentSummaryMarkdown || ''; 

    if (summaryTextToCopy) {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = summaryTextToCopy;
        tempTextArea.style.position = 'fixed';
        tempTextArea.style.left = '-9999px';
        document.body.appendChild(tempTextArea);

        tempTextArea.select();
        try {
            document.execCommand('copy');
            const originalText = copyTalentSummaryButton.innerHTML;
            copyTalentSummaryButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Copied!</span>';
            setTimeout(() => {
                copyTalentSummaryButton.innerHTML = originalText;
            }, 1500);

        } catch (err) {
            console.error('Failed to copy text:', err);
            prompt('Copy to clipboard: Ctrl+C, Enter', summaryTextToCopy);
        } finally {
            document.body.removeChild(tempTextArea);
        }
    }
});

// New: Generate Talent Submission Template button click handler
generateTalentSubmissionTemplateButton.addEventListener('click', async () => {
    const extractedContent = extractedContentArea.value.trim();
    const transcript = transcriptInput.value.trim();
    const jobDescription = jobDescriptionInput.value.trim();
    const profileUrl = urlInput.value.trim(); // Get the URL from the input field

    // Enforce Call Transcript and Job Description for template generation as well
    if (!transcript && !jobDescription) {
        submissionTemplateError.textContent = 'Both Call Transcript and Job Description are required to generate a submission template.';
        submissionTemplateError.classList.remove('hidden');
        return;
    } else if (!transcript) {
        submissionTemplateError.textContent = 'Call Transcript is required to generate a submission template.';
        submissionTemplateError.classList.remove('hidden');
        return;
    } else if (!jobDescription) {
        submissionTemplateError.textContent = 'Job Description is required to generate a submission template.';
        submissionTemplateError.classList.remove('hidden');
        return;
    }

    submissionTemplateError.classList.add('hidden');
    submissionTemplateLoadingIndicator.classList.remove('hidden');
    generateTalentSubmissionTemplateButton.disabled = true; // Disable button during generation
    talentSubmissionTemplateOutput.innerHTML = ''; // Clear previous output
    copyTalentSubmissionTemplateButton.style.display = 'none'; // Hide copy button initially

    try {
        const response = await fetch('http://127.0.0.1:5000/generate_talent_submission_template', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                extracted_content: extractedContent,
                transcript: transcript,
                job_description: jobDescription,
                profile_url: profileUrl // Pass the profile_url explicitly
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        latestTalentSubmissionTemplateMarkdown = data.talent_submission_template; // Store raw Markdown
        talentSubmissionTemplateOutput.innerHTML = marked.parse(latestTalentSubmissionTemplateMarkdown); // Render for display
        copyTalentSubmissionTemplateButton.style.display = 'flex'; // Show copy button on success

    } catch (error) {
        console.error('Error generating talent submission template:', error);
        submissionTemplateError.textContent = `Error: ${error.message}`;
        submissionTemplateError.classList.remove('hidden');
        talentSubmissionTemplateOutput.innerHTML = '<p class="text-red-600">Failed to generate template.</p>'; // HTML error message
        copyTalentSubmissionTemplateButton.style.display = 'none'; // Keep hidden on failure
    } finally {
        submissionTemplateLoadingIndicator.classList.add('hidden');
        generateTalentSubmissionTemplateButton.disabled = false; // Re-enable button
    }
});

// New: Copy Talent Submission Template to Clipboard
copyTalentSubmissionTemplateButton.addEventListener('click', () => {
    const templateTextToCopy = latestTalentSubmissionTemplateMarkdown || ''; 

    if (templateTextToCopy) {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = templateTextToCopy;
        tempTextArea.style.position = 'fixed';
        tempTextArea.style.left = '-9999px';
        document.body.appendChild(tempTextArea);

        tempTextArea.select();
        try {
            document.execCommand('copy');
            const originalText = copyTalentSubmissionTemplateButton.innerHTML;
            copyTalentSubmissionTemplateButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Copied!</span>';
            setTimeout(() => {
                copyTalentSubmissionTemplateButton.innerHTML = originalText;
            }, 1500);

        } catch (err) {
            console.error('Failed to copy text:', err);
            prompt('Copy to clipboard: Ctrl+C, Enter', templateTextToCopy);
        } finally {
            document.body.removeChild(tempTextArea);
        }
    }
});


// Enable multi-line input for chat and handle submission
chatInput.addEventListener('keydown', (event) => {
    // If Enter is pressed without Shift, prevent default and send message
    if (event.key === 'Enter' && !event.shiftKey && !sendMessageButton.disabled) {
        event.preventDefault(); // Prevent new line in textarea
        sendMessageButton.click();
    }
});

// Adjust chat input height dynamically
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto'; // Reset height to recalculate
    chatInput.style.height = chatInput.scrollHeight + 'px'; // Set height to scrollHeight
});

// Event listeners for content changes to update chat availability
// Listen to 'input' event for immediate feedback on text changes
extractedContentArea.addEventListener('input', updateChatAvailability);
transcriptInput.addEventListener('input', updateChatAvailability);
jobDescriptionInput.addEventListener('input', updateChatAvailability);

// Also listen to 'change' event for robustness (e.g., for paste operations)
extractedContentArea.addEventListener('change', updateChatAvailability);
transcriptInput.addEventListener('change', updateChatAvailability);
jobDescriptionInput.addEventListener('change', updateChatAvailability);

// NEW: Also listen to 'blur' event for robustness (e.g., for paste operations and then losing focus)
extractedContentArea.addEventListener('blur', updateChatAvailability);
transcriptInput.addEventListener('blur', updateChatAvailability);
jobDescriptionInput.addEventListener('blur', updateChatAvailability);

// Ensure that updateChatAvailability is called when content is pasted, as 'input' event might not always catch it.
// This is done by adding a 'paste' event listener.
extractedContentArea.addEventListener('paste', () => setTimeout(updateChatAvailability, 0));
transcriptInput.addEventListener('paste', () => setTimeout(updateChatAvailability, 0));
jobDescriptionInput.addEventListener('paste', () => setTimeout(updateChatAvailability, 0));


// Initially disable chat and hide copy buttons
setChatEnabled(false);
copyTalentSummaryButton.style.display = 'none';
copyTalentSubmissionTemplateButton.style.display = 'none';

// Initial check for chat availability on page load
updateChatAvailability();
