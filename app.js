// Audio recording and meeting minutes app
class MeetingRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startTime = null;
        this.timerInterval = null;
        this.audioContext = null;
        this.analyser = null;
        this.visualizerAnimation = null;
        this.maxRecordingTime = 120 * 60 * 1000; // 2 hours max (increased from 30 min)
        this.warningShown = false;
        this.lastRecordingBlob = null; // Store the last recording

        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.timer = document.getElementById('timer');
        this.visualizer = document.getElementById('visualizer');
        this.transcriptContent = document.getElementById('transcriptContent');
        this.minutesContent = document.getElementById('minutesContent');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.copyBtn = document.getElementById('copyBtn');

        // Setup canvas
        this.canvasContext = this.visualizer.getContext('2d');
        this.visualizer.width = this.visualizer.offsetWidth;
        this.visualizer.height = 100;
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.downloadBtn.addEventListener('click', () => this.downloadMinutes());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 16000
                } 
            });

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };

            this.mediaRecorder.start();

            // Setup audio visualization
            this.setupVisualizer(stream);

            // Update UI
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.recordingStatus.textContent = 'Đang ghi âm...';
            this.recordingStatus.classList.add('recording');

            // Start timer
            this.startTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

            // Stop timer
            clearInterval(this.timerInterval);
            this.warningShown = false;

            // Stop visualizer
            if (this.visualizerAnimation) {
                cancelAnimationFrame(this.visualizerAnimation);
            }

            // Update UI
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            const duration = Math.floor((Date.now() - this.startTime) / 1000);
            this.recordingStatus.textContent = `Đã ghi âm ${duration} giây`;
            this.recordingStatus.classList.remove('recording');
            this.recordingStatus.style.color = '';
            
            // Create audio preview
            this.createAudioPreview();
        }
    }
    createAudioPreview() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.lastRecordingBlob = audioBlob; // Save for potential download
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Add audio player to UI
        const previewHtml = `
            <div class="audio-preview">
                <p>Nghe lại bản ghi:</p>
                <audio controls src="${audioUrl}"></audio>
                <button id="downloadAudioBtn" class="btn btn-secondary">
                    Tải xuống file ghi âm
                </button>
            </div>
        `;
        
        // Insert before the results section
        let existingPreview = document.querySelector('.audio-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        const resultsSection = document.querySelector('.results-section');
        resultsSection.insertAdjacentHTML('beforebegin', previewHtml);
        
        // Add download listener
        document.getElementById('downloadAudioBtn').addEventListener('click', () => this.downloadAudio());
    }
    
    downloadAudio() {
        if (!this.lastRecordingBlob) {
            alert('Không có file ghi âm để tải xuống');
            return;
        }
        
        const url = URL.createObjectURL(this.lastRecordingBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ghi-am-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        a.click();
        URL.revokeObjectURL(url);
    }   resultsSection.insertAdjacentHTML('beforebegin', previewHtml);
    }

    setupVisualizer(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.analyser.fftSize = 256;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.visualizerAnimation = requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(dataArray);

            this.canvasContext.fillStyle = '#1a1a2e';
            this.canvasContext.fillRect(0, 0, this.visualizer.width, this.visualizer.height);

            const barWidth = (this.visualizer.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * this.visualizer.height;

                const gradient = this.canvasContext.createLinearGradient(0, 0, 0, this.visualizer.height);
                gradient.addColorStop(0, '#4facfe');
                gradient.addColorStop(1, '#00f2fe');

                this.canvasContext.fillStyle = gradient;
                this.canvasContext.fillRect(x, this.visualizer.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    }

    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        this.timer.textContent = `${minutes}:${seconds}`;
        
        // Check if approaching max time (1h50min for 2h limit)
        const elapsedMs = Date.now() - this.startTime;
        if (elapsedMs > 110 * 60 * 1000 && !this.warningShown) {
            this.warningShown = true;
            this.recordingStatus.textContent = 'Cảnh báo: Gần hết thời gian ghi âm! (còn 10 phút)';
            this.recordingStatus.style.color = '#ff9800';
        }
        
        // Auto-stop at max time
        if (elapsedMs >= this.maxRecordingTime) {
            this.stopRecording();
            alert('Đã đạt thời gian ghi âm tối đa (2 giờ). Ghi âm đã dừng tự động.');
        }
    }

    async processRecording() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Validate file size (25MB limit)
        const fileSizeInMB = audioBlob.size / (1024 * 1024);
        
        // Warning for very short recordings (< 5 seconds estimated)
        const recordingDuration = (Date.now() - this.startTime) / 1000;
        if (recordingDuration < 5) {
            const proceed = confirm(`Ghi âm rất ngắn (${recordingDuration.toFixed(0)} giây). AI có thể không tạo được nội dung hữu ích hoặc tạo nội dung không chính xác. Bạn có muốn tiếp tục?`);
            if (!proceed) {
                return;
            }
        }
        
        // Warning for very large files
        if (fileSizeInMB > 20) {
            const proceed = confirm(`File âm thanh rất lớn (${fileSizeInMB.toFixed(2)} MB). Quá trình xử lý có thể mất nhiều thời gian (5-10 phút). Bạn có muốn tiếp tục?`);
            if (!proceed) {
                return;
            }
        }
        
        if (fileSizeInMB > 25) {
            this.hideLoading('transcript');
            this.hideLoading('minutes');
            this.transcriptContent.innerHTML = '<p class="error">File âm thanh quá lớn (> 25MB). Vui lòng ghi âm ngắn hơn hoặc chia nhỏ cuộc họp.</p>';
            this.minutesContent.innerHTML = '<p class="error">Không thể xử lý file.</p>';
            return;
        }
        
        // Show loading states
        this.showLoading('transcript');
        this.showLoading('minutes');
        
        // Update loading text with progress
        this.updateLoadingProgress('transcript', 'Đang tải lên file âm thanh...');
        this.updateLoadingProgress('minutes', 'Đang chờ xử lý...');

        // Send to backend for processing
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            // Track upload progress
            this.updateLoadingProgress('transcript', `Đang tải lên (${fileSizeInMB.toFixed(2)} MB)...`);
            
            const response = await fetch('/process-audio', {
                method: 'POST',
                body: formData
            });
            // Display results
            this.hideLoading('transcript');
            this.transcriptContent.innerHTML = `<div class="transcript-text">${this.formatTranscript(result.transcript)}</div>`;

            this.hideLoading('minutes');
            this.minutesContent.innerHTML = this.formatMinutes(result.minutes);
            
            // Show metadata if available
            if (result.metadata) {
        } catch (error) {
            console.error('Error processing audio:', error);
            this.hideLoading('transcript');
            this.hideLoading('minutes');
            
            let errorMsg = 'Đã xảy ra lỗi khi xử lý ghi âm. Vui lòng thử lại.';
            if (error.message && error.message.includes('quota')) {
                errorMsg = 'Đã vượt quá giới hạn API. Vui lòng thử lại sau vài phút.';
            } else if (error.message && error.message.includes('timeout')) {
                errorMsg = 'Quá trình xử lý mất quá nhiều thời gian. Vui lòng ghi âm ngắn hơn.';
            } else if (error.message && error.message.includes('429')) {
                errorMsg = 'Quá nhiều yêu cầu. Vui lòng đợi 1 phút rồi thử lại.';
            }
            
            // Show error with download option
            this.transcriptContent.innerHTML = `
                <p class="error">${errorMsg}</p>
                <p class="error-help">Bạn có thể tải xuống file ghi âm gốc và thử lại sau.</p>
                <button id="downloadAudioOnError" class="btn btn-secondary" style="margin: 20px auto; display: block;">
                    Tải xuống file ghi âm
                </button>
            `;
            this.minutesContent.innerHTML = '<p class="error">Không thể tạo biên bản cuộc họp.</p>';
            
            // Add download listener for error case
            const downloadBtn = document.getElementById('downloadAudioOnError');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => this.downloadAudio());
            }
        }   this.minutesContent.innerHTML = this.formatMinutes(result.minutes);

            // Show action buttons
            document.querySelector('.actions').style.display = 'flex';

        } catch (error) {
            console.error('Error processing audio:', error);
            this.hideLoading('transcript');
            this.hideLoading('minutes');
            
            let errorMsg = 'Đã xảy ra lỗi khi xử lý ghi âm. Vui lòng thử lại.';
            if (error.message && error.message.includes('quota')) {
                errorMsg = 'Đã vượt quá giới hạn API. Vui lòng thử lại sau vài phút.';
            } else if (error.message && error.message.includes('timeout')) {
                errorMsg = 'Quá trình xử lý mất quá nhiều thời gian. Vui lòng ghi âm ngắn hơn.';
            } else if (error.message && error.message.includes('429')) {
                errorMsg = 'Quá nhiều yêu cầu. Vui lòng đợi 1 phút rồi thử lại.';
            }
            
            this.transcriptContent.innerHTML = `<p class="error">${errorMsg}</p>`;
            this.minutesContent.innerHTML = '<p class="error">Không thể tạo biên bản cuộc họp.</p>';
        }
    }

    formatTranscript(transcript) {
        return transcript.replace(/\n/g, '<br>');
    }

    formatMinutes(minutes) {
        // Format the meeting minutes with proper HTML structure
        let html = `
            <div class="minutes-document">
                <h2>${minutes.title || 'Biên Bản Cuộc Họp'}</h2>
                <div class="meeting-info">
                    <p><strong>Ngày:</strong> ${new Date().toLocaleDateString('vi-VN')}</p>
                    <p><strong>Thời gian:</strong> ${new Date().toLocaleTimeString('vi-VN')}</p>
                </div>
        `;

        if (minutes.summary) {
            html += `
                <div class="section">
                    <h3>Tóm Tắt</h3>
                    <p>${minutes.summary}</p>
                </div>
            `;
        }

        if (minutes.keyPoints && minutes.keyPoints.length > 0) {
            html += `
                <div class="section">
                    <h3>Nội Dung Chính (80% Signal)</h3>
                    <ul class="key-points">
                        ${minutes.keyPoints.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (minutes.actionItems && minutes.actionItems.length > 0) {
            html += `
                <div class="section">
                    <h3>Công Việc Cần Làm</h3>
                    <ul class="action-items">
                        ${minutes.actionItems.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (minutes.decisions && minutes.decisions.length > 0) {
            html += `
                <div class="section">
                    <h3>Quyết Định</h3>
                    <ul class="decisions">
                        ${minutes.decisions.map(decision => `<li>${decision}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    showLoading(tab) {
        const pane = document.getElementById(tab);
        pane.querySelector('.loading').style.display = 'block';
        pane.querySelector('.content').style.display = 'none';
    }

    hideLoading(tab) {
        const pane = document.getElementById(tab);
        pane.querySelector('.loading').style.display = 'none';
        pane.querySelector('.content').style.display = 'block';
    }
    
    updateLoadingProgress(tab, message) {
        const pane = document.getElementById(tab);
        const loadingText = pane.querySelector('.loading p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }
    
    saveToLocalStorage(result) {
        try {
            const session = {
                transcript: result.transcript,
                minutes: result.minutes,
                metadata: result.metadata,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('lastMeetingMinutes', JSON.stringify(session));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }
    
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('lastMeetingMinutes');
            if (saved) {
                const session = JSON.parse(saved);
                // Only load if less than 24 hours old
                const age = Date.now() - new Date(session.timestamp).getTime();
                if (age < 24 * 60 * 60 * 1000) {
                    this.transcriptContent.innerHTML = `<div class="transcript-text">${this.formatTranscript(session.transcript)}</div>`;
                    this.minutesContent.innerHTML = this.formatMinutes(session.minutes);
                    if (session.metadata) {
                        const metaInfo = `<div class="meta-info">⏱️ Thời gian xử lý: ${session.metadata.processingTime} | 📁 Kích thước: ${session.metadata.fileSize}</div>`;
                        this.minutesContent.innerHTML += metaInfo;
                    }
                    document.querySelector('.actions').style.display = 'flex';
                    return true;
                }
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
        return false;
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
    }

    downloadMinutes() {
        const content = this.minutesContent.innerText;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bien-ban-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async copyToClipboard() {
        const content = this.minutesContent.innerText;
        try {
            await navigator.clipboard.writeText(content);
            alert('Đã sao chép vào clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new MeetingRecorder();
    
    // Try to load last session
    if (app.loadFromLocalStorage()) {
        console.log('Loaded previous session from localStorage');
    }
});
