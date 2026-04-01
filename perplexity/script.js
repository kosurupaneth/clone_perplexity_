document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.querySelector('.input-area textarea');
    const centerContent = document.querySelector('.center-content');
    
    // Create a chat container and insert it before the input container
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container';
    chatContainer.style.display = 'none';
    chatContainer.style.width = '100%';
    chatContainer.style.marginBottom = '20px';
    chatContainer.style.display = 'flex';
    chatContainer.style.flexDirection = 'column';
    chatContainer.style.gap = '20px';
    
    const inputContainer = document.querySelector('.input-container');
    centerContent.insertBefore(chatContainer, inputContainer);

    let isFirstMessage = true;
    let selectedFile = null;

    // --- File Upload Integration ---
    const attachBtn = document.querySelector('.attach-btn');
    const fileInput = document.getElementById('file-upload');
    const fileNameDisplay = document.getElementById('file-name-display');

    attachBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            fileNameDisplay.textContent = selectedFile.name;
            fileNameDisplay.style.display = 'inline-flex';
        } else {
            selectedFile = null;
            fileNameDisplay.style.display = 'none';
        }
    });

    function clearFile() {
        selectedFile = null;
        fileInput.value = '';
        fileNameDisplay.style.display = 'none';
        fileNameDisplay.textContent = '';
    }
    // --- End File Upload Integration ---

    // --- Voice Assistant Integration ---
    const voiceBtn = document.querySelector('.voice-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
    let isListening = false;

    if (recognition) {
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            voiceBtn.classList.add('listening');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            textarea.value = finalTranscript || interimTranscript;
            textarea.dispatchEvent(new Event('input')); // Trigger auto-resize
        };

        recognition.onend = () => {
            isListening = false;
            voiceBtn.classList.remove('listening');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            voiceBtn.classList.remove('listening');
        };

        voiceBtn.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    }

    // --- Voice Selection Integration ---
    const voiceSelect = document.querySelector('.voice-select-btn');
    let voices = [];
    let selectedVoice = null;

    function loadVoices() {
        if (!window.speechSynthesis) return;
        voices = window.speechSynthesis.getVoices();
        
        // Filter for English voices by default, but show all if none found
        let filteredVoices = voices.filter(voice => voice.lang.includes('en'));
        if (filteredVoices.length === 0) filteredVoices = voices;

        if (voiceSelect) {
            voiceSelect.innerHTML = filteredVoices.map((voice, index) => 
                `<option value="${index}" ${voice.default ? 'selected' : ''}>${voice.name}</option>`
            ).join('');
            
            // Set initial voice
            const defaultIndex = voiceSelect.selectedIndex;
            if (defaultIndex !== -1) {
                selectedVoice = filteredVoices[defaultIndex];
            }
        }
    }

    if (window.speechSynthesis) {
        // Voices are loaded asynchronously
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        loadVoices();

        if (voiceSelect) {
            voiceSelect.addEventListener('change', () => {
                const index = voiceSelect.value;
                let filteredVoices = voices.filter(voice => voice.lang.includes('en'));
                if (filteredVoices.length === 0) filteredVoices = voices;
                selectedVoice = filteredVoices[index];
            });
        }
    }

    function speak(text) {
        if (!window.speechSynthesis) return;
        
        // Stop any current speech before starting new
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
        } else {
            utterance.lang = 'en-US';
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Track speaking state to show/hide stop buttons
        utterance.onstart = () => {
            document.body.classList.add('is-speaking');
        };
        utterance.onend = () => {
            document.body.classList.remove('is-speaking');
        };
        utterance.onerror = () => {
            document.body.classList.remove('is-speaking');
        };

        window.speechSynthesis.speak(utterance);
    }

    function stopSpeak() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            document.body.classList.remove('is-speaking');
        }
    }
    // --- End Voice Assistant Integration ---

    async function sendMessage() {
        const text = textarea.value.trim();
        if (!text) return;

        // Clear input and adjust height
        textarea.value = '';
        textarea.style.height = 'auto';

        if (isFirstMessage) {
            // Hide onboarding and greeting
            const elementsToHide = document.querySelectorAll('.greeting-header, .tools-connection, .onboarding-section, .top-plan-badge');
            elementsToHide.forEach(el => el.style.display = 'none');
            
            // Adjust layout for chat
            centerContent.style.marginTop = '4vh';
            centerContent.style.height = '100vh';
            centerContent.style.justifyContent = 'flex-end';
            centerContent.style.paddingBottom = '30px';
            
            chatContainer.style.display = 'flex';
            chatContainer.style.overflowY = 'auto';
            chatContainer.style.flexGrow = '1';
            
            isFirstMessage = false;
        }

        // Add user message
        appendMessage('user', text);

        // Add loading state
        const loadingId = appendMessage('assistant', '...');

        try {
            let response;
            if (selectedFile) {
                const formData = new FormData();
                formData.append('prompt', text);
                formData.append('file', selectedFile);

                response = await fetch('http://localhost:5000/api/chat', {
                    method: 'POST',
                    body: formData
                });
                clearFile(); // Clear after sending
            } else {
                response = await fetch('http://localhost:5000/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ prompt: text })
                });
            }

            // Parse the response, trying to catch detailed errors from the backend
            const data = await response.json().catch(() => ({ error: 'Could not parse JSON response from server' }));

            if (!response.ok || data.error) {
                const errorDetail = data.error || `HTTP ${response.status}: ${response.statusText}`;
                updateMessage(loadingId, `Backend Error: ${errorDetail}`);
                return;
            }

            updateMessage(loadingId, data.response);
        } catch (error) {
            console.error('Fetch Error:', error);
            updateMessage(loadingId, `Network Error: ${error.message}. Please ensure the server is running.`);
        }
    }

    function appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const id = 'msg-' + Date.now();
        messageDiv.id = id;
        
        // Basic styling for messages
        messageDiv.style.padding = '15px';
        messageDiv.style.borderRadius = '12px';
        messageDiv.style.lineHeight = '1.6';
        messageDiv.style.maxWidth = '100%';
        messageDiv.style.position = 'relative';
        
        if (role === 'user') {
            messageDiv.style.backgroundColor = 'var(--input-bg)';
            messageDiv.style.alignSelf = 'flex-end';
            messageDiv.style.marginLeft = '40px';
            messageDiv.textContent = content; // User messages usually don't need markdown
            messageDiv.style.whiteSpace = 'pre-wrap';
        } else {
            messageDiv.style.alignSelf = 'flex-start';
            messageDiv.style.marginRight = '40px';
            
            // Render markdown or show placeholder
            const renderedContent = content === '...' ? '...' : (typeof marked !== 'undefined' ? marked.parse(content) : content);
            
            // For assistant messages, create a structure that allows for actions
            messageDiv.innerHTML = `
                <div class="message-content markdown-body">${renderedContent}</div>
                <div class="message-actions" style="margin-top: 12px; display: ${content === '...' ? 'none' : 'flex'}; gap: 8px;">
                    <button class="icon-btn speak-btn" title="Read aloud" aria-label="Read aloud">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    </button>
                    <button class="icon-btn stop-btn" title="Stop Reading" aria-label="Stop Reading" style="display: none;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"></rect></svg>
                    </button>
                    <span class="action-label" style="font-size: 11px; color: var(--text-secondary); align-self: center; display: none;">Speaking...</span>
                </div>
            `;

            // Add listener to the speak button
            const speakBtn = messageDiv.querySelector('.speak-btn');
            const stopBtn = messageDiv.querySelector('.stop-btn');
            if (speakBtn) {
                speakBtn.addEventListener('click', () => {
                    const text = messageDiv.querySelector('.message-content').textContent;
                    speak(text);
                });
            }
            if (stopBtn) {
                stopBtn.addEventListener('click', stopSpeak);
            }
            
            // Highlight code blocks if present
            if (typeof hljs !== 'undefined') {
                messageDiv.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return id;
    }

    function updateMessage(id, content) {
        const messageDiv = document.getElementById(id);
        if (messageDiv) {
            const contentDiv = messageDiv.querySelector('.message-content');
            const actionsDiv = messageDiv.querySelector('.message-actions');
            
            if (contentDiv) {
                if (typeof marked !== 'undefined') {
                    contentDiv.innerHTML = marked.parse(content);
                    // Highlight after parsing markdown
                    if (typeof hljs !== 'undefined') {
                        contentDiv.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                } else {
                    contentDiv.textContent = content;
                }
            } else {
                messageDiv.textContent = content;
            }

            if (actionsDiv && content !== '...') {
                actionsDiv.style.display = 'flex';
            }
            
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    // Handle enter key to submit
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value === '') {
            this.style.height = 'auto';
        }
    });
});
