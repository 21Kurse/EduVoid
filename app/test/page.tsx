import type { Metadata } from "next";
import { TestMode } from "@/components/test-mode";

export const metadata: Metadata = {
  title: "EduVoid — test mode",
};

export default function TestPage() {
  return <TestMode />;
}
