import { supabase } from "./database.js";

export type ThinkingLevel = "off" | "low" | "medium" | "high";

export async function getThinkingLevel(userId: number): Promise<ThinkingLevel> {
    const { data, error } = await supabase
        .from('user_settings')
        .select('thinking_level')
        .eq('user_id', userId)
        .single();
    
    return (data?.thinking_level as ThinkingLevel) || "off";
}

export async function setThinkingLevel(userId: number, level: ThinkingLevel): Promise<void> {
    const validLevels = ["off", "low", "medium", "high"];
    if (!validLevels.includes(level)) throw new Error(`Invalid thinking level: ${level}`);

    await supabase
        .from('user_settings')
        .upsert({ user_id: userId, thinking_level: level }, { onConflict: 'user_id' });
}

export async function getBriefingTime(userId: number): Promise<string> {
    const { data } = await supabase
        .from('user_settings')
        .select('briefing_time')
        .eq('user_id', userId)
        .single();
    
    return data?.briefing_time || "08:00";
}

export async function setBriefingTime(userId: number, timeStr: string): Promise<boolean> {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return false;

    await supabase
        .from('user_settings')
        .upsert({ user_id: userId, briefing_time: timeStr }, { onConflict: 'user_id' });
    
    return true;
}

export async function getRecapTime(userId: number): Promise<string> {
    const { data } = await supabase
        .from('user_settings')
        .select('recap_time')
        .eq('user_id', userId)
        .single();
    
    return data?.recap_time || "20:00";
}

export async function setRecapTime(userId: number, timeStr: string): Promise<boolean> {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return false;

    await supabase
        .from('user_settings')
        .upsert({ user_id: userId, recap_time: timeStr }, { onConflict: 'user_id' });
    
    return true;
}
