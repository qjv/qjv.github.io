// --- DOM Element Selection ---
const textInput = document.getElementById('text-input');
const previewOutput = document.getElementById('preview-output');
const charCounter = document.getElementById('char-counter');
const copyButton = document.getElementById('copy-button');
const modeTagBtn = document.getElementById('mode-tag');
const modeSquadBtn = document.getElementById('mode-squad');
const characterNameInput = document.getElementById('character-name');
const characterNameSection = document.getElementById('character-name-section');
const colorPalette = document.getElementById('color-palette');
const applyPickerColorBtn = document.getElementById('apply-picker-color');
const colorPreview = document.getElementById('color-preview');
const tagButtons = document.getElementById('tag-buttons');
const squadButtons = document.getElementById('squad-buttons');

const [aBtnTag] = tagButtons.children;
const [aBtnSquad, brBtn, posBtn] = squadButtons.children;

// --- Constants and State ---
const colors = [
    '#DC143C', '#FF4500', '#FF6B6B', '#FF7F50', '#FFD700', '#ADFF2F',
    '#7FFF00', '#3CB371', '#20B2AA', '#4ECDC4', '#00FFFF', '#45B7D1',
    '#6495ED', '#4169E1', '#8A2BE2', '#9370DB', '#BA55D3', '#FF1493',
    '#FF69B4', '#FFFFFF', '#C0C0C0', '#808080'
];

let state = {
    mode: 'tag',
    limit: 116,
    characterName: ''
};
let colorPicker;
let copyTimeout;

// --- Functions ---
function setupColorPalette() {
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'w-6 h-6 rounded-full cursor-pointer color-swatch';
        swatch.style.backgroundColor = color;
        swatch.onclick = () => applyColor(color);
        colorPalette.appendChild(swatch);
    });
    
    const pickerWrapper = document.getElementById('color-picker-wrapper');
    colorPicker = new iro.ColorPicker(pickerWrapper, {
        width: pickerWrapper.clientWidth,
        handleRadius: 8,
        sliderSize: 12,
        borderWidth: 1,
        borderColor: "#fff",
        layout: [
            { component: iro.ui.Slider, options: { sliderType: 'hue' } },
            { component: iro.ui.Slider, options: { sliderType: 'saturation' } },
            { component: iro.ui.Slider, options: { sliderType: 'value' } },
        ]
    });

    colorPicker.on('color:change', function(color) {
        colorPreview.style.backgroundColor = color.hexString;
    });
    colorPreview.style.backgroundColor = colorPicker.color.hexString;

    applyPickerColorBtn.addEventListener('click', () => {
        applyColor(colorPicker.color.hexString);
    });
}

function updateAll() {
    updateCharCounter();
    updatePreview();
}

function updatePreview() {
    let rawText = textInput.value;
    let textForProcessing = rawText;

    if (state.mode === 'tag') {
        textForProcessing = textForProcessing.replace(/\n/g, '<br>');
    }

    let sanitizedText = textForProcessing.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let formattedText = sanitizedText
        .replace(/&lt;c=(#[a-fA-F0-9]{6})&gt;(.*?)&lt;\/c&gt;/g, '<span style="color:$1">$2</span>')
        .replace(/&lt;a&gt;(.*?)&lt;\/a&gt;/g, '<span class="preview-link">$1</span>')
        .replace(/&lt;br&gt;/g, '<br>')
        .replace(/&lt;pos&gt;/g, '<br><br>');

    if (state.mode === 'tag') {
        const name = state.characterName || '[Character Name]';
        previewOutput.innerHTML = `<strong class="text-white">Commander ${name}</strong><br><strong class="text-white">Squad Message:</strong> ${formattedText}`;
    } else {
        previewOutput.innerHTML = `<strong class="text-white">Squad:</strong> ${formattedText}`;
    }
}

function updateCharCounter() {
    let count;
    
    if (state.mode === 'tag') {
        state.limit = 116 - state.characterName.length;
        const newlines = (textInput.value.match(/\n/g) || []).length;
        count = textInput.value.length + newlines + 1;
    } else {
        state.limit = 200;
        count = textInput.value.length;
    }
    
    charCounter.textContent = `${count} / ${state.limit}`;
    charCounter.style.color = count > state.limit ? '#EF4444' : '#9CA3AF';
}

function insertTag(tag) {
    const start = textInput.selectionStart;
    const end = textInput.selectionEnd;
    const selectedText = textInput.value.substring(start, end);
    let newText = (tag === 'a') ? `<a>${selectedText}</a>` : `<${tag}>`;

    textInput.value = textInput.value.substring(0, start) + newText + textInput.value.substring(end);
    
    textInput.focus();
    if (selectedText.length === 0 && tag === 'a') {
        textInput.selectionStart = start + 3;
        textInput.selectionEnd = start + 3;
    } else {
        textInput.selectionStart = start + newText.length;
        textInput.selectionEnd = start + newText.length;
    }
    updateAll();
}

function applyColor(color) {
    const start = textInput.selectionStart;
    const end = textInput.selectionEnd;
    const selectedText = textInput.value.substring(start, end);
    const newText = `<c=${color}>${selectedText}</c>`;
    
    textInput.value = textInput.value.substring(0, start) + newText + textInput.value.substring(end);

    textInput.focus();
    if (selectedText.length === 0) {
        const newPosition = start + color.length + 4;
        textInput.selectionStart = newPosition;
        textInput.selectionEnd = newPosition;
    } else {
        textInput.selectionStart = start + newText.length;
        textInput.selectionEnd = start + newText.length;
    }
    updateAll();
}

function setMode(mode) {
    state.mode = mode;
    if (mode === 'tag') {
        modeTagBtn.classList.add('btn-active');
        modeSquadBtn.classList.remove('btn-active');
        characterNameSection.classList.remove('hidden');
        tagButtons.classList.remove('hidden');
        squadButtons.classList.add('hidden');
    } else {
        modeSquadBtn.classList.add('btn-active');
        modeTagBtn.classList.remove('btn-active');
        characterNameSection.classList.add('hidden');
        tagButtons.classList.add('hidden');
        squadButtons.classList.remove('hidden');
    }
    updateAll();
}

// --- Event Listeners ---
textInput.addEventListener('input', updateAll);
characterNameInput.addEventListener('input', (e) => {
    state.characterName = e.target.value;
    updateAll();
});

textInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && state.mode === 'squad') {
        event.preventDefault();
    }
});

modeTagBtn.addEventListener('click', () => setMode('tag'));
modeSquadBtn.addEventListener('click', () => setMode('squad'));

copyButton.addEventListener('click', () => {
    clearTimeout(copyTimeout);
    // Use document.execCommand for broader compatibility in sandboxed environments
    const textToCopy = textInput.value;
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed"; // Avoid scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        copyButton.textContent = 'Copied!';
        copyTimeout = setTimeout(() => {
            copyButton.textContent = 'Copy';
        }, 1500);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        copyButton.textContent = 'Error';
         copyTimeout = setTimeout(() => {
            copyButton.textContent = 'Copy';
        }, 1500);
    }
    document.body.removeChild(textArea);
});

[aBtnTag, aBtnSquad].forEach(btn => btn.addEventListener('click', () => insertTag('a')));
brBtn.addEventListener('click', () => insertTag('br'));
posBtn.addEventListener('click', () => insertTag('pos'));

// --- Initial Setup ---
// The original used a timeout. A better way is to ensure the script runs after the DOM is loaded.
// Since this script is at the end of the body in the HTML file, it will run after the DOM is parsed.
document.addEventListener('DOMContentLoaded', (event) => {
    setupColorPalette();
    updateAll();
});
