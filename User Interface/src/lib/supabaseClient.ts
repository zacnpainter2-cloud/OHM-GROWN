import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vfqndcwsixvzstwmpbio.supabase.co";
const supabaseAnonKey = "sb_publishable_wgOWMnQmh638BaT1DYiv1Q_oEXoWH8f";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
