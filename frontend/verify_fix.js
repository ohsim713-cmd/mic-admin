
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is missing!");
    process.exit(1);
}

console.log(`🔑 Using API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`);

async function testModel(modelName, type = 'text') {
    console.log(`\n🧪 Testing ${modelName} (${type})...`);
    const url = type === 'image'
        ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}` // Imagen 3 style
        : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`; // Gemini 3 style

    const body = type === 'image'
        ? JSON.stringify({ instances: [{ prompt: "A beautiful sunset" }], parameters: { sampleCount: 1 } })
        : JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] });

    // Specila handling for Gemini 3 Pro Image (GenerateContent style)
    if (modelName.includes('gemini-3-pro-image')) {
        // This uses generateContent endpoint but needs logic
    }

    // Simplification: Just test the main text/multimodal endpoint for Gemini 3
    try {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Draw a cat" }] }],
                generationConfig: { responseModalities: modelName.includes('image') ? ["IMAGE"] : ["TEXT"] }
            })
        });

        if (response.ok) {
            console.log(`✅ [SUCCESS] ${modelName} is ACTIVE and Working!`);
        } else {
            const err = await response.json();
            console.log(`❌ [FAILED] ${modelName} responded with ${response.status}:`, JSON.stringify(err.error?.message || err).substring(0, 200));
        }
    } catch (e) {
        console.log(`❌ [ERROR] ${modelName}:`, e.message);
    }
}

async function run() {
    await testModel('gemini-3-flash-preview', 'text');
    await testModel('gemini-3-pro-image-preview', 'image');
}

run();
