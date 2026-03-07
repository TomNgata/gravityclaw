import OpenAI from "openai";
import { config } from "../config.js";
import { db } from "./database.js";

const openrouter = new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
});

export interface Entity {
    id: string;
    name: string;
    type: string;
    metadata?: string;
}

export interface Relationship {
    source_id: string;
    target_id: string;
    relation: string;
    metadata?: string;
}

/**
 * Knowledge Graph Manager
 */
export const graphManager = {
    /**
     * Extracts entities and relationships from text using the LLM
     */
    async extractFromText(text: string): Promise<{ entities: Entity[], relationships: Relationship[] }> {
        try {
            const prompt = `Extract entities and relationships from this text.
Return ONLY JSON in this format: {"entities": [{"name": "...", "type": "...", "metadata": "..."}], "relationships": [{"source": "...", "target": "...", "relation": "..."}]}

TEXT:
${text}`;

            const response = await openrouter.chat.completions.create({
                model: "stepfun/step-3.5-flash:free",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 1000,
            });

            let content = response.choices[0].message.content?.trim() || "{}";
            console.log("🕸️ Raw Extraction Response:", content);
            
            // Extract JSON block
            const match = content.match(/\{[\s\S]*\}/);
            if (match) content = match[0];
            
            const data = JSON.parse(content);
            const entities: Entity[] = (data.entities || []).map((e: any): Entity => ({
                id: (e.id || e.name || "").toLowerCase().replace(/\s+/g, "_"),
                name: e.name || "",
                type: e.type || "concept",
                metadata: e.metadata || ""
            })).filter((e: Entity) => e.name);

            const relationships: Relationship[] = (data.relationships || []).map((r: any): Relationship => ({
                source_id: (r.source || "").toLowerCase().replace(/\s+/g, "_"),
                target_id: (r.target || "").toLowerCase().replace(/\s+/g, "_"),
                relation: r.relation || "relates_to"
            })).filter((r: Relationship) => r.source_id && r.target_id);

            return { entities, relationships };
        } catch (error) {
            console.error("Graph extraction error:", error);
            return { entities: [], relationships: [] };
        }
    },

    /**
     * Saves entities and relationships to the database
     */
    saveGraphData(entities: Entity[], relationships: Relationship[]) {
        const insertEntity = db.prepare(`
            INSERT OR IGNORE INTO entities (id, name, type, metadata)
            VALUES (?, ?, ?, ?)
        `);

        const insertRelation = db.prepare(`
            INSERT INTO relationships (source_id, target_id, relation, metadata)
            VALUES (?, ?, ?, ?)
        `);

        const transaction = db.transaction(() => {
            for (const entity of entities) {
                insertEntity.run(entity.id, entity.name, entity.type, entity.metadata || null);
            }
            for (const rel of relationships) {
                insertRelation.run(rel.source_id, rel.target_id, rel.relation, rel.metadata || null);
            }
        });

        transaction();
    },

    /**
     * Searches for entities and their related neighbors
     */
    searchGraph(query: string): string {
        try {
            // 1. Find entities matching query via FTS
            const matchingEntities = db.prepare(`
                SELECT content_id as id, name FROM entities_fts WHERE name MATCH ? LIMIT 5
            `).all(query) as { id: string, name: string }[];

            if (matchingEntities.length === 0) return "";

            let context = "--- Knowledge Graph Context ---\n";
            for (const entity of matchingEntities) {
                context += `Entity: ${entity.name}\n`;
                
                // 2. Find outgoing relationships
                const outgoing = db.prepare(`
                    SELECT r.relation, e.name as target 
                    FROM relationships r
                    JOIN entities e ON r.target_id = e.id
                    WHERE r.source_id = ?
                `).all(entity.id) as { relation: string, target: string }[];

                for (const rel of outgoing) {
                    context += `- ${entity.name} ${rel.relation} ${rel.target}\n`;
                }

                // 3. Find incoming relationships
                const incoming = db.prepare(`
                    SELECT r.relation, e.name as source 
                    FROM relationships r
                    JOIN entities e ON r.source_id = e.id
                    WHERE r.target_id = ?
                `).all(entity.id) as { relation: string, source: string }[];

                for (const rel of incoming) {
                    context += `- ${rel.source} ${rel.relation} ${entity.name}\n`;
                }
            }
            return context + "----------------------------\n";
        } catch (error) {
            console.error("Graph search error:", error);
            return "";
        }
    }
};
