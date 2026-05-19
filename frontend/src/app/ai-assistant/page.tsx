import type { Metadata } from "next";
import AiAssistantClient from "./ai-assistant-client";

export const metadata: Metadata = {
  title: "AI Assistant | RisholviiY",
};

type AiAssistantPageProps = {
  searchParams?: Promise<{
    pyqId?: string | string[];
  }>;
};

export default async function AiAssistantPage({ searchParams }: AiAssistantPageProps) {
  const params = await searchParams;
  const pyqId = Array.isArray(params?.pyqId) ? params.pyqId[0] : params?.pyqId;

  return <AiAssistantClient initialPyqId={pyqId || ""} />;
}
