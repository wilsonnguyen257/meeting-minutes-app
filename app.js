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
            this.recordingStatus.textContent = '🔴 Đang ghi âm...';
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

            // Stop visualizer
            if (this.visualizerAnimation) {
                cancelAnimationFrame(this.visualizerAnimation);
            }

            // Update UI
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.recordingStatus.textContent = 'Đã dừng ghi âm';
            this.recordingStatus.classList.remove('recording');
        }
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
    }

    async processRecording() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Show loading states
        this.showLoading('transcript');
        this.showLoading('minutes');

        // Send to backend for processing
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            const response = await fetch('/process-audio', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to process audio');
            }

            const result = await response.json();

            // Display results
            this.hideLoading('transcript');
            this.transcriptContent.innerHTML = `<div class="transcript-text">${this.formatTranscript(result.transcript)}</div>`;

            this.hideLoading('minutes');
            this.minutesContent.innerHTML = this.formatMinutes(result.minutes);

            // Show action buttons
            document.querySelector('.actions').style.display = 'flex';

        } catch (error) {
            console.error('Error processing audio:', error);
            this.hideLoading('transcript');
            this.hideLoading('minutes');
            this.transcriptContent.innerHTML = '<p class="error">Đã xảy ra lỗi khi xử lý ghi âm. Vui lòng thử lại.</p>';
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
    new MeetingRecorder();
});
