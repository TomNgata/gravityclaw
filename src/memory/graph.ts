import OpenAI from "openai";
import { config } from "../config.js";
import { supabase } from "./database.js";

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

export const graphManager = {
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

    async saveGraphData(entities: Entity[], relationships: Relationship[]) {
        try {
            if (entities.length > 0) {
                await supabase.from('entities').upsert(
                    entities.map(e => ({ id: e.id, name: e.name, type: e.type, metadata: e.metadata || null })),
                    { onConflict: 'id', ignoreDuplicates: true }
                );
            }
            if (relationships.length > 0) {
                await supabase.from('relationships').insert(
                    relationships.map(r => ({ source_id: r.source_id, target_id: r.target_id, relation: r.relation, metadata: r.metadata || null }))
                );
            }
        } catch (error) {
            console.error("Graph save error:", error);
        }
    },

    async searchGraph(query: string): Promise<string> {
        try {
            const { data: matchingEntities } = await supabase
                .from('entities')
                .select('id, name')
                .ilike('name', `%${query}%`)
                .limit(5);

            if (!matchingEntities || matchingEntities.length === 0) return "";

            let context = "--- Knowledge Graph Context ---\n";
            for (const entity of matchingEntities) {
                context += `Entity: ${entity.name}\n`;

                const { data: outgoing } = await supabase
                    .from('relationships')
                    .select('relation, entities!relationships_target_id_fkey(name)')
                    .eq('source_id', entity.id);

                for (const rel of (outgoing || [])) {
                    const target = (rel.entities as any)?.name;
                    if (target) context += `- ${entity.name} ${rel.relation} ${target}\n`;
                }

                const { data: incoming } = await supabase
                    .from('relationships')
                    .select('relation, entities!relationships_source_id_fkey(name)')
                    .eq('target_id', entity.id);

                for (const rel of (incoming || [])) {
                    const source = (rel.entities as any)?.name;
                    if (source) context += `- ${source} ${rel.relation} ${entity.name}\n`;
                }
            }
            return context + "----------------------------\n";
        } catch (error) {
            console.error("Graph search error:", error);
            return "";
        }
    }
};
