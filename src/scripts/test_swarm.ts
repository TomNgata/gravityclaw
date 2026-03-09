import axios from "axios";
import "dotenv/config";

const nodes = [
    "https://gravityclaw-fey4.onrender.com",
    "https://gravityclaw-production-16f7.up.railway.app"
];

const secretToken = process.env.SECRET_TOKEN || "gravity-claw-secret-999";

async function testNodes() {
    console.log(`🔍 Testing ${nodes.length} nodes with secret: ${secretToken}\n`);

    for (const node of nodes) {
        try {
            console.log(`📡 Pinging ${node}...`);
            const response = await axios.post(node, {
                message: {
                    text: "/ping",
                    chat: { id: 0 },
                    from: { id: 0 }
                }
            }, {
                headers: {
                    "X-Telegram-Bot-Api-Secret-Token": secretToken
                },
                validateStatus: (status) => true // Don't throw on 403
            });

            if (response.status === 200) {
                console.log(`✅ ${node}: Responded 200 OK (Secret Matches)`);
            } else if (response.status === 403) {
                console.log(`❌ ${node}: Responded 403 Forbidden (SECRET_TOKEN MISMATCH)`);
            } else {
                console.log(`⚠️ ${node}: Responded ${response.status}`);
            }
        } catch (e: any) {
            console.log(`💀 ${node}: Unreachable or timed out. (${e.message})`);
        }
    }
}

testNodes();
