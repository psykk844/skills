document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const refineBtn = document.getElementById('refine-btn');
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('loading-spinner');
    const resultImg = document.getElementById('result-img');
    const placeholderContent = document.querySelector('.placeholder-content');

    let version = 1;

    const simulateGeneration = (isRefinement = false) => {
        // Show loading state
        placeholderContent.classList.remove('hidden');
        spinner.classList.remove('hidden');
        resultImg.classList.add('hidden');
        statusText.innerText = isRefinement ? `Generating version ${version}...` : 'Synthesizing initial version...';

        // Simulating the API call to Nano Banana Pro / Agent backend
        setTimeout(() => {
            spinner.classList.add('hidden');
            placeholderContent.classList.add('hidden');
            resultImg.classList.remove('hidden');
            // Using a high-quality placeholder image for now
            resultImg.src = `https://picsum.photos/seed/${Math.random()}/1280/720`;

            document.querySelector('.version-tag').innerText = `Version ${version}`;
            version++;
        }, 2000);
    };

    generateBtn.addEventListener('click', () => {
        version = 1;
        simulateGeneration();
    });

    refineBtn.addEventListener('click', () => {
        const refineInput = document.getElementById('refine-input');
        if (!refineInput.value.trim()) return;
        simulateGeneration(true);
        refineInput.value = '';
    });

    // Simple drag and drop interactivity (visual only for mockup)
    const templateZone = document.getElementById('template-drop');
    if (templateZone) {
        templateZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            templateZone.style.borderColor = 'var(--neon-blue)';
        });
        templateZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            templateZone.style.borderColor = 'rgba(102, 252, 241, 0.3)';
        });
        templateZone.addEventListener('drop', (e) => {
            e.preventDefault();
            templateZone.style.borderColor = 'rgba(102, 252, 241, 0.3)';
            templateZone.innerHTML = `<span style="color: var(--neon-blue)">Template Selected &check;</span>`;
        });
    }
});
