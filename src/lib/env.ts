import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  revenueCatIosKey?: string;
};

function extra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export function supabaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL || extra().supabaseUrl || "";
}

export function supabaseAnonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra().supabaseAnonKey || "";
}

export function revenueCatIosKey(): string {
  return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || extra().revenueCatIosKey || "";
}
