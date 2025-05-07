"use client";
import dynamic from "next/dynamic";

const FacebookCodeHandler = dynamic(() => import("./FacebookCodeHandler"), { ssr: false });

export default function FacebookCodeHandlerWrapper() {
  return <FacebookCodeHandler />;
}
