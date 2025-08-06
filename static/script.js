        class VoiceChatInterface {
            constructor() {
                this.conversationArea = document.getElementById('conversationArea');
                this.micBtn = document.getElementById('micBtn');
                this.speakerBtn = document.getElementById('speakerBtn');
                this.textBtn = document.getElementById('textBtn');
                this.clearBtn = document.getElementById('clearBtn');
                


                this.BACKEND_URL = 'this.BACKEND_URL = window.location.origin;'; // Change to your Python server URL
                
                this.isRecording = false;
                this.isSpeaking = false;
                this.recognition = null;
                this.synthesis = window.speechSynthesis;
                this.lastRecognizedText = '';
                this.lastAssistantResponse = '';
                this.micPermissionGranted = false;
                this.conversationHistory = [];
                this.tempMessages = new Set();
                this.sessionStartTime = new Date();
                this.sessionId = this.generateSessionId();
                this.sessionFileName = `voice-chat-session-${this.sessionId}.txt`;
                
                this.init();
                this.setupSessionEndHandlers();
            }
            
            init() {
                this.setupSpeechRecognition();
                this.setupEventListeners();
            }
            
            setupSessionEndHandlers() {
                // Save conversation when page is about to close/refresh
                window.addEventListener('beforeunload', (event) => {
                    if (this.conversationHistory.length > 0) {
                        this.saveSessionToFile();
                        // Note: Modern browsers may not show custom messages
                        event.returnValue = 'Your conversation will be saved automatically.';
                    }
                });
                
                // Save conversation when tab becomes hidden (user switches tabs or minimizes)
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden && this.conversationHistory.length > 0) {
                        // Save as backup when tab becomes hidden
                        this.saveSessionToFile();
                    }
                });
                
                // Handle page unload for automatic save
                window.addEventListener('unload', () => {
                    if (this.conversationHistory.length > 0) {
                        this.saveSessionToFile();
                    }
                });
            }
            
            setupSpeechRecognition() {
                if ('webkitSpeechRecognition' in window) {
                    this.recognition = new webkitSpeechRecognition();
                } else if ('SpeechRecognition' in window) {
                    this.recognition = new SpeechRecognition();
                } else {
                    this.addMessage('Speech recognition not supported in this browser', 'error-message');
                    this.micBtn.disabled = true;
                    return;
                }
                
                this.recognition.continuous = false;
                this.recognition.interimResults = true;
                this.recognition.lang = 'en-US';
                
                // Validate language
                if (!this.recognition.lang.startsWith('en')) {
                    throw new Error('Invalid language: Only English is supported');
                }
                
                this.recognition.onstart = () => {
                    this.isRecording = true;
                    this.micPermissionGranted = true;
                    this.updateMicButton();
                    this.addTempMessage('Listening...', 'status-message');
                };
                
                this.recognition.onresult = (event) => {
                    let finalTranscript = '';
                    
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript;
                        }
                    }
                    
                    if (finalTranscript) {
                        this.lastRecognizedText = finalTranscript;
                        this.addMessage(finalTranscript, 'user-message');
                        this.conversationHistory.push({
                            role: 'user',
                            content: finalTranscript,
                            timestamp: new Date(),
                            status: 'success'
                        });
                        this.enableButtons();
                        this.sendToPythonBackend(finalTranscript);
                    }
                };
                
                this.recognition.onend = () => {
                    this.isRecording = false;
                    this.updateMicButton();
                    this.removeTempMessages();
                };
                
                this.recognition.onerror = (event) => {
                    this.isRecording = false;
                    this.updateMicButton();
                    this.removeTempMessages();
                    
                    let errorMessage = '';
                    if (event.error === 'not-allowed') {
                        errorMessage = 'Microphone permission denied. Please allow microphone access.';
                    } else {
                        errorMessage = `Speech recognition error: ${event.error}`;
                    }
                    
                    this.addMessage(errorMessage, 'error-message');
                    
                    // Save error to conversation history (in memory only)
                    this.conversationHistory.push({
                        role: 'system',
                        content: `Error: ${errorMessage}`,
                        timestamp: new Date(),
                        status: 'error'
                    });
                };
            }
            
            setupEventListeners() {
                this.micBtn.addEventListener('click', () => {
                    if (this.isRecording) {
                        this.stopRecording();
                    } else {
                        this.startRecording();
                    }
                });
                
                this.speakerBtn.addEventListener('click', () => {
                    this.speakText();
                });
                
                this.textBtn.addEventListener('click', () => {
                    this.showTextResponse();
                });
                
                this.clearBtn.addEventListener('click', () => {
                    this.clearConversation();
                });
            }
            

            
           async sendToPythonBackend(message) {
this.addTempMessage('Processing...', 'status-message');
                this.setLoadingState(true);
                
                try {
                    const response = await fetch(`${this.BACKEND_URL}/process_message`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            message: message,
                            session_id: this.sessionId,
                            timestamp: new Date().toISOString()
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Backend Error: ${response.status} - ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        this.lastAssistantResponse = data.response;
                        this.addMessage(data.response, 'assistant-message');
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: data.response,
                            timestamp: new Date(),
                            status: 'success',
                            processing_time: data.processing_time || null
                        });
                        
                        // Auto-speak the response
                        this.speakResponse(data.response);
                    } else {
                        throw new Error(data.error || 'Unknown backend error');
                    }
                    
                } catch (error) {
                    console.error('Python Backend Error:', error);
                    let errorMsg = '';
                    
                    if (error.name === 'TypeError' && error.message.includes('fetch')) {
                        errorMsg = `Backend connection failed. Is your Python server running on ${this.BACKEND_URL}?`;
                    } else {
                        errorMsg = `Backend Error: ${error.message}`;
                    }
                    
                    this.addMessage(errorMsg, 'error-message');
                    
                    // Save backend error to conversation history (in memory only)
                    this.conversationHistory.push({
                        role: 'system',
                        content: errorMsg,
                        timestamp: new Date(),
                        status: 'backend_error',
                        originalUserMessage: message
                    });
                    
                } finally {
                    this.removeTempMessages();
                    this.setLoadingState(false);
                }
            }
            startRecording() {
                if (this.recognition) {
                    try {
                        this.recognition.start();
                    } catch (error) {
                        this.addMessage('Error starting speech recognition. Please try again.', 'error-message');
                        
                        // Save error to conversation history (in memory only)
                        this.conversationHistory.push({
                            role: 'system',
                            content: `Error starting speech recognition: ${error.message}`,
                            timestamp: new Date(),
                            status: 'error'
                        });
                    }
                }
            }
            
            stopRecording() {
                if (this.recognition) {
                    this.recognition.stop();
                }
            }
            
            speakText() {
                if (this.lastRecognizedText && this.synthesis && !this.isSpeaking) {
                    this.speakResponse(this.lastRecognizedText);
                }
            }
            
            speakResponse(text) {
                if (!text || !this.synthesis || this.isSpeaking) return;
                
                this.synthesis.cancel();
                this.isSpeaking = true;
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.8;
                utterance.pitch = 1;
                utterance.volume = 0.8;
                
                utterance.onstart = () => {
                    this.addTempMessage('Speaking...', 'status-message');
                    this.speakerBtn.disabled = true;
                };
                
                utterance.onend = () => {
                    this.isSpeaking = false;
                    this.speakerBtn.disabled = false;
                    this.removeTempMessages();
                };
                
                utterance.onerror = () => {
                    this.isSpeaking = false;
                    this.speakerBtn.disabled = false;
                    this.removeTempMessages();
                    const errorMsg = 'Error during speech synthesis';
                    this.addMessage(errorMsg, 'error-message');
                    
                    // Save speech synthesis error (in memory only)
                    this.conversationHistory.push({
                        role: 'system',
                        content: `Error: ${errorMsg}`,
                        timestamp: new Date(),
                        status: 'speech_error'
                    });
                };
                
                this.synthesis.speak(utterance);
            }
            
            showTextResponse() {
                if (this.lastAssistantResponse) {
                    // Create a modal-like display for the text
                    const textDisplay = document.createElement('div');
                    textDisplay.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        max-width: 80%;
                        max-height: 70%;
                        overflow-y: auto;
                        z-index: 1000;
                        border: 2px solid #007bff;
                    `;
                    
                    textDisplay.innerHTML = `
                        <h3 style="margin-bottom: 15px; color: #333;">Assistant Response:</h3>
                        <p style="line-height: 1.6; color: #555; margin-bottom: 20px;">${this.lastAssistantResponse}</p>
                        <button onclick="this.parentElement.remove()" style="
                            background: #007bff;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            float: right;
                        ">Close</button>
                    `;
                    
                    document.body.appendChild(textDisplay);
                }
            }
            
            saveSessionToFile() {
                if (this.conversationHistory.length === 0) return;
                
                let content = 'Voice Chat Conversation\n';
                content += '========================\n';
                content += `Session ID: ${this.sessionId}\n`;
                content += `Started: ${this.sessionStartTime.toLocaleString()}\n`;
                content += `Ended: ${new Date().toLocaleString()}\n`;
                content += `Total Entries: ${this.conversationHistory.length}\n\n`;
                
                this.conversationHistory.forEach((entry, index) => {
                    const timestamp = entry.timestamp.toLocaleTimeString();
                    let role = '';
                    let statusInfo = '';
                    
                    switch (entry.role) {
                        case 'user':
                            role = 'You';
                            break;
                        case 'assistant':
                            role = 'Assistant';
                            break;
                        case 'system':
                            role = 'System';
                            break;
                        default:
                            role = entry.role;
                    }
                    
                    // Add status information if available
                    if (entry.status) {
                        switch (entry.status) {
                            case 'success':
                                statusInfo = ' ✓';
                                break;
                            case 'error':
                            case 'backend_error':
                            case 'speech_error':
                                statusInfo = ' ✗';
                                break;
                            default:
                                statusInfo = ` (${entry.status})`;
                        }
                    }
                    
                    content += `[${timestamp}] ${role}${statusInfo}: ${entry.content}\n`;
                    
                    // Add original user message if API failed
                    if (entry.originalUserMessage) {
                        content += `    └─ In response to: "${entry.originalUserMessage}"\n`;
                    }
                    
                    content += '\n';
                });
                
                // Add session summary
                const successfulExchanges = this.conversationHistory.filter(e => e.role === 'assistant' && e.status === 'success').length;
                const errors = this.conversationHistory.filter(e => e.status && e.status.includes('error')).length;
                const userMessages = this.conversationHistory.filter(e => e.role === 'user').length;
                
                content += '--- Session Summary ---\n';
                content += `User Messages: ${userMessages}\n`;
                content += `Successful AI Responses: ${successfulExchanges}\n`;
                content += `Errors Encountered: ${errors}\n`;
                content += `Session Duration: ${this.getSessionDuration()}\n`;
                content += `Session Status: Completed\n`;
                
                // Download the file automatically
                // this.downloadSessionFile(content);
            }
            
            // downloadSessionFile(content) {
            //     const blob = new Blob([content], { type: 'text/plain' });
            //     const url = URL.createObjectURL(blob);
            //     const a = document.createElement('a');
            //     a.href = url;
            //     a.download = this.sessionFileName;
            //     a.style.display = 'none';
            //     document.body.appendChild(a);
            //     a.click();
            //     document.body.removeChild(a);
            //     URL.revokeObjectURL(url);
            // }
            
            generateSessionId() {
                const date = new Date();
                const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
                const random = Math.random().toString(36).substr(2, 4); // 4 random chars
                return `${dateStr}_${timeStr}_${random}`;
            }
            

            
            getSessionDuration() {
                if (!this.sessionStartTime) return 'Unknown';
                
                const now = new Date();
                const durationMs = now - this.sessionStartTime;
                const minutes = Math.floor(durationMs / 60000);
                const seconds = Math.floor((durationMs % 60000) / 1000);
                
                if (minutes > 0) {
                    return `${minutes}m ${seconds}s`;
                } else {
                    return `${seconds}s`;
                }
            }
            
            saveConversation() {
                // Manual save - same as session end save
                if (this.conversationHistory.length > 0) {
                    this.saveSessionToFile();
                    this.addTempMessage('Conversation saved!', 'status-message');
                    setTimeout(() => this.removeTempMessages(), 2000);
                } else {
                    this.addMessage('No conversation to save', 'status-message');
                }
            }
            
            addTempMessage(text, className) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${className} temp-message`;
                messageDiv.textContent = text;
                messageDiv.dataset.temp = 'true';
                
                this.conversationArea.appendChild(messageDiv);
                this.conversationArea.scrollTop = this.conversationArea.scrollHeight;
                this.tempMessages.add(messageDiv);
            }
            
            removeTempMessages() {
                this.tempMessages.forEach(message => {
                    if (message.parentNode) {
                        message.parentNode.removeChild(message);
                    }
                });
                this.tempMessages.clear();
            }
            
            updateMicButton() {
                if (this.isRecording) {
                    this.micBtn.classList.add('recording');
                    this.micBtn.innerHTML = `
                        <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6,6H18V18H6V6Z"/>
                        </svg>
                        Voice Input
                    `;
                } else {
                    this.micBtn.classList.remove('recording');
                    this.micBtn.innerHTML = `
                        <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C13.1 2 14 2.9 14 4V10C14 11.1 13.1 12 12 12S10 11.1 10 10V4C10 2.9 10.9 2 12 2M19 10V12C19 15.3 16.3 18 13 18V22H11V18C7.7 18 5 15.3 5 12V10H7V12C7 14.2 8.8 16 11 16H13C15.2 16 17 14.2 17 12V10H19Z"/>
                        </svg>
                        Voice Input
                    `;
                }
            }
            
            enableButtons() {
                this.speakerBtn.disabled = false;
                this.textBtn.disabled = false;
            }
            
            setLoadingState(loading) {
                const buttons = [this.micBtn, this.speakerBtn, this.textBtn];
                buttons.forEach(btn => {
                    if (loading) {
                        btn.classList.add('loading');
                    } else {
                        btn.classList.remove('loading');
                    }
                });
            }
            
            addMessage(text, className) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${className}`;
                messageDiv.textContent = text;
                
                this.conversationArea.appendChild(messageDiv);
                this.conversationArea.scrollTop = this.conversationArea.scrollHeight;
            }
            
            clearConversation() {
                this.conversationArea.innerHTML = `
                    <div class="message status-message">
                        Ready to assist. Click the microphone to begin voice input.
                    </div>
                `;
                this.lastRecognizedText = '';
                this.lastAssistantResponse = '';
                this.conversationHistory = [];
                this.speakerBtn.disabled = true;
                this.textBtn.disabled = true;
                this.tempMessages.clear();
                
                if (this.synthesis) {
                    this.synthesis.cancel();
                }
                this.isSpeaking = false;
            }
        }
        
        document.addEventListener('DOMContentLoaded', () => {
            try {
                new VoiceChatInterface();
            } catch (error) {
                console.error('Initialization error:', error);
                document.body.innerHTML = `
                    <div style="text-align: center; padding: 50px; color: red;">
                        <h2>Error: ${error.message}</h2>
                        <p>Please refresh the page and try again.</p>
                    </div>
                `;
            }
        });