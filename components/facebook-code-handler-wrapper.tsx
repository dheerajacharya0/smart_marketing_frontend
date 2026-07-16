"use client";
import dynamic from "next/dynamic";

const FacebookCodeHandler = dynamic(() => import("./facebook-code-handler"), { ssr: false });

interface FacebookCodeHandlerWrapperProps {
  onConnectionSuccess?: () => void;
}

export default function FacebookCodeHandlerWrapper({ onConnectionSuccess }: FacebookCodeHandlerWrapperProps) {
  return <FacebookCodeHandler onConnectionSuccess={onConnectionSuccess} />;
}
