/**
 * DN Translator - Flask Edition
 * Frontend JavaScript functionality
 */

class DNTranslator {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.updateCharacterCount();
        this.updateObservationCharacterCount();
        this.initializeLanguageRefresh();
        this.handleOutcomeChange(); // Initialize outcome-dependent field states
        this.updateSaveButtonState(); // Initialize save button state
    }

    initializeElements() {
        // Form elements
        this.sourceTextArea = document.getElementById('sourceText');
        this.targetLanguageSelect = document.getElementById('targetLanguage');
        this.translatedTextArea = document.getElementById('translatedText');
        
        // Test result elements
        this.outcomeSelect = document.getElementById('outcome');
        this.accuracyInput = document.getElementById('accuracy');
        this.testedByInput = document.getElementById('testedBy');
        this.observationTextArea = document.getElementById('observation');
        this.observationCharCount = document.getElementById('observationCharCount');
        
        // Buttons
        this.translateBtn = document.getElementById('translateBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.saveTestResultsBtn = document.getElementById('saveTestResultsBtn');
        this.viewTestResultsBtn = document.getElementById('viewTestResultsBtn');
        this.refreshTestResultsBtn = document.getElementById('refreshTestResultsBtn');
        this.exportExcelBtn = document.getElementById('exportExcelBtn');
        
        // UI elements
        this.charCount = document.getElementById('charCount');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.statusArea = document.getElementById('statusArea');
        this.testResultsModal = document.getElementById('testResultsModal');
        this.testResultsContainer = document.getElementById('testResultsContainer');
        
        // Form
        this.form = document.getElementById('translatorForm');
        
        // Store last translation result
        this.lastTranslationResult = null;
        
        // Store languages for lookup
        this.languages = [];
        
        // Initialize with languages from HTML
        this.initializeLanguagesFromHTML();
    }

    initializeLanguagesFromHTML() {
        // Extract languages from the existing HTML options
        const options = this.targetLanguageSelect.querySelectorAll('option');
        this.languages = Array.from(options).map(option => ({
            key: option.value,
            text: option.textContent
        }));
    }

    bindEvents() {
        // Text input events
        this.sourceTextArea.addEventListener('input', () => {
            this.updateCharacterCount();
            this.validateForm();
        });

        // Language selection change
        this.targetLanguageSelect.addEventListener('change', () => {
            this.validateForm();
        });

        // Button events
        this.translateBtn.addEventListener('click', () => this.translateText());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.saveTestResultsBtn.addEventListener('click', () => this.saveTestResults());
        this.viewTestResultsBtn.addEventListener('click', () => this.showTestResultsModal());
        this.refreshTestResultsBtn.addEventListener('click', () => {
            // Add visual feedback to refresh button
            const originalHtml = this.refreshTestResultsBtn.innerHTML;
            this.refreshTestResultsBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Refreshing...';
            this.refreshTestResultsBtn.disabled = true;
            
            this.loadTestResults().finally(() => {
                // Reset button state
                this.refreshTestResultsBtn.innerHTML = originalHtml;
                this.refreshTestResultsBtn.disabled = false;
            });
        });
        this.exportExcelBtn.addEventListener('click', () => this.exportToExcel());

        // Event delegation for dynamically created delete buttons
        this.testResultsContainer.addEventListener('click', (e) => {
            if (e.target.closest('.delete-result-btn')) {
                const deleteBtn = e.target.closest('.delete-result-btn');
                const resultId = deleteBtn.getAttribute('data-result-id');
                if (resultId) {
                    this.deleteTestResult(parseInt(resultId));
                }
            }
        });

        // Test result events
        this.observationTextArea.addEventListener('input', () => {
            this.updateObservationCharacterCount();
        });

        // Outcome selection change event
        this.outcomeSelect.addEventListener('change', () => {
            this.handleOutcomeChange();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter to translate
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (!this.translateBtn.disabled) {
                    this.translateText();
                }
            }
            
            // Ctrl+Shift+C to copy
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.copyToClipboard();
            }
        });

        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.translateText();
        });
    }

    updateCharacterCount() {
        const currentLength = this.sourceTextArea.value.length;
        this.charCount.textContent = currentLength;
        
        // Update color based on character count
        if (currentLength > 4500) {
            this.charCount.style.color = '#dc3545'; // Red
        } else if (currentLength > 4000) {
            this.charCount.style.color = '#fd7e14'; // Orange
        } else {
            this.charCount.style.color = '#6c757d'; // Default gray
        }
    }

    validateForm() {
        const hasText = this.sourceTextArea.value.trim().length > 0;
        const hasLanguage = this.targetLanguageSelect.value !== '';
        
        this.translateBtn.disabled = !(hasText && hasLanguage);
        
        // Update button text based on state
        if (!hasText && !hasLanguage) {
            this.translateBtn.innerHTML = '<i class="fas fa-language me-2"></i>Enter text & select language';
        } else if (!hasText) {
            this.translateBtn.innerHTML = '<i class="fas fa-language me-2"></i>Enter text to translate';
        } else if (!hasLanguage) {
            this.translateBtn.innerHTML = '<i class="fas fa-language me-2"></i>Select target language';
        } else {
            this.translateBtn.innerHTML = '<i class="fas fa-language me-2"></i>Translate';
        }
    }

    handleOutcomeChange() {
        const selectedOutcome = this.outcomeSelect.value;
        
        if (selectedOutcome === 'Failure') {
            // Disable accuracy field for Failure outcome
            this.accuracyInput.disabled = true;
            this.accuracyInput.required = false;
            this.accuracyInput.value = '0'; // Set to 0 for failures
            this.accuracyInput.style.backgroundColor = '#f8f9fa'; // Light gray background
            
            // Update the label to indicate it's disabled
            const accuracyLabel = document.querySelector('label[for="accuracy"]');
            if (accuracyLabel) {
                accuracyLabel.innerHTML = 'Accuracy (%): <span class="text-muted">(Auto-set to 0 for failures)</span>';
            }
        } else {
            // Enable accuracy field for Success and Partial outcomes
            this.accuracyInput.disabled = false;
            this.accuracyInput.required = true;
            this.accuracyInput.value = ''; // Clear the value so user can input
            this.accuracyInput.style.backgroundColor = ''; // Remove background color
            
            // Restore the original label
            const accuracyLabel = document.querySelector('label[for="accuracy"]');
            if (accuracyLabel) {
                accuracyLabel.innerHTML = 'Accuracy (%): <span class="text-danger">*</span>';
            }
        }
    }

    updateSaveButtonState() {
        // Enable save button only if translation has been performed
        const hasTranslation = this.lastTranslationResult || 
                              (this.translatedTextArea.value && this.translatedTextArea.value.trim() !== '');
        
        this.saveTestResultsBtn.disabled = !hasTranslation;
        
        if (hasTranslation) {
            this.saveTestResultsBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Test Results';
            this.saveTestResultsBtn.title = 'Save test results for the current translation';
        } else {
            this.saveTestResultsBtn.innerHTML = '<i class="fas fa-save me-2"></i>Translate text first';
            this.saveTestResultsBtn.title = 'You must translate text before saving test results';
        }
    }

    async translateText() {
        const sourceText = this.sourceTextArea.value.trim();
        const targetLanguage = this.targetLanguageSelect.value;

        // Validation
        if (!sourceText) {
            this.showAlert('Please enter text to translate.', 'warning');
            this.sourceTextArea.focus();
            return;
        }

        if (!targetLanguage) {
            this.showAlert('Please select a target language.', 'warning');
            this.targetLanguageSelect.focus();
            return;
        }

        if (sourceText.length > 5000) {
            this.showAlert('Text is too long. Maximum 5000 characters allowed.', 'danger');
            return;
        }

        // Show loading state
        this.setLoadingState(true);

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: sourceText,
                    target_language: targetLanguage
                })
            });

            const data = await response.json();

            if (data.success) {
                // Store the translation result for later use
                this.lastTranslationResult = {
                    source_text: sourceText,
                    translated_text: data.translated_text,
                    source_language: this.getLanguageDisplayName(data.source_language),
                    target_language: this.getLanguageDisplayName(targetLanguage)
                };
                
                // Display translation result
                this.translatedTextArea.value = data.translated_text;
                this.copyBtn.disabled = false;
                
                // Update save button state since we now have a translation
                this.updateSaveButtonState();
                
                // Show success message
                const targetLangName = this.targetLanguageSelect.options[this.targetLanguageSelect.selectedIndex].text;
                this.showAlert(`Translation completed successfully to ${targetLangName}`, 'success');
                
                // Add fade-in animation
                this.translatedTextArea.parentElement.classList.add('fade-in-up');
                
            } else {
                throw new Error(data.error || 'Translation failed');
            }

        } catch (error) {
            console.error('Translation error:', error);
            
            // Show error message
            if (error.message.includes('fetch')) {
                this.showAlert('Network error. Please check your connection and try again.', 'danger');
            } else {
                this.showAlert(`Translation failed: ${error.message}`, 'danger');
            }
            
            // Clear result area
            this.translatedTextArea.value = '';
            this.copyBtn.disabled = true;
        } finally {
            this.setLoadingState(false);
        }
    }

    async copyToClipboard() {
        const textToCopy = this.translatedTextArea.value.trim();

        if (!textToCopy) {
            this.showAlert('No translation text available to copy.', 'info');
            return;
        }

        try {
            // Modern clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
                this.showAlert('Translation copied to clipboard successfully!', 'success');
                
                // Temporary button feedback
                const originalText = this.copyBtn.innerHTML;
                this.copyBtn.innerHTML = '<i class="fas fa-check me-2"></i>Copied!';
                this.copyBtn.classList.add('btn-success');
                this.copyBtn.classList.remove('btn-outline-secondary');
                
                setTimeout(() => {
                    this.copyBtn.innerHTML = originalText;
                    this.copyBtn.classList.remove('btn-success');
                    this.copyBtn.classList.add('btn-outline-secondary');
                }, 2000);
                
            } else {
                // Fallback for older browsers or non-secure contexts
                this.selectText(this.translatedTextArea);
                document.execCommand('copy');
                this.showAlert('Text selected. Use Ctrl+C to copy.', 'info');
            }
        } catch (error) {
            console.error('Copy failed:', error);
            
            // Final fallback - select text for manual copy
            this.selectText(this.translatedTextArea);
            this.showAlert('Please use Ctrl+C to copy the selected text.', 'warning');
        }
    }

    selectText(element) {
        element.focus();
        element.select();
        
        // For mobile devices
        if (element.setSelectionRange) {
            element.setSelectionRange(0, 99999);
        }
    }

    clearAll() {
        // Show confirmation dialog
        if (this.sourceTextArea.value.trim() || this.translatedTextArea.value.trim()) {
            if (!confirm('Are you sure you want to clear all fields?')) {
                return;
            }
        }

        // Clear all fields
        this.sourceTextArea.value = '';
        this.translatedTextArea.value = '';
        this.targetLanguageSelect.value = '';
        
        // Clear test result fields
        this.clearTestResults();
        
        // Clear translation result
        this.lastTranslationResult = null;
        
        // Reset UI state
        this.copyBtn.disabled = true;
        this.updateCharacterCount();
        this.validateForm();
        this.updateSaveButtonState(); // Update save button state since translation is cleared
        
        // Clear status messages
        this.clearAlerts();
        
        // Focus on source text area
        this.sourceTextArea.focus();
        
        this.showAlert('All fields have been cleared.', 'info');
    }

    setLoadingState(loading) {
        if (loading) {
            this.loadingOverlay.classList.remove('d-none');
            this.translateBtn.disabled = true;
            this.translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Translating...';
            
            // Disable form elements
            this.sourceTextArea.disabled = true;
            this.targetLanguageSelect.disabled = true;
            this.clearBtn.disabled = true;
            
        } else {
            this.loadingOverlay.classList.add('d-none');
            this.translateBtn.disabled = false;
            
            // Re-enable form elements
            this.sourceTextArea.disabled = false;
            this.targetLanguageSelect.disabled = false;
            this.clearBtn.disabled = false;
            
            // Restore button text
            this.validateForm();
        }
    }

    showAlert(message, type = 'info') {
        this.clearAlerts();
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show status-message`;
        alertDiv.innerHTML = `
            <i class="fas fa-${this.getAlertIcon(type)} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        this.statusArea.appendChild(alertDiv);
        
        // Auto-dismiss success and info messages
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
        
        // Scroll to alert if needed
        alertDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    getAlertIcon(type) {
        const icons = {
            'success': 'check-circle',
            'danger': 'exclamation-triangle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    clearAlerts() {
        const alerts = this.statusArea.querySelectorAll('.alert');
        alerts.forEach(alert => alert.remove());
    }

    async initializeLanguageRefresh() {
        // Optionally refresh languages from API on page load
        try {
            const response = await fetch('/api/languages');
            const data = await response.json();
            
            if (data.success && data.languages.length > 1) {
                // Update language dropdown if API provides more languages
                this.updateLanguageOptions(data.languages);
                
                // Show info about loaded languages
                const languageCount = data.languages.length - 1; // Exclude placeholder
                console.log(`Loaded ${languageCount} languages from API`);
            }
        } catch (error) {
            console.log('Using fallback languages (API unavailable)');
        }
    }

    updateLanguageOptions(languages) {
        const currentValue = this.targetLanguageSelect.value;
        
        // Store languages for lookup
        this.languages = languages;
        
        // Clear existing options
        this.targetLanguageSelect.innerHTML = '';
        
        // Add new options
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.key;
            option.textContent = lang.text;
            this.targetLanguageSelect.appendChild(option);
        });
        
        // Restore selection if still valid
        if (currentValue && languages.some(lang => lang.key === currentValue)) {
            this.targetLanguageSelect.value = currentValue;
        }
        
        this.validateForm();
    }

    getLanguageDisplayName(languageKey) {
        // Helper function to convert language key to "key-Name" format
        if (!languageKey || languageKey === 'auto') {
            return 'auto-Auto Detected';
        }
        
        // Find language name from stored languages
        const language = this.languages.find(lang => lang.key === languageKey);
        if (language && language.text) {
            return `${languageKey}-${language.text}`;
        }
        
        // Fallback to just the key if name not found
        return languageKey;
    }

    updateObservationCharacterCount() {
        const currentLength = this.observationTextArea.value.length;
        this.observationCharCount.textContent = currentLength;
        
        // Update color based on character count
        if (currentLength > 450) {
            this.observationCharCount.style.color = '#dc3545'; // Red
        } else if (currentLength > 400) {
            this.observationCharCount.style.color = '#fd7e14'; // Orange
        } else {
            this.observationCharCount.style.color = '#6c757d'; // Default gray
        }
    }

    async saveTestResults() {
        try {
            // Validate required fields
            if (!this.outcomeSelect.value) {
                this.showError('Please select an outcome');
                this.outcomeSelect.focus();
                return;
            }

            // Validate tested by field
            if (!this.testedByInput.value || this.testedByInput.value.trim() === '') {
                this.showError('Please enter who tested this translation');
                this.testedByInput.focus();
                return;
            }

            // Validate that translation has been performed
            if (!this.lastTranslationResult && (!this.translatedTextArea.value || this.translatedTextArea.value.trim() === '')) {
                this.showError('Please translate text before saving test results');
                this.sourceTextArea.focus();
                return;
            }

            // Only validate accuracy if outcome is not "Failure"
            if (this.outcomeSelect.value !== 'Failure') {
                if (!this.accuracyInput.value || this.accuracyInput.value.trim() === '') {
                    this.showError('Please enter an accuracy percentage');
                    this.accuracyInput.focus();
                    return;
                }

                // Validate accuracy range
                const accuracy = parseFloat(this.accuracyInput.value);
                if (isNaN(accuracy) || accuracy < 0 || accuracy > 100) {
                    this.showError('Accuracy must be a number between 0 and 100');
                    this.accuracyInput.focus();
                    return;
                }
            }

            const testResults = {
                outcome: this.outcomeSelect.value,
                accuracy: this.accuracyInput.value,
                observation: this.observationTextArea.value,
                testedBy: this.testedByInput.value,
                sourceText: this.lastTranslationResult?.source_text || this.sourceTextArea.value,
                translatedText: this.lastTranslationResult?.translated_text || this.translatedTextArea.value,
                sourceLanguage: this.lastTranslationResult?.source_language || 'auto-Auto Detected',
                targetLanguage: this.lastTranslationResult?.target_language || this.getLanguageDisplayName(this.targetLanguageSelect.value),
                sessionId: `session-${Date.now()}`,
                timestamp: new Date().toISOString()
            };

            // Show loading state
            this.saveTestResultsBtn.disabled = true;
            this.saveTestResultsBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

            console.log('Sending test results:', testResults); // Debug log

            const response = await fetch('/api/save-test-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testResults)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Save response:', result); // Debug log
                this.showSuccess('Test result saved');
                // Optionally clear the test results form
                this.clearTestResults();
                // Enable the view button if it was disabled
                this.viewTestResultsBtn.disabled = false;
            } else {
                const error = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error('Save error response:', error); // Debug log
                throw new Error(error.message || 'Failed to save test results');
            }
        } catch (error) {
            console.error('Error saving test results:', error);
            this.showError('Failed to save test results: ' + error.message);
        } finally {
            // Reset button state
            this.saveTestResultsBtn.disabled = false;
            this.saveTestResultsBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Test Results';
        }
    }

    clearTestResults() {
        this.outcomeSelect.value = '';
        this.accuracyInput.value = '';
        this.observationTextArea.value = '';
        this.updateObservationCharacterCount();
    }

    showTestResultsModal() {
        // Show the modal
        const modal = new bootstrap.Modal(this.testResultsModal);
        modal.show();
        
        // Load test results
        this.loadTestResults();
    }

    async loadTestResults() {
        try {
            // Show loading state
            this.testResultsContainer.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <div class="mt-2">Loading test results...</div>
                </div>
            `;

            // Add timeout to prevent infinite loading
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            // Add cache-busting parameter to ensure fresh data
            const response = await fetch(`/api/test-results?_t=${Date.now()}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.displayTestResults(data.data || []);
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error loading test results:', error);
            
            let errorMessage = 'Failed to load test results';
            if (error.name === 'AbortError') {
                errorMessage = 'Request timed out. Please try again.';
            } else if (error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection.';
            } else {
                errorMessage = error.message;
            }
            
            this.testResultsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${errorMessage}
                    <br>
                    <button class="btn btn-sm btn-outline-light mt-2" onclick="translator.loadTestResults()">
                        <i class="fas fa-sync me-1"></i>Try Again
                    </button>
                </div>
            `;
        }
    }

    displayTestResults(results) {
        if (results.length === 0) {
            this.testResultsContainer.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-clipboard me-2"></i>
                    No test results found. Save some test results first!
                </div>
            `;
            return;
        }

        let html = '<div class="row">';
        results.forEach((result, index) => {
            const date = new Date(result.created_at).toLocaleString();
            html += `
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">Test Result #${result.id || index + 1}</h6>
                            <div class="d-flex gap-2">
                                <span class="badge ${result.outcome === 'Success' ? 'bg-success' : 'bg-warning'}">${result.outcome}</span>
                                <button class="btn btn-outline-danger btn-sm delete-result-btn" data-result-id="${result.id}" title="Delete this result">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-6">
                                    <strong>Accuracy:</strong> ${result.accuracy || 'N/A'}%
                                </div>
                                <div class="col-6">
                                    <strong>Tested By:</strong> ${result.tested_by || 'N/A'}
                                </div>
                            </div>
                            <div class="mt-2">
                                <strong>Observation:</strong>
                                <p class="text-muted small mb-1">${result.observation || 'No observation provided'}</p>
                            </div>
                            <div class="mt-2">
                                <strong>Translation:</strong>
                                <p class="text-muted small mb-1">${result.text_to_translate ? result.text_to_translate.substring(0, 50) + '...' : 'N/A'} → ${result.translated_text ? result.translated_text.substring(0, 50) + '...' : 'N/A'}</p>
                            </div>
                            <div class="mt-2">
                                <strong>Languages:</strong>
                                <p class="text-muted small mb-1">
                                    <i class="fas fa-arrow-right me-1"></i>
                                    ${result.source_language || 'auto-Auto Detected'} → ${result.target_language || 'N/A'}
                                </p>
                            </div>
                            <div class="text-muted small">
                                <i class="fas fa-clock me-1"></i>${date}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        this.testResultsContainer.innerHTML = html;
    }

    async exportToExcel() {
        try {
            // Show loading state
            this.exportExcelBtn.disabled = true;
            this.exportExcelBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exporting...';

            const response = await fetch('/api/export-test-results');
            if (response.ok) {
                // Create a blob from the response
                const blob = await response.blob();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `test_results_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showSuccess('Test results exported successfully!');
            } else {
                throw new Error('Failed to export test results');
            }
        } catch (error) {
            console.error('Error exporting test results:', error);
            this.showError('Failed to export test results: ' + error.message);
        } finally {
            // Reset button state
            this.exportExcelBtn.disabled = false;
            this.exportExcelBtn.innerHTML = '<i class="fas fa-file-excel me-2"></i>Export to Excel';
        }
    }

    async deleteTestResult(resultId) {
        if (!confirm('Are you sure you want to delete this test result? This action cannot be undone.')) {
            return;
        }

        try {
            // Show loading state in the container
            this.testResultsContainer.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-danger" role="status">
                        <span class="visually-hidden">Deleting...</span>
                    </div>
                    <div class="mt-2">Deleting test result...</div>
                </div>
            `;

            const response = await fetch(`/api/test-results/${resultId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showSuccess('Test result deleted successfully!');
            } else {
                const error = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
                throw new Error(error.message || 'Failed to delete test result');
            }
        } catch (error) {
            console.error('Error deleting test result:', error);
            this.showError('Failed to delete test result: ' + error.message);
        } finally {
            // Always refresh the test results, regardless of success or failure
            try {
                await this.loadTestResults();
            } catch (refreshError) {
                console.error('Error refreshing test results:', refreshError);
                // If refresh fails, show a fallback message
                this.testResultsContainer.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Unable to refresh test results. Please close and reopen this dialog.
                        <button class="btn btn-sm btn-outline-primary ms-2" onclick="translator.loadTestResults()">
                            <i class="fas fa-sync me-1"></i>Try Again
                        </button>
                    </div>
                `;
            }
        }
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showAlert(message, type = 'info') {
        // Create alert element
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show`;
        alertElement.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertElement.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${this.getAlertIcon(type)} me-2"></i>
                ${message}
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>
        `;

        // Add to page
        document.body.appendChild(alertElement);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alertElement.parentNode) {
                alertElement.remove();
            }
        }, 5000);
    }

    getAlertIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'danger': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || icons['info'];
    }
}

// Global translator instance
let translator;

// Initialize the translator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    translator = new DNTranslator();
});

// Add some utility functions for better UX
window.addEventListener('beforeunload', (e) => {
    const sourceText = document.getElementById('sourceText')?.value?.trim();
    const translatedText = document.getElementById('translatedText')?.value?.trim();
    
    if (sourceText || translatedText) {
        e.preventDefault();
        e.returnValue = 'You have unsaved translations. Are you sure you want to leave?';
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    const translator = new DNTranslator();
    translator.showAlert('Connection restored. You can now translate text.', 'success');
});

window.addEventListener('offline', () => {
    const translator = new DNTranslator();
    translator.showAlert('You are currently offline. Translation services are unavailable.', 'warning');
});