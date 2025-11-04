const rawDataInput = document.getElementById('raw-data');
const arrayNameInput = document.getElementById('array-name');
const outputPre = document.getElementById('output');
const copyButton = document.getElementById('copy-button');
const transposeCheckbox = document.getElementById('transpose-checkbox');

// --- NEW: Expanded word lists for more variety ---
const adjectives = ['glowing', 'vibrant', 'simple', 'numeric', 'brave', 'swift', 'clever', 'lucky', 'silent', 'golden', 'sparse', 'dense', 'dynamic', 'complex', 'linear', 'synthetic', 'structured', 'quantum', 'celestial', 'random'];
const nouns = ['matrix', 'vector', 'tensor', 'array', 'dataset', 'grid', 'table', 'model', 'stream', 'cluster', 'points', 'frame', 'signal', 'image', 'series', 'flow', 'field', 'lattice', 'cloud', 'structure'];

function generateRandomName() {
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${randomAdjective}_${randomNoun}`;
}

function transposeMatrix(matrix) {
    if (!matrix || matrix.length === 0 || matrix[0].length === 0) return [];
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

function convertToNumpy() {
    const arrayName = arrayNameInput.value || 'my_array'; // Fallback name
    const rawText = rawDataInput.value;
    const numberRegex = /-?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?/g;

    const rows = rawText.trim().split('\n');
    let output = [];

    for (const row of rows) {
        const matches = row.match(numberRegex);
        if (!matches) continue;
        const numbers = matches.map(val => parseFloat(val.replace(',', '.')));
        output.push(numbers);
    }
    
    if (transposeCheckbox.checked) {
        output = transposeMatrix(output);
    }

    if (output.length === 0) {
        outputPre.textContent = `${arrayName} = np.array([])`;
        return;
    }

    const numRows = output.length;
    const numCols = output[0] ? output[0].length : 0; 

    if (numRows === 1 || numCols === 1) {
        const flattenedArray = output.flat();
        outputPre.textContent = `${arrayName} = np.array(${JSON.stringify(flattenedArray)})`;
    } else {
        const stringMatrix = output.map(row => row.map(num => num.toString()));
        
        const colWidths = [];
        if (stringMatrix.length > 0 && stringMatrix[0].length > 0) {
            for (let j = 0; j < stringMatrix[0].length; j++) {
                let maxWidth = 0;
                for (let i = 0; i < stringMatrix.length; i++) {
                    if (stringMatrix[i][j] && stringMatrix[i][j].length > maxWidth) {
                        maxWidth = stringMatrix[i][j].length;
                    }
                }
                colWidths.push(maxWidth);
            }
        }

        const formattedRows = stringMatrix.map(row => {
            const paddedNumbers = row.map((numStr, index) => {
                return numStr.padStart(colWidths[index], ' ');
            });
            return `    [${paddedNumbers.join(', ')}]`;
        }).join(',\n');

        outputPre.textContent = `${arrayName} = np.array([\n${formattedRows}\n])`;
    }
}

// Event Listeners
rawDataInput.addEventListener('input', convertToNumpy);
arrayNameInput.addEventListener('input', convertToNumpy);
transposeCheckbox.addEventListener('change', convertToNumpy);

// --- NEW: Updated click listener for the copy button ---
copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(outputPre.textContent).then(() => {
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copied!';
        
        // Generate a new name and update the output
        arrayNameInput.value = generateRandomName();
        convertToNumpy();
        
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 1500);
    });
});

// Set initial state
arrayNameInput.value = generateRandomName();
convertToNumpy();
