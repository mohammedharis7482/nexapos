import { notFound } from "next/navigation";

import { DesignSystemShowcase } from "./showcase";
import { isDesignSystemShowcaseEnabled } from "./guard";

export default function DesignSystemPage() {
  if (!isDesignSystemShowcaseEnabled()) notFound();
  return <DesignSystemShowcase />;
}
