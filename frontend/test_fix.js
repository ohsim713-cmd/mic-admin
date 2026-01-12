
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error("No API Key"); process.exit(1); }

async function test() {
    console.log("Testing gemini-1.5-flash (Text generation)...");
    try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
        });

        if (resp.ok) {
            console.log("✅ [SUCCESS] gemini-1.5-flash is WORKING!");
        } else {
            const err = await resp.json();
            console.log("❌ Failed:", JSON.stringify(err).substring(0, 200));
        }
    } catch (e) {
        console.log("❌ Error:", e.message);
    }
}
test();
