import { Text } from "react-native";
import { activeVertical } from "../config/vertical.config";

export function Disclaimer() {
  return <Text className="text-center text-[11px] leading-4 text-slate-500">{activeVertical.disclaimer}</Text>;
}
