import fetch from "node-fetch";

async function testHub() {
    const url = "https://gravity-claw-hub.tom-ngata.workers.dev";
    const secret = "gravity-claw-secret-999";
    
    console.log(`📡 Testing Hub at ${url}...`);
    
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "X-Telegram-Bot-Api-Secret-Token": secret,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: {
                    text: "/status",
                    chat: { id: 0 },
                    from: { id: 0 }
                }
            })
        });
        
        const text = await response.text();
        console.log(`Response Status: ${response.status}`);
        console.log(`Response Body: ${text}`);
    } catch (e: any) {
        console.error(`Error: ${e?.message || e}`);
    }
}

testHub();
