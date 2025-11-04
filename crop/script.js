// DOM Elements
const imageUpload = document.getElementById('image-upload');
const imageUrlInput = document.getElementById('image-url');
const processBtn = document.getElementById('process-btn');
const errorMessage = document.getElementById('error-message');
const loader = document.getElementById('loader');

const cropXInput = document.getElementById('crop-x');
const cropYInput = document.getElementById('crop-y');
const anchorXSelect = document.getElementById('anchor-x');
const anchorYSelect = document.getElementById('anchor-y');

const originalImg = document.getElementById('original-img');
const croppedImg = document.getElementById('cropped-img');
const originalPlaceholder = document.getElementById('original-placeholder');
const croppedPlaceholder = document.getElementById('cropped-placeholder');
const downloadOriginalLink = document.getElementById('download-original');
const downloadCroppedLink = document.getElementById('download-cropped');

// State
let currentImage = null;

// --- Event Listeners ---
processBtn.addEventListener('click', () => {
    const file = imageUpload.files[0];
    const url = imageUrlInput.value.trim();

    if (file) {
        handleFile(file);
    } else if (url) {
        handleUrl(url);
    } else {
        showError("Please upload an image or provide a URL.");
    }
});

[cropXInput, cropYInput, anchorXSelect, anchorYSelect].forEach(el => {
    el.addEventListener('input', () => {
        if (currentImage) {
            performCrop(currentImage);
        }
    });
});

// --- Functions ---
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    loader.classList.add('hidden');
}

function resetUI() {
    errorMessage.classList.add('hidden');
    loader.classList.remove('hidden');
    originalImg.classList.add('hidden');
    croppedImg.classList.add('hidden');
    originalPlaceholder.classList.remove('hidden');
    croppedPlaceholder.classList.remove('hidden');
    downloadOriginalLink.classList.add('hidden');
    downloadCroppedLink.classList.add('hidden');
    currentImage = null;
}

function handleFile(file) {
    resetUI();
    const reader = new FileReader();
    reader.onload = (e) => loadImage(e.target.result);
    reader.readAsDataURL(file);
}

function handleUrl(url) {
    resetUI();
    loadImage(url);
}

function loadImage(src) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
        currentImage = img;
        performCrop(img);
        loader.classList.add('hidden');
    };
    img.onerror = () => {
        showError("Could not load image. If using a URL, the server may be blocking it (CORS issue). Try downloading and uploading it directly.");
    };
    img.src = src;
}

function performCrop(img) {
    // Get values from the new controls
    const cropX = parseInt(cropXInput.value) || 0;
    const cropY = parseInt(cropYInput.value) || 0;
    const anchorX = anchorXSelect.value;
    const anchorY = anchorYSelect.value;

    const originalWidth = img.width;
    const originalHeight = img.height;

    if (originalWidth <= cropX || originalHeight <= cropY) {
        showError("Crop amount cannot be larger than the image dimensions.");
        return;
    }
    errorMessage.classList.add('hidden'); // Clear previous errors

    // --- Display Original ---
    originalImg.src = img.src;
    originalImg.classList.remove('hidden');
    originalPlaceholder.classList.add('hidden');
    downloadOriginalLink.href = img.src;
    downloadOriginalLink.classList.remove('hidden');

    // --- Calculate Crop Parameters ---
    const croppedWidth = originalWidth - cropX;
    const croppedHeight = originalHeight - cropY;

    let sourceX = 0;
    if (anchorX === 'middle') sourceX = cropX / 2;
    if (anchorX === 'right') sourceX = cropX;

    let sourceY = 0;
    if (anchorY === 'middle') sourceY = cropY / 2;
    if (anchorY === 'bottom') sourceY = cropY;

    // --- Process and Display Cropped ---
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = croppedWidth;
    canvas.height = croppedHeight;

    ctx.drawImage(
        img,
        sourceX, sourceY,
        croppedWidth, croppedHeight,
        0, 0,
        croppedWidth, croppedHeight
    );
    
    const croppedDataUrl = canvas.toDataURL('image/png');
    croppedImg.src = croppedDataUrl;
    croppedImg.classList.remove('hidden');
    croppedPlaceholder.classList.add('hidden');
    downloadCroppedLink.href = croppedDataUrl;
    downloadCroppedLink.classList.remove('hidden');
}
