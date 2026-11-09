import type { Metadata } from "next";

import { SuccessScreen } from "@/features/approval/components/success-screen";

export const metadata: Metadata = { title: "Approval complete" };

export default async function ApprovalSuccessPage({ params }: PageProps<"/packages/[id]/success">) {
  const { id } = await params;
  return <SuccessScreen id={id} />;
}
